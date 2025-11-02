import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { router as healthRouter } from "./routes/health.js";
import { router as apiV1Router } from "./routes/v1/index.js";
import { ensureStorageDirs } from "../config/storage.js";
import { router as sharesRouter } from "./routes/v1/modules/shares.js";

const app = express();

ensureStorageDirs();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

app.use("/health", healthRouter);
app.use("/s", (req, res, next) => {
	(req as any).url = `/public/signed?${req.url.slice(1)}`;
	return sharesRouter(req as any, res, next as any);
});
app.use("/api/v1", apiV1Router);

// error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
	const status = err?.status || 500;
	return res.status(status).json({ message: err?.message || "internal_error" });
});

export default app;
