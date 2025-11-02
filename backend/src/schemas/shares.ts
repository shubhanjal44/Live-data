import { z } from "zod";

export const createShareSchema = {
	body: z.object({
		fileId: z.string().uuid(),
		password: z.string().optional(),
		expiresAt: z.string().datetime().optional(),
		maxDownloads: z.number().int().positive().optional(),
	}),
};

export const shareIdParamSchema = {
	params: z.object({ shareId: z.string().uuid() }),
};

export const signedUrlSchema = {
	params: z.object({ shareId: z.string().uuid() }),
	body: z.object({ expiresInSeconds: z.number().int().min(60).max(86400).optional() }),
};
