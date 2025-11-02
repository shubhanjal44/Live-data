import { prisma } from "../db/prisma.js";
import { Request } from "express";

export async function audit(req: Request, entry: {
	action: string;
	resourceType?: string;
	resourceId?: string;
	status?: string;
	details?: object;
}) {
	try {
		const userId = (req as any).user?.userId as string | undefined;
		await prisma.auditLog.create({
			data: {
				userId,
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,
				status: entry.status,
				details: entry.details as any,
				ipAddress: req.ip,
				userAgent: req.headers["user-agent"],
			},
		});
	} catch {
		// swallow audit failures
	}
}
