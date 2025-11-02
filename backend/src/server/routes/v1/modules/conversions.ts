import { Router } from "express";
import { authenticate, AuthenticatedRequest } from "../../../middleware/auth.js";
import { prisma } from "../../../../db/prisma.js";
import { createConversionProvider } from "../../../../conversion/provider.js";
import { storage } from "../../../../storage/index.js";
import { env } from "../../../../config/env.js";
import { validate } from "../../../middleware/validate.js";
import { conversionIdParamSchema, requestConversionSchema } from "../../../../schemas/conversions.js";

const provider = createConversionProvider();
export const router = Router();

router.get("/formats", authenticate, async (req: AuthenticatedRequest, res) => {
	return res.json({ formats: ["pdf", "docx", "xlsx", "png", "jpg", "mp4", "mp3"] });
});

router.post("/", authenticate, validate(requestConversionSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const { fileId, to } = req.body as any;
	const file = await prisma.file.findFirst({ where: { fileId, userId: req.user.userId, isDeleted: false } });
	if (!file) return res.status(404).json({ message: "file not found" });
	const conv = await prisma.conversion.create({ data: { userId: req.user.userId, fileId, targetFormat: to, status: "queued" } });
	const requested = await provider.requestConversion({ fileKey: file.storagePath, targetFormat: to });
	if (requested.externalId) {
		await prisma.conversion.update({ where: { conversionId: conv.conversionId }, data: { externalId: requested.externalId, status: "processing" } });
	}
	return res.status(202).json({ conversionId: conv.conversionId });
});

router.get("/:conversionId", authenticate, validate(conversionIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const conv = await prisma.conversion.findFirst({ where: { conversionId: req.params.conversionId, userId: req.user.userId } });
	if (!conv) return res.status(404).json({ message: "not found" });
	return res.json({ status: conv.status, targetFormat: conv.targetFormat, resultKey: conv.resultKey });
});

router.get("/:conversionId/download", authenticate, validate(conversionIdParamSchema), async (req: AuthenticatedRequest, res) => {
	if (!req.user) return res.status(401).json({ message: "unauthorized" });
	const conv = await prisma.conversion.findFirst({ where: { conversionId: req.params.conversionId, userId: req.user.userId } });
	if (!conv || conv.status !== "completed" || !conv.resultKey) return res.status(404).json({ message: "not ready" });
	const stream = await storage.getStream(conv.resultKey);
	stream.on("error", () => res.status(500).end());
	return stream.pipe(res);
});

// CloudConvert webhook (no auth). Provide token in query for basic protection.
router.post("/webhook/cloudconvert", async (req, res) => {
	if (!env.cloudConvertWebhookToken || req.query.token !== env.cloudConvertWebhookToken) return res.status(401).json({ message: "unauthorized" });
	const body = req.body as any;
	const job = body?.data;
	const externalId = job?.id;
	if (!externalId) return res.status(400).json({});
	// Find export task and its key if available
	let resultKey: string | undefined;
	try {
		const tasks = job?.tasks ?? [];
		const exportTask = tasks.find((t: any) => t.name === "export-my-file" || t.operation?.startsWith("export"));
		const file = exportTask?.result?.files?.[0];
		resultKey = file?.filename ? file?.filename : undefined;
	} catch {}
	await prisma.conversion.updateMany({ where: { externalId }, data: { status: "completed", resultKey } });
	return res.json({});
});
