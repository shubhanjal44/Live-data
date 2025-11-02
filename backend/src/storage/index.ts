import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { env } from "../config/env.js";
import { storageDir } from "../config/storage.js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export type StoredObjectRef = { key: string; location: "local" | "s3" };

export interface StorageService {
	upload(params: { key: string; contentType: string; buffer: Buffer }): Promise<StoredObjectRef>;
	getStream(key: string): Promise<Readable>;
	remove(key: string): Promise<void>;
}

function createLocalStorage(): StorageService {
	return {
		async upload({ key, buffer }): Promise<StoredObjectRef> {
			const full = path.join(storageDir, key);
			const dir = path.dirname(full);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(full, buffer);
			return { key, location: "local" };
		},
		async getStream(key: string) {
			const full = path.join(storageDir, key);
			return fs.createReadStream(full);
		},
		async remove(key: string) {
			const full = path.join(storageDir, key);
			if (fs.existsSync(full)) fs.rmSync(full);
		},
	};
}

function createS3Storage(): StorageService {
	if (!env.s3Bucket || !env.s3Region) {
		throw new Error("S3 storage selected but S3 env vars are missing");
	}
	const client = new S3Client({
		region: env.s3Region,
		credentials: env.s3AccessKeyId && env.s3SecretAccessKey ? { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } : undefined,
		forcePathStyle: env.s3ForcePathStyle,
		endpoint: env.s3Endpoint,
	});
	return {
		async upload({ key, contentType, buffer }): Promise<StoredObjectRef> {
			await client.send(
				new PutObjectCommand({ Bucket: env.s3Bucket!, Key: key, Body: buffer, ContentType: contentType })
			);
			return { key, location: "s3" };
		},
		async getStream(key: string) {
			const obj = await client.send(new GetObjectCommand({ Bucket: env.s3Bucket!, Key: key }));
			return obj.Body as Readable;
		},
		async remove(key: string) {
			await client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket!, Key: key }));
		},
	};
}

export const storage: StorageService = env.storageProvider === "s3" ? createS3Storage() : createLocalStorage();
