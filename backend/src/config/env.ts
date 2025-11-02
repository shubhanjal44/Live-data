import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
	const value = process.env[name] ?? fallback;
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

export const env = {
	port: Number(process.env.PORT ?? 4000),
	jwtSecret: requireEnv("JWT_SECRET", "dev-secret-change-me"),
	databaseUrl: requireEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/live_data"),
	redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
	nodeEnv: process.env.NODE_ENV ?? "development",
	// Storage
	storageProvider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "s3",
	storageDir: process.env.STORAGE_DIR ?? "./storage",
	// S3
	s3Bucket: process.env.S3_BUCKET,
	s3Region: process.env.S3_REGION,
	s3Endpoint: process.env.S3_ENDPOINT, // optional (for MinIO/compat)
	s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
	s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
	s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
	// Conversion
	conversionProvider: (process.env.CONVERSION_PROVIDER ?? "noop") as "noop" | "cloudconvert",
	cloudConvertApiKey: process.env.CLOUDCONVERT_API_KEY,
	cloudConvertWebhookUrl: process.env.CLOUDCONVERT_WEBHOOK_URL,
	cloudConvertWebhookToken: process.env.CLOUDCONVERT_WEBHOOK_TOKEN,
	// Signed URLs
	signingSecret: requireEnv("SIGNING_SECRET", "dev-signing-secret"),
};
