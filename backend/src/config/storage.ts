import fs from "fs";
import path from "path";

const defaultDir = path.resolve(process.cwd(), "storage");
export const storageDir = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : defaultDir;

export function ensureStorageDirs() {
	if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
}
