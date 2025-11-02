import sharp from "sharp";
import { storage } from "./index.js";

export async function generateImageThumbnail(params: { key: string; buffer: Buffer; maxWidth?: number; maxHeight?: number }): Promise<string> {
	const { key, buffer, maxWidth = 256, maxHeight = 256 } = params;
	const out = await sharp(buffer).resize({ width: maxWidth, height: maxHeight, fit: "inside" }).jpeg({ quality: 75 }).toBuffer();
	const thumbKey = `thumbs/${key}.jpg`;
	await storage.upload({ key: thumbKey, contentType: "image/jpeg", buffer: out });
	return thumbKey;
}
