import axios from "axios";
import { env } from "../config/env.js";

export type ConversionRequest = {
	fileKey: string;
	targetFormat: string;
};

export type ConversionResult = {
	status: "queued" | "processing" | "completed" | "failed";
	resultKey?: string;
	error?: string;
};

export interface ConversionProvider {
	requestConversion(req: ConversionRequest): Promise<{ externalId?: string }>;
	getStatus(externalId: string): Promise<ConversionResult>;
}

export class NoopConversionProvider implements ConversionProvider {
	async requestConversion(): Promise<{ externalId?: string }> {
		return {};
	}
	async getStatus(): Promise<ConversionResult> {
		return { status: "processing" };
	}
}

export class CloudConvertProvider implements ConversionProvider {
	private client = axios.create({
		baseURL: "https://api.cloudconvert.com/v2",
		headers: { Authorization: `Bearer ${env.cloudConvertApiKey}` },
	});
	async requestConversion(req: ConversionRequest): Promise<{ externalId?: string }> {
		if (!env.s3Bucket || !env.s3Region || !env.cloudConvertWebhookUrl) return {};
		// Build a conversion job that imports from S3, converts, and exports back to S3
		const exportKey = req.fileKey.replace(/\.[^.]+$/, "") + "." + req.targetFormat;
		const job = await this.client.post("/jobs", {
			tasks: {
				"import-my-file": {
					action: "import/s3",
					bucket: env.s3Bucket,
					region: env.s3Region,
					access_key_id: env.s3AccessKeyId,
					secret_access_key: env.s3SecretAccessKey,
					key: req.fileKey,
				},
				"convert-my-file": {
					action: "convert",
					input: ["import-my-file"],
					output_format: req.targetFormat,
				},
				"export-my-file": {
					action: "export/s3",
					input: ["convert-my-file"],
					bucket: env.s3Bucket,
					region: env.s3Region,
					access_key_id: env.s3AccessKeyId,
					secret_access_key: env.s3SecretAccessKey,
					key: exportKey,
				},
			},
			webhook_url: `${env.cloudConvertWebhookUrl}?token=${env.cloudConvertWebhookToken}`,
		});
		return { externalId: job.data?.data?.id };
	}
	async getStatus(): Promise<ConversionResult> {
		return { status: "processing" };
	}
}

export function createConversionProvider(): ConversionProvider {
	if (env.conversionProvider === "cloudconvert" && env.cloudConvertApiKey) {
		return new CloudConvertProvider();
	}
	return new NoopConversionProvider();
}
