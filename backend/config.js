import "dotenv/config";
import path from "path";


// =====================================
// Konfigurasi folder
// Satu sumber untuk lokasi folder data.
// Bisa dioverride lewat .env, default
// bernilai sama dengan struktur lama
// sehingga aman mengganti kode.
// =====================================


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


// =====================================
// Konfigurasi upload dokumen
// =====================================

export const MAX_FILE_SIZE =
20 * 1024 * 1024; // 20 MB


// =====================================
// Origin yang boleh mengakses API (CORS)
// Dipisah koma. Default membolehkan
// frontend dev Vite di localhost.
// =====================================

export const CORS_ORIGINS =
(
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173"
)
.split(",")
.map(origin => origin.trim())
.filter(Boolean);


// =====================================
// Bantu path absolut (opsional)
// =====================================

export const resolvePath =
relativePath =>
path.resolve(relativePath);