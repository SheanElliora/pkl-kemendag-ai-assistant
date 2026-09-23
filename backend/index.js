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
import { getSystemStats } from "./services/analyticsService.js";
import { availableModels, defaultModelId } from "./services/modelCatalog.js";
import { createEmbedding } from "./services/embedderService.js";
import { rerankDocuments } from "./services/rerankerService.js";
import { readJson } from "./services/storeService.js";
import { countVectors } from "./services/vectorStorage.js";

const app = express();

ensureFolders();

app.use(cors({
    origin: CORS_ORIGINS
}));

app.use(express.json());

app.use("/api/auth", authRouter);

app.use("/api/cms", cmsRouter);

app.use("/api/chat", chatRouter);

app.use("/api", docsRouter);

console.log(
    "OPENROUTER KEY:",
    process.env.OPENROUTER_API_KEY
        ? "TERBACA"
        : "TIDAK TERBACA"
);

console.log(
    "GEMINI KEY:",
    process.env.GEMINI_API_KEY
        ? "TERBACA"
        : "TIDAK TERBACA (fallback OpenRouter gratis)"
);

app.get("/api/health", (req, res) => {

    res.json({

        status:
        "OK"

    });

});

app.get("/api/models", (req, res) => {

    res.json({

        default: defaultModelId(),

        models: availableModels()

    });

});

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

app.get("/api/stats", async (req, res) => {

    try {

        const files = readJson("files", []);

        const approved = files.filter((f) => f.status === "approved");

        res.json({
            documents: {
                total: files.length,
                approved: approved.length
            },
            vectors: await countVectors(),
            analytics: getSystemStats()
        });

    }

    catch (error) {

        res.status(500).json({
            error: "Gagal membaca statistik: " + error.message
        });

    }

});

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

const PORT =
process.env.PORT || 3001;

async function warmupModels() {

    try {

        console.log("[warmup] mulai");

        if (process.env.WARMUP_MODELS === "off") {

            console.log("Warm-up dinonaktifkan (WARMUP_MODELS=off)");

            return;

        }

        await createEmbedding("passage: warmup");

        console.log("Embedding model: siap");

        await rerankDocuments("warmup", ["warmup"]);

        console.log("Reranker model: siap");

        console.log("[warmup] selesai");

    }
    catch(error){

        console.log(
            "Warm-up model gagal (tidak fatal):",
            error.message
        );

    }

}

ensureDefaultAdmin();

recoverProcessingJobs();

app.listen(PORT, () => {

    console.log(
        `Backend berjalan di http://localhost:${PORT}`
    );

    warmupModels();

});
