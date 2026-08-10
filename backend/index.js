import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";

import authRouter from "./routes/auth.js";
import cmsRouter from "./routes/cms.js";
import chatRouter from "./routes/chat.js";
import { CORS_ORIGINS, DOCS_FOLDER } from "./config.js";
import { ensureDefaultAdmin } from "./services/userService.js";
import { ensureFolders } from "./services/fileService.js";
import { MODEL_CATALOG } from "./services/modelCatalog.js";


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


// Pastikan user admin default tersedia
// sebelum server menerima permintaan.
ensureDefaultAdmin();



app.listen(PORT, () => {


    console.log(
        `Backend berjalan di http://localhost:${PORT}`
    );


});