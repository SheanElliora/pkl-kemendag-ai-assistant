import { Router } from "express";
import multer from "multer";
import fs from "fs";

import {
    UPLOADS_FOLDER,
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


const router = Router();


// ======================================
// Konfigurasi Upload PDF
// Batas ukuran: 20 MB (dari config.js)
// Hanya menerima application/pdf
// ======================================

const storage = multer.diskStorage({

    destination: function(req, file, cb){

        cb(null, UPLOADS_FOLDER);

    },

    filename: function(req, file, cb){

        cb(null, file.originalname);

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
    upload.single("file"),
    async (req, res) => {


        try {


            if(!req.file){

                return res.status(400).json({

                    error:
                    "File PDF belum dikirim."

                });

            }


            // Cegah file ganda dengan nama sama
            // (pending atau approved)
            const existing =
            fileService.findByOriginalName(
                req.file.filename
            );


            if(
                existing &&
                ["pending", "approved"].includes(
                    existing.status
                )
            ){

                fs.unlinkSync(req.file.path);

                return res.status(400).json({

                    error:
                    "Dokumen dengan nama tersebut sudah ada. Gunakan nama lain."

                });

            }


            const record =
            fileService.createFileRecord({

                filename:
                req.file.filename,

                size:
                req.file.size,

                uploadedBy:
                req.user.username

            });


            console.log(
        "Upload masuk pending:",
        req.file.filename,
        "oleh",
        req.user.username
);


            res.json({

                message:
                "Upload diterima. Menunggu persetujuan admin.",

                fileId:
                record.id,

                status:
                record.status

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
            message: "Dokumen disetujui dan diproses.",
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


export default router;