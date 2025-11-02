import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export function validate(schema: { body?: ZodSchema<any>; query?: ZodSchema<any>; params?: ZodSchema<any> }) {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			if (schema.body) req.body = schema.body.parse(req.body);
			if (schema.query) req.query = schema.query.parse(req.query);
			if (schema.params) req.params = schema.params.parse(req.params);
			return next();
		} catch (err: any) {
			return res.status(400).json({ message: "validation_error", errors: err?.errors ?? undefined });
		}
	};
}
