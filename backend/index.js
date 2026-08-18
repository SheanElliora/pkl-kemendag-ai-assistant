import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

import authRouter from "./routes/auth.js";
import cmsRouter from "./routes/cms.js";
import chatRouter from "./routes/chat.js";
import docsRouter from "./routes/docs.js";
import { CORS_ORIGINS, DOCS_FOLDER } from "./config.js";
import { ensureDefaultAdmin } from "./services/userService.js";
import { ensureFolders } from "./services/fileService.js";
import { recoverProcessingJobs } from "./services/ingestQueue.js";
import { MODEL_CATALOG } from "./services/modelCatalog.js";
import { createEmbedding } from "./services/embedderService.js";
import { rerankDocuments } from "./services/rerankerService.js";
import { readJson } from "./services/storeService.js";
import { countVectors } from "./services/vectorStorage.js";


const app = express();


// ======================================
// Folder upload & dokumen dibuat otomatis
// (lokasi diatur di config.js)
// ======================================

ensureFolders();

// CORS dibatasi ke origin yang didaftarkan
// (daftar di .env: CORS_ORIGINS)
app.use(cors({
    origin: CORS_ORIGINS
}));

app.use(express.json());


// ==============================
// Autentikasi CMS (login / me)
// ==============================

app.use("/api/auth", authRouter);


// ==============================
// CMS (upload, daftar file,
// approve/reject, user, log)
// Semua endpoint wajib login.
// ==============================

app.use("/api/cms", cmsRouter);


// ==============================
// Chat RAG (publik)
// ==============================

app.use("/api/chat", chatRouter);


// ==============================
// Dokumentasi API (OpenAPI + UI)
// Menyediakan /api/docs (UI) dan
// /api/docs.json (spesifikasi).
// ==============================

app.use("/api", docsRouter);

// ==============================
// Cek Environment
// ==============================

console.log(
    "OPENROUTER KEY:",
    process.env.OPENROUTER_API_KEY
        ? "TERBACA"
        : "TIDAK TERBACA"
);


// ==============================
// Health Check
// ==============================

app.get("/api/health", (req, res) => {


    res.json({

        status:
        "OK"

    });


});


// ==============================
// Daftar Model (untuk dropdown)
// ==============================

app.get("/api/models", (req, res) => {

    res.json({

        default: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",

        models: MODEL_CATALOG

    });

});


// ==============================
// Preview PDF dokumen (untuk menampilkan
// sumber referensi di frontend chat)
// Hanya file dari folder docs yang dilayani
// (guard terhadap path traversal).
// ==============================

app.get("/api/documents", (req, res) => {

    try {

        const files =
        fs.readdirSync(DOCS_FOLDER)
        .filter(
            file =>
            file.toLowerCase().endsWith(".pdf")
        )
        .sort();

        res.json({
            files
        });

    }
    catch(error){

        console.log(
            "Gagal membaca daftar dokumen:",
            error.message
        );

        res.status(500).json({
            error: "Gagal membaca daftar dokumen."
        });

    }

});


app.get("/api/documents/:filename", (req, res) => {

    const safeName = path.basename(req.params.filename);

    if (!safeName.toLowerCase().endsWith(".pdf")) {

        return res.status(400).json({ error: "Hanya file PDF yang dilayani." });

    }

    const filePath = path.join(DOCS_FOLDER, safeName);

    if (!fs.existsSync(filePath)) {

        return res.status(404).json({ error: "Dokumen tidak ditemukan." });

    }

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeName)}"`);

    fs.createReadStream(filePath).pipe(res);

});


// ==============================
// Statistik publik (ringan, untuk
// halaman utama: jumlah dokumen &
// vektor yang tersedia)
// ==============================

app.get("/api/stats", async (req, res) => {

    try {

        const files = readJson("files", []);

        const approved = files.filter((f) => f.status === "approved");

        res.json({
            documents: {
                total: files.length,
                approved: approved.length
            },
            vectors: await countVectors()
        });

    }

    catch (error) {

        res.status(500).json({
            error: "Gagal membaca statistik: " + error.message
        });

    }

});


// ==============================
// Error Handler (multer: batas ukuran dsb.)
// ==============================

app.use((err, req, res, next) => {

    if (err instanceof multer.MulterError) {

        if (err.code === "LIMIT_FILE_SIZE") {

            return res.status(413).json({
                error: "Ukuran file melebihi batas 20 MB"
            });

        }

        return res.status(400).json({
            error: err.message
        });

    }

    res.status(err.status || 500).json({
        error: err.message || "Terjadi kesalahan server"
    });

});


// ==============================
// Server
// ==============================

const PORT =
process.env.PORT || 3001;


// ==============================
// Warm-up model AI (embedding &
// reranker) saat server start.
//
// Model dimuat lazy oleh layanan
// masing-masing; tanpa warm-up,
// pertanyaan PERTAMA setelah
// start akan menunggu muat model
// yang bisa memakan puluhan detik
// (buruk untuk demo). Dipanggil
// setelah listen supaya server
// langsung merespons.
// ==============================

async function warmupModels() {

    try {

        console.log("\n===== WARMUP MODEL =====");

        if (process.env.WARMUP_MODELS === "off") {

            console.log("Warm-up dinonaktifkan (WARMUP_MODELS=off)");

            return;

        }

        await createEmbedding("passage: warmup");

        console.log("Embedding model: siap");

        await rerankDocuments("warmup", ["warmup"]);

        console.log("Reranker model: siap");

        console.log("===== WARMUP SELESAI =====\n");

    }
    catch(error){

        console.log(
            "Warm-up model gagal (tidak fatal):",
            error.message
        );

    }

}

// Pastikan user admin default tersedia
// sebelum server menerima permintaan.
ensureDefaultAdmin();

// Pulihkan dokumen yang tertinggal status
// "processing" (restart server di tengah
// ingest) ke antrean latar belakang.
recoverProcessingJobs();



app.listen(PORT, () => {


    console.log(
        `Backend berjalan di http://localhost:${PORT}`
    );


    // Muat model di latar belakang
    // (tidak memblokir permintaan masuk)
    warmupModels();


});