import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";


// =====================================
// Auth service
// - hash password (bcrypt)
// - sign & verify JWT
//
// JWT_SECRET WAJIB diisi di file .env.
// Tanpa itu, server ditolak start demi
// keamanan (tidak ada fallback hardcoded).
// =====================================


const JWT_SECRET =
process.env.JWT_SECRET;


if (!JWT_SECRET) {

    console.error(
        "[KEAMANAN] JWT_SECRET belum di-set di file .env."
    );

    console.error(
        "Buat baris: JWT_SECRET=<string acak panjang>"
    );

    process.exit(1);

}


const JWT_EXPIRES = "12h";


export function hashPassword(password) {

    return bcrypt.hashSync(password, 10);

}


export function verifyPassword(password, hash) {

    return bcrypt.compareSync(password, hash);

}


export function signToken(user) {

    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );

}


export function verifyToken(token) {

    try {

        return jwt.verify(token, JWT_SECRET);

    }
    catch {

        return null;

    }

}