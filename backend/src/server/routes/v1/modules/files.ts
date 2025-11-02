import { Router } from "express";
import multer from "multer";
import { prisma } from "../../../../db/prisma.js";
import { authenticate, AuthenticatedRequest } from "../../../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import { storage } from "../../../../storage/index.js";
import { audit } from "../../../../audit/logger.js";
import bcrypt from "bcrypt";
import { generateImageThumbnail } from "../../../../storage/thumbnails.js";
import { validate } from "../../../middleware/validate.js";
import { fileIdParamSchema, filePasswordSetSchema, searchSchema, tagsSchema, updateFileSchema } from "../../../../schemas/files.js";

export const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 200 } });

router.post("/upload", authenticate, upload.single("file"), async (req: AuthenticatedRequest, res) => {
	try {
		if (!req.user) return res.status(401).json({ message: "unauthorized" });
		if (!req.file) {
			await audit(req as any, { action: "files.upload", status: "bad_request" });
			return res.status(400).json({ message: "file is required (field name 'file')" });
		}

		const id = uuidv4();
		const ext = mime.extension(req.file.mimetype) || "bin";
		const key = `${req.user.userId}/${id}.${ext}`;
		await storage.upload({ key, contentType: req.file.mimetype, buffer: req.file.buffer });

		let thumbnailKey: string | undefined;
		if (req.file.mimetype.startsWith("image/")) {
			try {
				thumbnailKey = await generateImageThumbnail({ key, buffer: req.file.buffer });
			} catch {}
		}

		const record = await prisma.file.create({
			data: {
				fileId: id,
				userId: req.user.userId,
				fileName: req.file.originalname,
				fileSize: BigInt(req.file.size),
				mimeType: req.file.mimetype,
				storagePath: key,
				tags: [],
				thumbnailKey,
			},
		});

		await audit(req as any, { action: "files.upload", status: "success", resourceType: "file", resourceId: record.fileId });
		return res.status(201).json({ fileId: record.fileId });
	} catch (e) {
		await audit(req as any, { action: "files.upload", status: "error" });
		return res.status(500).json({ message: "internal error" });
	}
});

router.get("/", authenticate, async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const files = await prisma.file.findMany({
		where: { userId: req.user.userId, isDeleted: false },
		orderBy: { createdAt: "desc" },
		select: { fileId: true, fileName: true, fileSize: true, mimeType: true, isPasswordProtected: true, tags: true, createdAt: true, thumbnailKey: true },
	});
	return res.json({ files });
});

router.get("/:fileId/thumbnail", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false } });
	if (!file || !file.thumbnailKey) return res.status(404).json({ message: "not found" });
	res.setHeader("Content-Type", "image/jpeg");
	const stream = await storage.getStream(file.thumbnailKey);
	stream.on("error", () => res.status(500).end());
	stream.pipe(res);
});

router.get("/search", authenticate, validate(searchSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const q = (req.query.q as string) ?? "";
	const tags = ((req.query.tags as string) ?? "")
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	const files = await prisma.file.findMany({
		where: {
			userId: req.user.userId,
			isDeleted: false,
			AND: [
				q ? { fileName: { contains: q, mode: "insensitive" } } : {},
				tags.length ? { tags: { hasSome: tags } } : {},
			],
		},
		orderBy: { createdAt: "desc" },
		select: { fileId: true, fileName: true, fileSize: true, mimeType: true, tags: true, createdAt: true },
	});
	return res.json({ files });
});

router.put("/:fileId/tags", authenticate, validate(tagsSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { tags } = req.body as any;
	if (!Array.isArray(tags)) return res.status(400).json({ message: "tags must be an array of strings" });
	const updated = await prisma.file.updateMany({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false }, data: { tags } });
	if (updated.count === 0) return res.status(404).json({ message: "not found" });
	await audit(req as any, { action: "files.tags.update", status: "success", resourceType: "file", resourceId: req.params.fileId });
	return res.status(204).send();
});

router.get("/:fileId", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({
		where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false },
		select: { fileId: true, fileName: true, fileSize: true, mimeType: true, isPasswordProtected: true, tags: true, createdAt: true, updatedAt: true },
	});
	if (!file) return res.status(404).json({ message: "not found" });
	return res.json({ file });
});

router.get("/:fileId/preview", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "not found" });
	const isInline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" || file.mimeType.startsWith("text/");
	res.setHeader("Content-Type", file.mimeType);
	res.setHeader("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${file.fileName.replace(/"/g, '')}"`);
	const stream = await storage.getStream(file.storagePath);
	stream.on("error", async () => {
		await audit(req as any, { action: "files.preview", status: "error", resourceType: "file", resourceId: file.fileId });
		res.status(500).end();
	});
	await audit(req as any, { action: "files.preview", status: "success", resourceType: "file", resourceId: file.fileId });
	stream.pipe(res);
});

router.get("/:fileId/download", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({
		where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false },
	});
	if (!file) return res.status(404).json({ message: "not found" });
	if (file.isPasswordProtected) {
		const provided = req.header("x-file-password") || "";
		if (!provided || !file.passwordHash || !(await bcrypt.compare(provided, file.passwordHash))) {
			await audit(req as any, { action: "files.download", status: "forbidden", resourceType: "file", resourceId: file.fileId });
			return res.status(403).json({ message: "file password required or incorrect" });
		}
	}
	res.setHeader("Content-Type", file.mimeType);
	res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, '')}"`);
	const stream = await storage.getStream(file.storagePath);
	stream.on("error", async () => {
		await audit(req as any, { action: "files.download", status: "error", resourceType: "file", resourceId: file.fileId });
		res.status(500).end();
	});
	await audit(req as any, { action: "files.download", status: "success", resourceType: "file", resourceId: file.fileId });
	stream.pipe(res);
});

router.post("/:fileId/password", authenticate, validate(filePasswordSetSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { password } = req.body as any;
	if (!password) return res.status(400).json({ message: "password required" });
	const file = await prisma.file.findFirst({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "not found" });
	const passwordHash = await bcrypt.hash(password, 12);
	await prisma.file.update({ where: { fileId: file.fileId }, data: { isPasswordProtected: true, passwordHash } });
	await audit(req as any, { action: "files.password.set", status: "success", resourceType: "file", resourceId: file.fileId });
	return res.status(204).send();
});

router.delete("/:fileId/password", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "not found" });
	await prisma.file.update({ where: { fileId: file.fileId }, data: { isPasswordProtected: false, passwordHash: null } });
	await audit(req as any, { action: "files.password.unset", status: "success", resourceType: "file", resourceId: file.fileId });
	return res.status(204).send();
});

router.delete("/:fileId", authenticate, validate(fileIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const file = await prisma.file.findFirst({ where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "not found" });
	await storage.remove(file.storagePath);
	await prisma.file.update({ where: { fileId: file.fileId }, data: { isDeleted: true, deletedAt: new Date() } });
	await audit(req as any, { action: "files.delete", status: "success", resourceType: "file", resourceId: file.fileId });
	return res.status(204).send();
});

router.put("/:fileId", authenticate, validate(updateFileSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { fileName } = req.body as any;
	const updated = await prisma.file.updateMany({
		where: { fileId: req.params.fileId, userId: req.user.userId, isDeleted: false },
		data: { fileName },
	});
	if (updated.count === 0) return res.status(404).json({ message: "not found" });
	await audit(req as any, { action: "files.update", status: "success", resourceType: "file", resourceId: req.params.fileId });
	return res.status(204).send();
});
