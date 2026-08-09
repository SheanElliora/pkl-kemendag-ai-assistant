import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
    signToken,
    verifyToken,
    verifyPassword
} from "../services/authService.js";
import {
    findUserByUsername
} from "../services/userService.js";
import {
    addLoginLog
} from "../services/loginLogService.js";


const router = Router();


// ==============================
// Rate limit khusus halaman login
// 10 percobaan per 15 menit per IP
// untuk mempersulit brute-force.
// ==============================

const loginLimiter = rateLimit({

    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi."
    }

});


// ==============================
// POST /api/auth/login
// ==============================

router.post("/login", loginLimiter, (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {

        return res.status(400).json({
            error: "Username dan password wajib diisi"
        });

    }

    const user = findUserByUsername(username);

    if (!user || !verifyPassword(password, user.passwordHash)) {

        // Catat percobaan GAGAL (status failed) untuk audit
        addLoginLog({
            userId: user ? user.id : null,
            username: username || "(kosong)",
            userAgent: req.headers["user-agent"],
            status: "failed"
        });

        return res.status(401).json({
            error: "Username atau password salah"
        });

    }

    // Catat aktivitas login (device/browser/OS dari User-Agent)
    addLoginLog({
        userId: user.id,
        username: user.username,
        userAgent: req.headers["user-agent"]
    });

    const token = signToken(user);

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role
        }
    });

});


// ==============================
// GET /api/auth/me
// Cek token masih valid & ambil data user
// ==============================

router.get("/me", (req, res) => {

    const auth = req.headers.authorization || "";

    const token = auth.startsWith("Bearer ")
        ? auth.slice(7)
        : "";

    const payload = verifyToken(token);

    if (!payload) {

        return res.status(401).json({
            error: "Token tidak valid atau sudah kedaluwarsa"
        });

    }

    res.json({
        user: {
            id: payload.id,
            username: payload.username,
            role: payload.role
        }
    });

});


export default router;