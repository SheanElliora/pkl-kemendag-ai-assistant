import { verifyToken } from "../services/authService.js";


// =====================================
// Middleware autentikasi & role
// Dipasang pada endpoint CMS.
// =====================================


function getToken(req) {

    const auth = req.headers.authorization || "";

    return auth.startsWith("Bearer ")
        ? auth.slice(7)
        : "";

}


export function requireAuth(req, res, next) {

    const token = getToken(req);

    const payload = verifyToken(token);

    if (!payload) {

        return res.status(401).json({
            error: "Silakan login terlebih dahulu"
        });

    }

    req.user = payload;

    next();

}


export function requireRole(...roles) {

    return (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({
                error: "Silakan login terlebih dahulu"
            });

        }

        if (!roles.includes(req.user.role)) {

            return res.status(403).json({
                error: "Hak akses ditolak"
            });

        }

        next();

    };

}