import { readJson, writeJson } from "./storeService.js";
import { hashPassword } from "./authService.js";


// =====================================
// User service
// Kelola user CMS (role: admin / maintainer)
// Data: data/users.json
// =====================================


function getUsers() {

    return readJson("users", []);

}


function saveUsers(users) {

    writeJson("users", users);

}


function sanitize(user) {

    return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        createdBy: user.createdBy
    };

}


function nextId(items) {

    return items.reduce(
        (max, item) =>
        Math.max(max, Number(item.id) || 0),
        0
    ) + 1;

}


// Admin default pertama (dipanggil saat server start).
// Password diambil dari .env (DEFAULT_ADMIN_PASSWORD).
// Bila tidak di-set, admin TIDAK dibuat otomatis
// (lebih aman daripada memakai password hardcoded).
export function ensureDefaultAdmin() {

    const users = getUsers();

    if (users.length === 0) {

        const password =
        process.env.DEFAULT_ADMIN_PASSWORD;

        if (!password || password.length < 6) {

            console.warn(
                "[PENTING] Belum ada user admin di data/users.json " +
                "dan DEFAULT_ADMIN_PASSWORD belum di-set di .env. " +
                "Set DEFAULT_ADMIN_PASSWORD=<min 6 karakter> lalu mulai ulang server."
            );

            return;

        }

        users.push({
            id: 1,
            username: "admin",
            passwordHash: hashPassword(password),
            role: "admin",
            createdAt: new Date().toISOString(),
            createdBy: "system"
        });

        saveUsers(users);

        console.log(
            "User admin default dibuat dari DEFAULT_ADMIN_PASSWORD " +
            "(segera ganti lewat menu CMS bila perlu)."
        );

    }

}


export function listUsers() {

    return getUsers().map(sanitize);

}


export function findUserByUsername(username) {

    return getUsers().find(
        user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

}


export function createUser({ username, password, role, createdBy }) {

    if (!username || !String(username).trim()) {

        return { error: "Username wajib diisi" };

    }

    if (!["admin", "maintainer"].includes(role)) {

        return { error: "Role harus admin atau maintainer" };

    }

    if (!password || password.length < 6) {

        return { error: "Password minimal 6 karakter" };

    }

    const users = getUsers();

    if (
        users.some(
            user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
        )
    ) {

        return { error: "Username sudah dipakai" };

    }

    const user = {
        id: nextId(users),
        username: String(username).trim(),
        passwordHash: hashPassword(password),
        role,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || "system"
    };

    users.push(user);
    saveUsers(users);

    return { user: sanitize(user) };

}


export function updateUser(id, { password, role }) {

    const users = getUsers();

    const user = users.find(
        item => item.id === Number(id)
    );

    if (!user) {

        return { error: "User tidak ditemukan" };

    }

    if (role !== undefined) {

        if (!["admin", "maintainer"].includes(role)) {

            return { error: "Role harus admin atau maintainer" };

        }

        // Jangan biarkan admin terakhir turun role
        if (
            user.role === "admin" &&
            role !== "admin"
        ){

            const adminLeft = users.some(
                item =>
                item.id !== user.id &&
                item.role === "admin"
            );

            if (!adminLeft) {

                return { error: "Minimal harus ada satu user admin" };

            }

        }

        user.role = role;

    }

    if (password) {

        if (password.length < 6) {

            return { error: "Password minimal 6 karakter" };

        }

        user.passwordHash = hashPassword(password);

    }

    saveUsers(users);

    return { user: sanitize(user) };

}


export function deleteUser(id) {

    const users = getUsers();

    const index = users.findIndex(
        item => item.id === Number(id)
    );

    if (index === -1) {

        return { error: "User tidak ditemukan" };

    }

    const [ removed ] = users.splice(index, 1);

    // Pastikan minimal satu admin tetap ada
    if (removed.role === "admin") {

        const adminLeft = users.some(
            item => item.role === "admin"
        );

        if (!adminLeft) {

            return { error: "Minimal harus ada satu user admin" };

        }

    }

    saveUsers(users);

    return { user: sanitize(removed) };

}