import crypto from "crypto";
import { env } from "../config/env.js";

function base64url(input: Buffer | string): string {
	const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function createSignedToken(data: { shareId: string; exp: number }): string {
	const payload = `${data.shareId}.${data.exp}`;
	const sig = crypto.createHmac("sha256", env.signingSecret).update(payload).digest();
	return `${base64url(Buffer.from(payload))}.${base64url(sig)}`;
}

export function verifySignedToken(token: string): { shareId: string; exp: number } | null {
	const parts = token.split(".");
	if (parts.length !== 2) return null;
	const payloadB64 = parts[0];
	const sigB64 = parts[1];
	const payload = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
	const [shareId, expStr] = payload.split(".");
	const exp = Number(expStr);
	if (!shareId || !isFinite(exp)) return null;
	const expected = crypto.createHmac("sha256", env.signingSecret).update(payload).digest();
	const provided = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
	if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;
	if (Date.now() > exp) return null;
	return { shareId, exp };
}
