import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export interface AuthenticatedRequest extends Request {
	user?: { userId: string; email: string };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith("Bearer ")) return res.status(401).json({ message: "unauthorized" });
	const token = header.slice("Bearer ".length);
	try {
		const payload = jwt.verify(token, env.jwtSecret) as { sub: string; email: string };
		req.user = { userId: payload.sub, email: payload.email };
		return next();
	} catch {
		return res.status(401).json({ message: "unauthorized" });
	}
}
