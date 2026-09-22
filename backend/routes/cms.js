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

function sanitizeFilename(name) {

    const base = String(name || "")
        .replace(/^.*[\\/]/, "")
        .trim();

    return base
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")

        .replace(/\s+/g, " ")
        .trim()

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

router.use(requireAuth);

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

router.get("/files", (req, res) => {

    res.json({
        files: fileService.listFiles(req.user)
    });

});

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

router.get(
    "/login-logs",
    requireRole("admin"),
    (req, res) => {

        res.json({
            logs: listLoginLogs()
        });

    }
);

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

export default router;
