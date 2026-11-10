import { zstdCompressSync, zstdDecompressSync } from "node:zlib";

import { type DescMessage, fromBinary, type MessageShape, toBinary } from "@bufbuild/protobuf";
import { customType } from "drizzle-orm/sqlite-core";

export const wrapProto = <Desc extends DescMessage>(schema: Desc) =>
	customType<{
		data: MessageShape<Desc>;
		driverData: Buffer;
	}>({
		dataType: () => "blob",
		fromDriver: (raw) => {
			let compressed: Buffer;
			if (typeof raw === "string") {
				const hex = raw as string;
				compressed = Buffer.from(
					Array.from({ length: hex.length / 2 }, (_, idx) =>
						parseInt(hex.slice(idx * 2, idx * 2 + 2), 16),
					),
				);
			} else {
				compressed = raw;
			}

			const buffer = zstdDecompressSync(compressed);
			return fromBinary(schema, buffer);
		},
		toDriver: (value) => {
			const buffer = toBinary(schema, value);
			return zstdCompressSync(buffer);
		},
	});
