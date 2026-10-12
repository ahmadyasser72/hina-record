import { createCipheriv, createDecipheriv } from "node:crypto";

import { fromBinary, fromJson, toBinary, toJson } from "@bufbuild/protobuf";
import { AbortTaskRunError, logger, wait } from "@trigger.dev/sdk";
import { limitAsync, randomInt, retry } from "es-toolkit";

import { GBP, redis } from "#lib/db";
import {
	UserAuthRequestSchema,
	type UserAuthRequestJson,
} from "./gen/auth-request_pb";
import { UserProfileSchema } from "./gen/profile_pb";

const USER_AGENT =
	"UnityPlayer/2022.3.62f2 (UnityWebRequest/1.0, libcurl/8.10.1-DEV)";
const UNITY_VERSION = "2022.3.62f2";

export class MaintenanceError extends Error {
	constructor() {
		super("Server Maintenance");
	}
}

export interface GbpCredentials {
	uid: string;
	token: string;
	signature: string;
}

const fetch = limitAsync(globalThis.fetch, 1);

export const bangDream = {
	profile: async (version: string, auth: GbpCredentials, uid: string) => {
		const url = new URL(
			`profile/${uid}`,
			`https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/`,
		);

		return logger.trace("gbp-profile", async (span) => {
			span.setAttribute?.("uid", uid);

			const response = await bangDream.fetch("PUT", version, url, auth);
			const newToken = response.headers.get("x-token");
			if (!newToken)
				throw new AbortTaskRunError(
					`Request to ${url.pathname} not returning new token`,
				);

			return logger.trace("parse", async (span) => {
				span.setAttribute?.("typeName", UserProfileSchema.typeName);

				const output = fromBinary(UserProfileSchema, response.bytes);
				const json = toJson(UserProfileSchema, output);
				return { data: output, json, response: { ...auth, token: newToken } };
			});
		});
	},

	refreshToken: async (version: string, auth: GbpCredentials) => {
		const body = await redis().get<UserAuthRequestJson>(GBP.credentialsRequest);
		if (!body)
			throw new AbortTaskRunError("BanG Dream auth request body is missing.");

		const url = new URL(
			`https://api.app-bang-dream-gbp.com/api/user/${auth.uid}/auth`,
		);
		const bytes = toBinary(
			UserAuthRequestSchema,
			fromJson(UserAuthRequestSchema, body),
		);
		const { headers } = await bangDream.fetch(
			"PUT",
			version,
			url,
			auth,
			encrypt(bytes.buffer),
		);

		const token = headers.get("x-token");
		if (!token)
			throw new AbortTaskRunError("BanG Dream auth request is invalid.");

		return token;
	},

	fetch: async (
		method: "GET" | "PUT",
		version: string,
		url: URL,
		auth: GbpCredentials,
		body?: Buffer,
	): Promise<{ bytes: Buffer; headers: Headers }> =>
		logger.trace("fetch", async (span) => {
			span.setAttribute?.("request", `${method}: ${url}`);

			const response = await retry(
				() =>
					fetch(url, {
						method,
						headers: {
							host: "api.app-bang-dream-gbp.com",
							"user-agent": USER_AGENT,
							"accept-encoding": "deflate, gzip",
							"content-type": "application/octet-stream",
							accept: "application/octet-stream",
							"x-clientversion": version,
							"x-signature": auth.signature,
							"x-token": auth.token,
							"x-clientplatform": "Android",
							"x-unity-version": UNITY_VERSION,
						},
						body: body?.slice(0),
					}),
				{
					retries: 2,
					delay: 500,
					shouldRetry: (error) => error instanceof TypeError,
				},
			);
			span.setAttribute?.("status", response.status);

			if (!response.ok) {
				if (response.status === 503) {
					await redis().set(GBP.maintenance, true, { ex: 60 * 30 });
					throw new MaintenanceError();
				} else if (method !== "GET" && response.status === 403) {
					auth.token = await bangDream.refreshToken(version, auth);
					return bangDream.fetch(method, version, url, auth, body);
				} else if (response.status === 500) {
					await wait.for({ seconds: randomInt(6, 9) });
					return bangDream.fetch(method, version, url, auth, body);
				}

				throw new AbortTaskRunError(
					`${method}: ${url.pathname} failed (${response.status})`,
				);
			}

			const bytes = await response.arrayBuffer().then(decrypt);
			span.setAttribute?.("size", bytes.byteLength);

			return { bytes, headers: response.headers };
		}),
};

const { decrypt, encrypt } = (() => {
	const { BANG_DREAM_AES_KEY, BANG_DREAM_AES_IV } = process.env;
	if (!BANG_DREAM_AES_KEY || !BANG_DREAM_AES_IV)
		throw new AbortTaskRunError("BanG Dream decryption keys are missing.");

	const key = Buffer.from(BANG_DREAM_AES_KEY);
	const iv = Buffer.from(BANG_DREAM_AES_IV);
	return {
		decrypt: (data: ArrayBuffer) => {
			const decipher = createDecipheriv("aes-128-cbc", key, iv);
			decipher.setAutoPadding(false);

			const plain = Buffer.concat([
				decipher.update(Buffer.from(data)),
				decipher.final(),
			]);

			const paddingLength = plain[plain.length - 1];
			return plain.subarray(0, plain.length - paddingLength);
		},
		encrypt: (data: ArrayBuffer) => {
			const padding = 16 - (data.byteLength % 16);
			const padded = Buffer.concat([
				Buffer.from(data),
				Buffer.alloc(padding, padding),
			]);

			const cipher = createCipheriv("aes-128-cbc", key, iv);
			cipher.setAutoPadding(false);

			return Buffer.concat([cipher.update(padded), cipher.final()]);
		},
	};
})();
