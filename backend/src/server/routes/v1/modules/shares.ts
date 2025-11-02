import { Router } from "express";
import { prisma } from "../../../../db/prisma.js";
import { authenticate, AuthenticatedRequest } from "../../../middleware/auth.js";
import bcrypt from "bcrypt";
import { audit } from "../../../../audit/logger.js";
import { storage } from "../../../../storage/index.js";
import { createSignedToken, verifySignedToken } from "../../../../security/signing.js";
import { validate } from "../../../middleware/validate.js";
import { createShareSchema, shareIdParamSchema, signedUrlSchema } from "../../../../schemas/shares.js";

export const router = Router();

router.post("/", authenticate, validate(createShareSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { fileId, password, expiresAt, maxDownloads } = req.body as any;
	const file = await prisma.file.findFirst({ where: { fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "file not found" });
	const passwordHash = password ? await bcrypt.hash(password, 12) : null;
	const share = await prisma.share.create({
		data: {
			userId: req.user.userId,
			fileId,
			passwordHash,
			expiresAt: expiresAt ? new Date(expiresAt) : null,
			maxDownloads: maxDownloads ?? null,
		},
		select: { shareId: true, expiresAt: true, maxDownloads: true },
	});
	await audit(req as any, { action: "shares.create", status: "success", resourceType: "share", resourceId: share.shareId });
	return res.status(201).json(share);
});

router.get("/:shareId", authenticate, validate(shareIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const share = await prisma.share.findFirst({
		where: { shareId: req.params.shareId, userId: req.user.userId },
		select: { shareId: true, fileId: true, expiresAt: true, maxDownloads: true, downloads: true, revoked: true, createdAt: true },
	});
	if (!share) return res.status(404).json({ message: "not found" });
	return res.json({ share });
});

router.delete("/:shareId", authenticate, validate(shareIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const share = await prisma.share.findFirst({ where: { shareId: req.params.shareId, userId: req.user.userId } });
	if (!share) return res.status(404).json({ message: "not found" });
	await prisma.share.update({ where: { shareId: share.shareId }, data: { revoked: true } });
	await audit(req as any, { action: "shares.revoke", status: "success", resourceType: "share", resourceId: share.shareId });
	return res.status(204).send();
});

router.post("/:shareId/signed-url", authenticate, validate(signedUrlSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { expiresInSeconds = 600 } = req.body as any;
	const share = await prisma.share.findFirst({ where: { shareId: req.params.shareId, userId: req.user.userId, revoked: false } });
	if (!share) return res.status(404).json({ message: "not found" });
	const exp = Date.now() + Math.max(60, Math.min(86400, Number(expiresInSeconds))) * 1000;
	const token = createSignedToken({ shareId: share.shareId, exp });
	return res.json({ url: `/s?t=${encodeURIComponent(token)}` });
});

// Public routes unchanged below...
router.get("/public/signed", async (req, res) => {
	const token = (req.query.t as string) || "";
	const verified = verifySignedToken(token);
	if (!verified) return res.status(401).json({ message: "unauthorized" });
	const share = await prisma.share.findFirst({ where: { shareId: verified.shareId }, include: { file: true } });
	if (!share || share.revoked) return res.status(404).json({ message: "not found" });
	if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return res.status(410).json({ message: "expired" });
	if (share.maxDownloads !== null && share.downloads >= (share.maxDownloads ?? 0)) return res.status(429).json({ message: "download limit reached" });
	res.setHeader("Content-Type", share.file.mimeType);
	res.setHeader("Content-Disposition", `attachment; filename="${share.file.fileName.replace(/"/g, '')}"`);
	const stream = await storage.getStream(share.file.storagePath);
	stream.on("error", () => res.status(500).end());
	prisma.share.update({ where: { shareId: share.shareId }, data: { downloads: { increment: 1 } } }).catch(() => {});
	stream.pipe(res);
});

router.get("/:shareId/download", async (req, res) => {
	const share = await prisma.share.findFirst({
		where: { shareId: req.params.shareId },
		include: { file: true },
	});
	if (!share || share.revoked) return res.status(404).json({ message: "not found" });
	if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return res.status(410).json({ message: "expired" });
	if (share.maxDownloads !== null && share.downloads >= (share.maxDownloads ?? 0)) return res.status(429).json({ message: "download limit reached" });
	if (share.passwordHash) {
		const provided = req.header("x-share-password") || "";
		if (!provided || !(await bcrypt.compare(provided, share.passwordHash))) return res.status(403).json({ message: "share password required or incorrect" });
	}
	res.setHeader("Content-Type", share.file.mimeType);
	res.setHeader("Content-Disposition", `attachment; filename="${share.file.fileName.replace(/"/g, '')}"`);
	const stream = await storage.getStream(share.file.storagePath);
	stream.on("error", () => res.status(500).end());
	prisma.share.update({ where: { shareId: share.shareId }, data: { downloads: { increment: 1 } } }).catch(() => {});
	stream.pipe(res);
});
