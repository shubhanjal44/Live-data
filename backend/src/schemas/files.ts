import { z } from "zod";

export const updateFileSchema = {
	params: z.object({ fileId: z.string().uuid() }),
	body: z.object({ fileName: z.string().min(1) }),
};

export const tagsSchema = {
	params: z.object({ fileId: z.string().uuid() }),
	body: z.object({ tags: z.array(z.string().min(1)).default([]) }),
};

export const filePasswordSetSchema = {
	params: z.object({ fileId: z.string().uuid() }),
	body: z.object({ password: z.string().min(1) }),
};

export const fileIdParamSchema = {
	params: z.object({ fileId: z.string().uuid() }),
};

export const searchSchema = {
	query: z.object({ q: z.string().optional(), tags: z.string().optional() }),
};
