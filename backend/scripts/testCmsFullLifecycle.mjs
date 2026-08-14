import fs from "fs";
import path from "path";

import { ChromaClient } from "chromadb";

import {
    DOCS_FOLDER
} from "../config.js";


// =====================================
// Tes otomatis END-TO-END CMS
// -------------------------------------
// Menjalankan seluruh siklus hidup CMS
// lewat HTTP API (sama seperti UI):
//
//   1. Login admin + verifikasi /me
//   2. Login GAGAL (hak akses / otorisasi)
//   3. Buat user maintainer (kelola user)
//   4. Login maintainer
//   5. Maintainer coba menu admin -> 403
//   6. Upload PDF -> status pending
//   7. Maintainer lihat dokumennya sendiri
//   8. Admin APPROVE -> ingest (OCR+chunk+embed)
//   9. Verifikasi file di docs + Chroma
//  10. Upload PDF kedua -> REJECT + alasan
//  11. DELETE dokumen approved (vektor ikut bersih)
//  12. Lihat log login
//  13. Hapus user tes
//  14. Sinkronisasi ulang (ganti role) -> kembali
//  15. (Opsional) Tes chat RAG
//
// SCRIPT INI MEMBERSIHKAN DIRI: seluruh
// record & file tes dibuang dari system di
// akhir, sehingga aman dijalankan berulang
// tanpa mengotori data asli.
//
// Cara pakai (dari folder backend/):
//   node scripts/testCmsFullLifecycle.mjs
// =====================================


const BASE = "http://127.0.0.1:3001";

const TS = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19)
    .replace("T", "_");

// Semua nama artefak tes diawali prefix unik
// agar mudah dikenali & dibersihkan.
const TES_PREFIX = `Tes_CMS_${TS}`;
const TEST_PDF_1 = `${TES_PREFIX}_A.pdf`;
const TEST_PDF_2 = `${TES_PREFIX}_B.pdf`;

// Dokumen sumber uji diambil dari folder docs
// yang sudah ada (regulasi, ringan).
const SRC_PDF = "PERMENDAG NOMOR 28 TAHUN 2024.pdf";

const TES_USERNAME = `${TES_PREFIX}_maintainer`;
const TES_PASSWORD = "TesCms2026";

const COLLECTION = "sip_documents";


// ---- Output PASS / FAIL terpusat ----

const results = [];

function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
    console.log(
        `${ok ? "  [PASS]" : "  [FAIL]"} ${name}${detail ? "  -> " + detail : ""}`
    );
}

function fail(name, detail) {
    record(name, false, detail);
}

// Eksekusi satu langkah. Bila `optional` benar,
// kegagalan hanya dicatat, tidak menghentikan script.
async function step(name, fn, optional = false) {
    try {
        await fn();
    }
    catch (error) {
        if (optional) {
            record(name + " [opsional]", false, error.message);
        }
        else {
            fail(name, error.message || String(error));
            throw error;
        }
    }
}


// ---- Utilitas ----

function readEnv(key) {
    const env = fs.readFileSync(".env", "utf8");
    const m = env.match(new RegExp(key + "=(.+)"));
    return m ? m[1].trim() : null;
}

async function api(pathname, { method = "GET", token, body, headers = {} } = {}) {
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const opts = { method, headers };
    if (body) {
        opts.body = body;
    }
    const res = await fetch(BASE + pathname, opts);
    let json = null;
    try {
        json = await res.json();
    }
    catch {}
    return { status: res.status, json };
}

function loginBody(username, password) {
    return {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    };
}


// =====================================
// Alur utama
// =====================================

async function main() {

    console.log(`\n===== TES CMS END-TO-END (${TS}) =====\n`);


    // 1) Login admin
    const adminPass = readEnv("DEFAULT_ADMIN_PASSWORD");
    if (!adminPass) {
        fail("Login admin", "DEFAULT_ADMIN_PASSWORD tidak ditemukan di backend/.env");
        throw new Error("DEFAULT_ADMIN_PASSWORD kosong");
    }

    const adminLogin = await api("/api/auth/login", loginBody("admin", adminPass));
    if (adminLogin.status !== 200) {
        fail("Login admin", JSON.stringify(adminLogin.json));
        throw new Error("Login admin gagal");
    }
    const adminToken = adminLogin.json.token;
    record("Login admin", true, adminLogin.json.user?.role);

    const me = await api("/api/auth/me", { token: adminToken });
    record("GET /api/auth/me", me.status === 200 && me.json.user?.username === "admin", `(${me.status})`);

    // 2) Login GAGAL harus ditolak (401)
    const badLogin = await api("/api/auth/login", loginBody("admin", "salah_password"));
    record("Login dengan password salah ditolak", badLogin.status === 401, `(${badLogin.status})`);


    // 3) Buat user maintainer tes
    const createUser = await api("/api/cms/users", {
        method: "POST",
        token: adminToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: TES_USERNAME,
            password: TES_PASSWORD,
            role: "maintainer"
        })
    });
    if (createUser.status !== 200) {
        fail("Buat user maintainer", JSON.stringify(createUser.json));
        throw new Error("Buat user maintainer gagal");
    }
    const tesUserId = createUser.json.user.id;
    record("Buat user maintainer", true, `${TES_USERNAME} (id ${tesUserId})`);

    // 3b. Buat user dgn password pendek harus ditolak
    const badUser = await api("/api/cms/users", {
        method: "POST",
        token: adminToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "tes_pendek", password: "123", role: "maintainer" })
    });
    record("Tolak user berpassword < 6", badUser.status === 400, `(${badUser.status})`);


    // 4) Login maintainer
    const mantLogin = await api("/api/auth/login", loginBody(TES_USERNAME, TES_PASSWORD));
    if (mantLogin.status !== 200) {
        fail("Login maintainer", JSON.stringify(mantLogin.json));
        throw new Error("Login maintainer gagal");
    }
    const mantToken = mantLogin.json.token;
    record("Login maintainer", true, mantLogin.json.user?.role);


    // 5) Maintainer tidak boleh akses menu admin (403)
    const deniedUsers = await api("/api/cms/users", { token: mantToken });
    record("Maintainer dilarang akses /users", deniedUsers.status === 403, `(${deniedUsers.status})`);

    const deniedLogs = await api("/api/cms/login-logs", { token: mantToken });
    record("Maintainer dilarang akses /login-logs", deniedLogs.status === 403, `(${deniedLogs.status})`);


    // 6) Siapkan & upload PDF uji (yang pertama)
    const uploadsDir = path.join(path.dirname("."), "uploads");
    const localPath1 = path.join(uploadsDir, TEST_PDF_1);
    const localPath2 = path.join(uploadsDir, TEST_PDF_2);

    fs.copyFileSync(path.join(DOCS_FOLDER, SRC_PDF), localPath1);
    fs.copyFileSync(path.join(DOCS_FOLDER, SRC_PDF), localPath2);

    function formFor(pdf, label) {
        const blob = new Blob(
            [ fs.readFileSync(pdf) ],
            { type: "application/pdf" }
        );
        const fd = new FormData();
        fd.append("file", blob, label);
        return fd;
    }

    const up1 = await api("/api/cms/upload", { method: "POST", token: mantToken, body: formFor(localPath1, TEST_PDF_1) });
    if (up1.status !== 200) {
        fail("Upload PDF #1", JSON.stringify(up1.json));
        throw new Error("Upload #1 gagal");
    }
    const fileId1 = up1.json.fileId;
    record("Upload PDF #1 (pending)", up1.json.status === "pending", `fileId ${fileId1}`);


    // 6b. Upload PDF kedua (untuk di-reject nanti)
    const up2 = await api("/api/cms/upload", { method: "POST", token: mantToken, body: formFor(localPath2, TEST_PDF_2) });
    if (up2.status !== 200) {
        fail("Upload PDF #2", JSON.stringify(up2.json));
        throw new Error("Upload #2 gagal");
    }
    const fileId2 = up2.json.fileId;
    record("Upload PDF #2 (pending)", up2.json.status === "pending", `fileId ${fileId2}`);


    // 6c. Upload FILE NON-PDF harus ditolak
    const fake = new Blob(["bukan pdf"], { type: "text/plain" });
    const fdFake = new FormData();
    fdFake.append("file", fake, `${TES_PREFIX}_bukanpdf.txt`);
    const badUp = await api("/api/cms/upload", { method: "POST", token: mantToken, body: fdFake });
    record("Upload non-PDF ditolak", badUp.status === 400, `(${badUp.status})`);


    // 7) Maintainer melihat dokumennya sendiri (ada 2 file)
    const mantFiles = await api("/api/cms/files", { token: mantToken });
    const mantOwn = (mantFiles.json.files || []).filter(
        f => f.uploadedBy === TES_USERNAME
    );
    record(
        "Maintainer melihat dokumen sendiri",
        mantOwn.length === 2 && mantOwn.every(f => f.status === "pending"),
        `${mantOwn.length} file pending`
    );


    // 8) Admin APPROVE dokumen #1 (ingest dijalankan server)
    let appr1;
    try {
        appr1 = await api(`/api/cms/files/${fileId1}/approve`, { method: "POST", token: adminToken });
    }
    catch (error) {
        fail("Approve #1", error.message);
        throw error;
    }
    const apprStatus = appr1.json?.file?.status;
    record(
        "Approve #1 -> approved (ingest)",
        appr1.status === 200 && apprStatus === "approved",
        `status=${apprStatus}${appr1.json?.file?.error ? " · err=" + appr1.json.file.error.slice(0, 60) : ""}`
    );


    // 9) Verifikasi file fisik & vektor di Chroma
    record(
        "File #1 ada di folder docs",
        fs.existsSync(path.join(DOCS_FOLDER, TEST_PDF_1))
    );

    await checkChroma(TEST_PDF_1, "Chunk #1 tersimpan di Chroma");


    // 10) REJECT dokumen #2 + alasan
    const rej = await api(`/api/cms/files/${fileId2}/reject`, {
        method: "POST",
        token: adminToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Dokumen uji otomatis - bukan dokumen resmi" })
    });
    record(
        "Reject #2 -> rejected (dengan alasan)",
        rej.status === 200 && rej.json.file?.status === "rejected",
        `status=${rej.json?.file?.status}`
    );

    record(
        "File #2 sudah tidak ada di uploads",
        !fs.existsSync(localPath2)
    );


    // 11) DELETE dokumen #1 yang sudah approved
    const del1 = await api(`/api/cms/files/${fileId1}`, { method: "DELETE", token: adminToken });
    record(
        "Delete #1 -> deleted",
        del1.status === 200 && del1.json.file?.status === "deleted",
        `status=${del1.json?.file?.status}`
    );

    record(
        "File #1 tidak ada lagi di docs",
        !fs.existsSync(path.join(DOCS_FOLDER, TEST_PDF_1))
    );

    await checkChroma(TEST_PDF_1, "Vektor #1 hilang dari Chroma", true);


    // 12) Log login mencatat aktivitas admin & maintainer
    const logs = await api("/api/cms/login-logs", { token: adminToken });
    const logUsers = new Set((logs.json.logs || []).map(l => l.username));
    record(
        "Log login berisi admin & user tes",
        logUsers.has("admin") && logUsers.has(TES_USERNAME),
        `${(logs.json.logs || []).length} entri`
    );

    // pastikan login yang GAGAL tadi juga tercatat
    const hasFailed = (logs.json.logs || []).some(l => l.status === "failed");
    record("Log mencatat percobaan login gagal", hasFailed);


    // 13) Kelola user: ganti role (maintainer -> admin -> maintainer)
    const upRole = await api(`/api/cms/users/${tesUserId}`, {
        method: "PUT",
        token: adminToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" })
    });
    record("Ubah role user -> admin", upRole.status === 200 && upRole.json.user?.role === "admin", `(${upRole.status})`);

    const downRole = await api(`/api/cms/users/${tesUserId}`, {
        method: "PUT",
        token: adminToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "maintainer" })
    });
    record("Ubah role user -> maintainer", downRole.status === 200 && downRole.json.user?.role === "maintainer", `(${downRole.status})`);


    // 14) Hapus user tes
    const delUser = await api(`/api/cms/users/${tesUserId}`, { method: "DELETE", token: adminToken });
    record("Hapus user tes", delUser.status === 200, `(${delUser.status})`);


    // 15) (Opsional) Tes chat RAG - cek sistem merespons
    await step("Chat RAG (opsional, butuh API key)", async () => {
        const chat = await api("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Apa isi PERMENDAG Nomor 28 Tahun 2024?",
                stream: false
            })
        });
        const ok = chat.status === 200 && (chat.json.reply || "").trim().length > 0;
        record(
            "Chat RAG menjawab",
            ok,
            `(${chat.status}) ${ok ? "reply " + chat.json.reply.length + " karakter, " + (chat.json.sources || []).length + " sumber" : JSON.stringify(chat.json).slice(0, 80)}`
        );
    }, true); // opsional: kegagalan tidak menghentikan script


    // =====================================
    // Bersihkan jejak di files.json
    // =====================================

    const filesPath = path.join(path.dirname("."), "data", "files.json");
    let files = JSON.parse(fs.readFileSync(filesPath, "utf8"));
    const before = files.length;

    files = files.filter(
        f => !(
            [TEST_PDF_1, TEST_PDF_2].includes(f.originalName) ||
            f.uploadedBy === TES_USERNAME ||
            String(f.originalName || "").startsWith(TES_PREFIX + "_")
        )
    );

    fs.writeFileSync(filesPath, JSON.stringify(files, null, 2), "utf8");
    record("files.json bersih (record tes dibuang)", files.length < before, `${before} -> ${files.length}`);


    // Bersihkan sisa fisik kalau ada yang tertinggal
    [localPath1, localPath2].forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    const docPath = path.join(DOCS_FOLDER, TEST_PDF_1);
    if (fs.existsSync(docPath)) fs.unlinkSync(docPath);


    // Ringkasan
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    console.log("\n=====================================");
    console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
    console.log("=====================================\n");

    if (failed > 0) {
        process.exitCode = 1;
    }
    else {
        console.log("===== SELURUH TES CMS LULUS =====");
    }
}


// =====================================
// Verifikasi jumlah chunk di Chroma
// =====================================

async function checkChroma(filename, label, expectEmpty = false) {
    try {
        const client = new ChromaClient();
        const col = await client.getCollection({
            name: COLLECTION,
            embeddingFunction: null
        });
        const got = await col.get({ where: { filename } });
        const count = (got.ids || []).length;
        const ok = expectEmpty ? count === 0 : count > 0;
        record(label, ok, `${count} chunk`);
    }
    catch (error) {
        record(label, false, error.message);
        console.log("        (tidak fatal: server Chroma di localhost:8000 mungkin belum dijalankan)");
    }
}

main().catch(error => {
    console.error("\n===== TES GAGAL DI TENGAH JALAN =====");
    console.error(error);

    // Tetap laporkan ringkasan walau error
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`\nHasil parsial: ${passed} PASS, ${failed} FAIL`);

    process.exitCode = 1;
});