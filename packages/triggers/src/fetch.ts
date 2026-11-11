import { createCipheriv, createDecipheriv } from "node:crypto";

import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import BZip2 from "@digitaldefiance/bzip2-wasm";
import { GBP, redis } from "@hina-record/shared/db";
import type { Tracker } from "@hina-record/shared/db/schema";
import { TrackerRankingProtoSchema } from "@hina-record/shared/db/types";
import { ClientErrorResponseSchema } from "@hina-record/shared/gbp/gen/error_pb";
import { UserProfileSchema } from "@hina-record/shared/gbp/gen/profile_pb";
import { SuiteMasterGetResponseSchema } from "@hina-record/shared/gbp/gen/suite_master_pb";
import { TrackerSnapshotSchema } from "@hina-record/shared/gbp/gen/tracker_snapshot_pb";
import { xxhash } from "@hina-record/shared/hash";
import { AbortTaskRunError, logger, metadata } from "@trigger.dev/sdk";
import { limitAsync, retry } from "es-toolkit";

const USER_AGENT = "UnityPlayer/2022.3.62f2 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)";
const UNITY_VERSION = "2022.3.62f2";

type GbpErrorKind = "maintenance" | "need-reauth" | "internal-server-error" | "unknown";

export class GbpError extends Error {
	status: number;
	kind: GbpErrorKind;

	constructor(url: string, method: string, status: number, message: string) {
		super(`Error on ${method} @ ${url} (${status}): ${message}`);
		this.status = status;

		if (status === 503) this.kind = "maintenance";
		else if (method !== "GET" && status === 403) this.kind = "maintenance";
		else if (status === 500) this.kind = "internal-server-error";
		else this.kind = "unknown";
	}
}

export interface GbpCredentials {
	uid: string;
	token: string;
	signature: string;
}

const fetch = limitAsync(globalThis.fetch, 1);

export const bangDream = {
	fetch: async (
		method: "GET" | "PUT",
		version: string,
		url: string,
		auth: GbpCredentials,
		body?: Buffer,
	): Promise<{ bytes: Buffer; headers: Headers }> => {
		const headers = {
			accept: "application/octet-stream",
			"accept-encoding": "deflate, gzip",
			"content-type": "application/octet-stream",
			host: "api.app-bang-dream-gbp.com",
			"user-agent": USER_AGENT,
			"x-clientplatform": "Android",
			"x-clientversion": version,
			"x-signature": auth.signature,
			"x-token": auth.token,
			"x-unity-version": UNITY_VERSION,
		};
		const request =
			method === "PUT" ? { body: body?.subarray(0), headers, method } : { headers, method };

		const response = await retry(
			async function runFetch() {
				let response = await fetch(url, request);

				if (!response.ok) {
					let message: string;
					try {
						const bytes = await response.arrayBuffer().then(decrypt);
						const error = fromBinary(ClientErrorResponseSchema, bytes);
						message = error.errorMessage;
					} catch (error) {
						console.error(`Error parsing ${ClientErrorResponseSchema.typeName}: ${error}`);
						message = "Unknown error";
					}

					const error = new GbpError(url, method, response.status, message);
					metadata.root.append("error", { kind: error.kind, error: error.message });

					if (error.kind === "need-reauth") {
						headers["x-token"] = await bangDream.refreshToken(version, auth);
						return runFetch();
					}

					throw error;
				}

				return response;
			},
			{
				delay: 500,
				retries: 4,
				shouldRetry: (error) =>
					error instanceof TypeError &&
					error instanceof GbpError &&
					error.kind === "internal-server-error",
			},
		);

		const bytes = await response.arrayBuffer().then(decrypt);
		return { bytes, headers: response.headers };
	},

	master: async (version: string, auth: GbpCredentials) => {
		const url = "https://api.app-bang-dream-gbp.com/api/suite/master";

		return logger.trace("gbp.master", async (span) => {
			const response = await bangDream.fetch("GET", version, url, auth);

			const bzip2 = new BZip2();
			await bzip2.init();

			const raw = bzip2.decompress(response.bytes, 48 * 1024 * 1024);
			const output = fromBinary(SuiteMasterGetResponseSchema, raw, {
				readUnknownFields: false,
			});
			const bytes = toBinary(SuiteMasterGetResponseSchema, output);

			const hash = xxhash.h32Raw(bytes);
			span.setAttribute?.("hash", hash);

			return {
				data: output,
				response: { bytes, hash },
			};
		});
	},
	profile: async (version: string, auth: GbpCredentials, uid: string, readUnknownFields = true) => {
		const url = `https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/profile/${uid}`;

		return logger.trace(`gbp.profile.${uid}`, async (span) => {
			const response = await bangDream.fetch("PUT", version, url, auth);
			const newToken = response.headers.get("x-token");
			if (!newToken)
				throw new AbortTaskRunError(`Request to ${new URL(url).pathname} not returning new token`);

			const output = fromBinary(UserProfileSchema, response.bytes, {
				readUnknownFields,
			});
			const bytes = toBinary(UserProfileSchema, output);

			const hash = xxhash.h32Raw(bytes);
			span.setAttribute?.("hash", hash);

			return {
				data: output,
				response: { bytes, hash, token: newToken },
			};
		});
	},
	ranking: async (
		version: string,
		auth: GbpCredentials,
		reference: Pick<Tracker.Reference, "kind" | "id" | "type" | "data">,
	) => {
		const url = `https://api.app-bang-dream-gbp.com/api/user/${auth.uid}${reference.data.rankingPath}`;

		return logger.trace(`gbp.ranking.${reference.kind}:${reference.id}`, async (span) => {
			const response = await bangDream.fetch("GET", version, url, auth);

			const raw = fromBinary(TrackerRankingProtoSchema[reference.type], response.bytes, {
				readUnknownFields: false,
			});

			const output = create(TrackerSnapshotSchema, {
				// @ts-expect-error its correct
				snapshot: { case: reference.type, value: raw },
			});
			const bytes = toBinary(TrackerSnapshotSchema, output);

			const hash = xxhash.h32Raw(bytes);
			span.setAttribute?.("hash", hash);

			return {
				data: output,
				response: { bytes, hash },
			};
		});
	},

	refreshToken: async (version: string, auth: GbpCredentials) => {
		const key = GBP.credentials.request(auth.uid);
		const body = await redis().get<{ data: number[] }>(key);
		if (!body) throw new AbortTaskRunError("BanG Dream auth request body is missing.");

		const bytes = Buffer.from(body.data);
		const url = `https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/auth`;

		return logger.trace("gbp.refresh-token", async () => {
			const { headers } = await bangDream.fetch("PUT", version, url, auth, encrypt(bytes.buffer));

			const token = headers.get("x-token");
			if (!token) throw new AbortTaskRunError("BanG Dream auth request is invalid.");

			return token;
		});
	},
};

export const { decrypt, encrypt } = (() => {
	const { BANG_DREAM_AES_KEY, BANG_DREAM_AES_IV } = process.env;
	if (!BANG_DREAM_AES_KEY || !BANG_DREAM_AES_IV)
		throw new AbortTaskRunError("BanG Dream decryption keys are missing.");

	const key = Buffer.from(BANG_DREAM_AES_KEY);
	const iv = Buffer.from(BANG_DREAM_AES_IV);
	return {
		decrypt: (data: ArrayBuffer) => {
			const decipher = createDecipheriv("aes-128-cbc", key, iv);
			decipher.setAutoPadding(false);

			const plain = Buffer.concat([decipher.update(Buffer.from(data)), decipher.final()]);

			const paddingLength = plain[plain.length - 1];
			return plain.subarray(0, plain.length - paddingLength);
		},
		encrypt: (data: ArrayBuffer) => {
			const padding = 16 - (data.byteLength % 16);
			const padded = Buffer.concat([Buffer.from(data), Buffer.alloc(padding, padding)]);

			const cipher = createCipheriv("aes-128-cbc", key, iv);
			cipher.setAutoPadding(false);

			return Buffer.concat([cipher.update(padded), cipher.final()]);
		},
	};
})();
