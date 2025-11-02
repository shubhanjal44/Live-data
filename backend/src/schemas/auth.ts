import { z } from "zod";

export const registerSchema = {
	body: z.object({
		email: z.string().email(),
		password: z.string().min(8),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
	}),
};

export const loginSchema = {
	body: z.object({
		email: z.string().email(),
		password: z.string().min(1),
	}),
};
