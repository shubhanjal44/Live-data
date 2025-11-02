import { z } from "zod";

export const requestConversionSchema = {
	body: z.object({ fileId: z.string().uuid(), to: z.string().min(1) }),
};

export const conversionIdParamSchema = {
	params: z.object({ conversionId: z.string().uuid() }),
};
