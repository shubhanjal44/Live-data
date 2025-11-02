import { Router } from "express";
import { prisma } from "../../../../db/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../../../config/env.js";
import { audit } from "../../../../audit/logger.js";
import { validate } from "../../../middleware/validate.js";
import { loginSchema, registerSchema } from "../../../../schemas/auth.js";

export const router = Router();

function signToken(userId: string, email: string) {
	return jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: "1h" });
}

router.post("/register", validate(registerSchema), async (req, res) => {
	try {
		const { email, password, firstName, lastName } = req.body as any;
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			await audit(req, { action: "auth.register", status: "conflict" });
			return res.status(409).json({ message: "email already registered" });
		}

		const passwordHash = await bcrypt.hash(password, 12);
		const user = await prisma.user.create({
			data: { email, passwordHash, firstName, lastName },
			select: { userId: true, email: true, firstName: true, lastName: true },
		});

		const token = signToken(user.userId, user.email);
		await audit(req, { action: "auth.register", status: "success", resourceType: "user", resourceId: user.userId });
		return res.status(201).json({ user, token });
	} catch (err) {
		await audit(req, { action: "auth.register", status: "error" });
		return res.status(500).json({ message: "internal error" });
	}
});

router.post("/login", validate(loginSchema), async (req, res) => {
	try {
		const { email, password } = req.body as any;
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			await audit(req, { action: "auth.login", status: "unauthorized" });
			return res.status(401).json({ message: "invalid credentials" });
		}

		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) {
			await audit(req, { action: "auth.login", status: "unauthorized", resourceId: user.userId, resourceType: "user" });
			return res.status(401).json({ message: "invalid credentials" });
		}

		const token = signToken(user.userId, user.email);
		await prisma.user.update({ where: { userId: user.userId }, data: { lastLogin: new Date() } });
		await audit(req, { action: "auth.login", status: "success", resourceType: "user", resourceId: user.userId });
		return res.json({
			user: { userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName },
			token,
		});
	} catch (err) {
		await audit(req, { action: "auth.login", status: "error" });
		return res.status(500).json({ message: "internal error" });
	}
});

router.post("/refresh-token", (req, res) => {
	return res.status(501).json({ message: "Not implemented: refresh token" });
});

router.post("/mfa/setup", (req, res) => {
	return res.status(501).json({ message: "Not implemented: mfa setup" });
});

router.post("/mfa/verify", (req, res) => {
	return res.status(501).json({ message: "Not implemented: mfa verify" });
});

router.post("/password-reset", (req, res) => {
	return res.status(501).json({ message: "Not implemented: password reset" });
});

router.post("/password-reset/confirm", (req, res) => {
	return res.status(501).json({ message: "Not implemented: password reset confirm" });
});
