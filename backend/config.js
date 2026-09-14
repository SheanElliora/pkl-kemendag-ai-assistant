import "dotenv/config";
import path from "path";

export const DOCS_FOLDER =
process.env.DOCS_PATH || "./docs";

export const UPLOADS_FOLDER =
process.env.UPLOADS_PATH || "./uploads";

export const DATA_FOLDER =
process.env.DATA_PATH || "./data";

export const OCR_FOLDER =
process.env.OCR_PATH || "./ocr_text";

export const CHUNK_FOLDER =
process.env.CHUNKS_PATH || "./chunks";

export const MAX_FILE_SIZE =
20 * 1024 * 1024;

export const CORS_ORIGINS =
(
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173"
)
.split(",")
.map(origin => origin.trim())
.filter(Boolean);

export const resolvePath =
relativePath =>
path.resolve(relativePath);
