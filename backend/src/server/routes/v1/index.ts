import { Router } from "express";
import { router as authRouter } from "./modules/auth.js";
import { router as filesRouter } from "./modules/files.js";
import { router as conversionsRouter } from "./modules/conversions.js";
import { router as sharesRouter } from "./modules/shares.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/files", filesRouter);
router.use("/conversions", conversionsRouter);
router.use("/shares", sharesRouter);

router.get("/", (req, res) => {
	res.json({ version: "v1" });
});
