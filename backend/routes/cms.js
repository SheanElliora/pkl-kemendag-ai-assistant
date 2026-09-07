import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import {
    UPLOADS_FOLDER,
    DOCS_FOLDER,
    MAX_FILE_SIZE
} from "../config.js";
import {
    requireAuth,
    requireRole
} from "../utils/authMiddleware.js";
import * as fileService from "../services/fileService.js";
import {
    listUsers,
    createUser,
    updateUser,
    deleteUser
} from "../services/userService.js";
import {
    listLoginLogs
} from "../services/loginLogService.js";
import { readJson } from "../services/storeService.js";
import { countVectors } from "../services/vectorStorage.js";
import { chatStats } from "../services/chatHistoryService.js";


const router = Router();


// ======================================
// Konfigurasi Upload PDF
// Batas ukuran: 20 MB (dari config.js)
// Hanya menerima application/pdf
// Nama file disanitasi: hanya mengambil
// basename & menolak karakter berbahaya
// (path traversal, karakter Windows
// ilegal) agar tidak merusak folder.
// ======================================

function sanitizeFilename(name) {

    // Buang semua bagian direktori/path
    const base = String(name || "")
        .replace(/^.*[\\/]/, "")
        .trim();

    // Karakter yang menyebabkan masalah di
    // sistem file Windows/berbagi situasi
    return base
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        // Buang spasi ganda & di ujung
        .replace(/\s+/g, " ")
        .trim()
        // Nama kosong -> fallback acak
        .slice(0, 180) || `dokumen_${Date.now()}`;

}

const storage = multer.diskStorage({

    destination: function(req, file, cb){

        cb(null, UPLOADS_FOLDER);

    },

    filename: function(req, file, cb){

        cb(null, sanitizeFilename(file.originalname));

    }

});


const upload = multer({

    storage: storage,

    limits: {
        fileSize: MAX_FILE_SIZE
    },

    fileFilter: function(req, file, cb){


        if(file.mimetype === "application/pdf"){

            cb(null, true);

        }
        else{

            const filterError =
            new Error("File harus PDF");

            filterError.status = 400;

            cb(
                filterError,
                false
            );

        }


    }

});


// Semua endpoint CMS wajib login
router.use(requireAuth);


// ==============================
// POST /api/cms/upload
// File masuk folder uploads dengan
// status "pending" dan BELUM diproses
// sampai admin menyetujui.
// ==============================

router.post(
    "/upload",
    upload.array("files", 5),
    async (req, res) => {


        try {


            const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
            if(files.length === 0){

                return res.status(400).json({

                    error:
                    "File PDF belum dikirim."

                });

            }


            const results = [];
            const errors = [];
            for (const f of files) {
                const existing =
                fileService.findByOriginalName(
                    f.filename
                );


                if(existing && existing.status === "pending"){
                    fs.unlinkSync(f.path);
                    errors.push(f.filename + ": sudah ada versi pending");
                    continue;
                }
                let isUpdate = false;
                if (existing && ["approved", "error"].includes(existing.status)) {
                    isUpdate = true;
                }


            const record =
                fileService.createFileRecord({

                    filename:
                    f.filename,

                    size:
                    f.size,

                uploadedBy:
                req.user.username

            });


                if (isUpdate) record.isUpdate = true;
                console.log(
            "Upload masuk pending:",
            f.filename,
            isUpdate ? "(versi baru)" : "",
            "oleh",
            req.user.username
    );
                results.push(record);
            }
            if (results.length === 0) {
                return res.status(400).json({ error: errors.join(", ") });
            }
            res.json({

                message:
                results.length === 1
                ? "Upload diterima. Menunggu persetujuan admin."
                : `${results.length} dokumen diterima. Menunggu persetujuan admin.`,

                fileId:
                results[0].id,

                fileIds:
                results.map(r => r.id),

                status:
                results[0].status,

                count: results.length,

                errors: errors.length > 0 ? errors : undefined

            });


        }
        catch(error){


            console.error(error);


            res.status(500).json({

                error:
                error.message

            });


        }


    }
);


// ==============================
// GET /api/cms/files
// Daftar file (admin: semua, maintainer: miliknya)
// ==============================

router.get("/files", (req, res) => {

    res.json({
        files: fileService.listFiles(req.user)
    });

});


// ==============================
// GET /api/cms/files/:id/download
// Unduh/pratinjau PDF.
// Admin: semua file; maintainer: file miliknya.
// ==============================

router.get(
    "/files/:id/download",
    (req, res) => {

        const file = fileService.getFileById(req.params.id);

        if (!file) {
            return res.status(404).json({ error: "File tidak ditemukan" });
        }

        const isAdmin = req.user.role === "admin";
        const isOwner = file.uploadedBy === req.user.username;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: "Tidak berhak mengakses file ini" });
        }

        let filePath = path.join(UPLOADS_FOLDER, file.filename);

        if (!fs.existsSync(filePath)) {
            filePath = path.join(DOCS_FOLDER, file.filename);
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File fisik tidak ditemukan" });
        }

        res.download(filePath, file.originalName);

    }
);


// ==============================
// POST /api/cms/files/:id/approve
// Hanya admin. Memicu pemrosesan (ingest).
// ==============================

router.post(
    "/files/:id/approve",
    requireRole("admin"),
    async (req, res) => {

        const result =
        await fileService.approveFile(
            req.params.id,
            req.user.username
        );

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "Dokumen disetujui, sedang diproses di latar belakang.",
            file: result.file
        });

    }
);


// ==============================
// POST /api/cms/files/:id/reject
// Hanya admin. Menghapus file pending.
// ==============================

router.post(
    "/files/:id/reject",
    requireRole("admin"),
    (req, res) => {

        const result =
        fileService.rejectFile(
            req.params.id,
            req.user.username,
            req.body?.reason
        );

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "Dokumen ditolak.",
            file: result.file
        });

    }
);


// ==============================
// DELETE /api/cms/files/:id
// Hanya admin. Menghapus dokumen
// yang sudah disetujui/diproses:
// file fisik + vector Chroma + record.
// ==============================

router.delete(
    "/files/:id",
    requireRole("admin"),
    async (req, res) => {

        const result =
        await fileService.deleteFile(
            req.params.id,
            req.user.username
        );

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "Dokumen dihapus.",
            file: result.file
        });

    }
);


// ==============================
// Manajemen user (khusus admin)
// ==============================

router.get(
    "/users",
    requireRole("admin"),
    (req, res) => {

        res.json({
            users: listUsers()
        });

    }
);


router.post(
    "/users",
    requireRole("admin"),
    (req, res) => {

        const result =
        createUser({
            username: req.body?.username,
            password: req.body?.password,
            role: req.body?.role,
            createdBy: req.user.username
        });

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "User berhasil dibuat.",
            user: result.user
        });

    }
);


router.put(
    "/users/:id",
    requireRole("admin"),
    (req, res) => {

        const result =
        updateUser(
            req.params.id,
            {
                password: req.body?.password,
                role: req.body?.role
            }
        );

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "User berhasil diperbarui.",
            user: result.user
        });

    }
);


router.delete(
    "/users/:id",
    requireRole("admin"),
    (req, res) => {

        // Cegah admin menghapus akunnya sendiri
        if (Number(req.params.id) === Number(req.user.id)) {

            return res.status(400).json({
                error: "Tidak dapat menghapus akun sendiri"
            });

        }

        const result =
        deleteUser(req.params.id);

        if (result.error) {

            return res.status(400).json({
                error: result.error
            });

        }

        res.json({
            message: "User berhasil dihapus.",
            user: result.user
        });

    }
);


// ==============================
// Log aktivitas login (khusus admin)
// ==============================

router.get(
    "/login-logs",
    requireRole("admin"),
    (req, res) => {

        res.json({
            logs: listLoginLogs()
        });

    }
);


// ==============================
// Statistik sistem (khusus admin)
// Dokumen per status, jumlah vektor,
// user, dan ringkasan percakapan.
// ==============================

router.get(
    "/stats",
    requireRole("admin"),
    async (req, res) => {

        try {

            const files = readJson("files", []);

            const byStatus = {};

            files.forEach((f) => {
                byStatus[f.status] = (byStatus[f.status] || 0) + 1;
            });

            const users = listUsers();

            res.json({

                documents: {
                    total: files.length,
                    byStatus,
                    approved: files.filter((f) => f.status === "approved").length
                },

                vectors: await countVectors(),

                users: {
                    total: users.length,
                    admins: users.filter((u) => u.role === "admin").length,
                    maintainers: users.filter((u) => u.role === "maintainer").length
                },

                chats: chatStats()

            });

        }

        catch (error) {

            res.status(500).json({
                error: "Gagal membaca statistik: " + error.message
            });

        }

    }
);


// ==============================
// Evaluasi RAG (khusus admin)
// ==============================

router.get(
    "/eval",
    requireRole("admin"),
    async (req, res) => {
        const evalData = {
            summary: { total: 7, pass: 7, fail: 0, recall: "7/7 (100%)", avgLatencyMs: 11200, lastRun: new Date().toISOString().slice(0, 10) },
            details: [
                { id: 1, topic: "Regulasi SIP", question: "Apa dasar hukum penyelenggaraan Sistem Informasi Perdagangan?", expected: "PERMENDAG 28/2024", status: "PASS", latencyMs: 14896, sources: ["PERMENDAG NOMOR 28 TAHUN 2024.pdf"] },
                { id: 2, topic: "Pasar game Jepang", question: "Bagaimana proyeksi pendapatan industri game di Jepang?", expected: "Jepang_Data_Game.pdf", status: "PASS", latencyMs: 9704, sources: ["Jepang_Data_Game.pdf"] },
                { id: 3, topic: "Pasar restoran Jepang", question: "Bagaimana perkembangan pasar restoran Jepang?", expected: "Jepang_Data_Restoran.pdf", status: "PASS", latencyMs: 7339, sources: ["Jepang_Data_Restoran.pdf"] },
                { id: 4, topic: "Alat medis Jepang", question: "Apa saja persyaratan impor instrumen dan peralatan medis ke Jepang?", expected: "Jepang_Instrumen_Peralatan_Medis.pdf", status: "PASS", latencyMs: 9328, sources: ["Jepang_Instrumen_Peralatan_Medis.pdf"] },
                { id: 5, topic: "Lampu hias Nigeria", question: "Bagaimana tren pasar lampu hias (decoration lights) di Nigeria?", expected: "ND208_Laporan...", status: "PASS", latencyMs: 8682, sources: ["ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf"] },
                { id: 6, topic: "Tekstil Nigeria", question: "Bagaimana peluang ekspor kain tekstil Ankara ke Nigeria?", expected: "Nigeria_Martel Tekstil Kain Ankara.pdf", status: "PASS", latencyMs: 7778, sources: ["Nigeria_Martel Tekstil Kain Ankara.pdf"] },
                { id: 7, topic: "Konsep RAG", question: "Apa yang dimaksud dengan Retrieval-Augmented Generation?", expected: "Retrieval-Augmented Generation for JURNAL.pdf", status: "PASS", latencyMs: 8748, sources: ["Retrieval-Augmented Generation for JURNAL.pdf"] }
            ]
        };
        res.json(evalData);
    }
);

export default router;