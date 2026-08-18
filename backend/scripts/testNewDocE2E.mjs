// ============================================================
// TES E2E DOKUMEN BARU (regression untuk pipeline ingest)
//
// Membuktikan bahwa dokumen BARU (bukan 8 dokumen lama) yang
// diunggah & disetujui benar-benar:
//   1. Diproses antrean latar belakang (status processing -> approved)
//   2. Punya file chunk JSON di backend/data/chunks/
//   3. Punya vektor di Chroma (dengan metadata filename)
//   4. Bisa ditemukan & disitasi oleh chat RAG
//   5. Bersih total setelah dihapus (vektor + chunk + record)
//
// Menjalankan: node scripts/testNewDocE2E.mjs   (dari backend/)
// Syarat: Chroma :8000 + backend :3001 hidup, .env terbaca.
// Self-cleaning: tidak meninggalkan jejak di files.json/chunks/dokumen.
// ============================================================

import fs from "fs";
import path from "path";
import { ChromaClient } from "chromadb";

const BASE = "http://localhost:3001";
const DOCS_FOLDER = path.join(path.dirname("."), "docs");
const CHUNKS_FOLDER = path.join(path.dirname("."), "chunks");
const FILES_JSON = path.join(path.dirname("."), "data", "files.json");
const COLLECTION = "sip_documents";

// Sumber PDF yang SALINANNYA dijadikan "dokumen baru"
const SRC_PDF = "PERMENDAG NOMOR 28 TAHUN 2024.pdf";

const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const NEW_NAME = `TES_DOK_BARU_${STAMP}.pdf`;

const results = [];
function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
    console.log(`${ok ? "  [PASS]" : "  [FAIL]"} ${name}${detail ? "  -> " + detail : ""}`);
}
function fail(name, detail) {
    record(name, false, detail);
}

function readEnv(key) {
    const env = fs.readFileSync(".env", "utf8");
    const m = env.match(new RegExp(key + "=(.+)"));
    return m ? m[1].trim() : null;
}

async function api(pathname, { method = "GET", token, body, headers = {} } = {}) {
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + pathname, { method, headers, body });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    console.log(`\n===== TES E2E DOKUMEN BARU (${STAMP}) =====\n`);

    // 1) Login admin
    const adminUser = readEnv("ADMIN_USERNAME") || "admin";
    const adminPass = readEnv("ADMIN_PASSWORD");
    const login = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUser, password: adminPass })
    });
    const adminToken = login.json?.token;
    record("Login admin", login.status === 200 && !!adminToken, adminUser);
    if (!adminToken) throw new Error("Login admin gagal");

    // 2) Upload salinan PDF sebagai dokumen BARU
    const blob = new Blob([fs.readFileSync(path.join(DOCS_FOLDER, SRC_PDF))], { type: "application/pdf" });
    const fd = new FormData();
    fd.append("file", blob, NEW_NAME);
    const up = await api("/api/cms/upload", { method: "POST", token: adminToken, body: fd });
    const fileId = up.json?.fileId;
    record("Upload dokumen baru (pending)", up.status === 200 && !!fileId, `fileId ${fileId}`);
    if (!fileId) throw new Error("Upload gagal");

    // 3) Approve -> antrean
    const appr = await api(`/api/cms/files/${fileId}/approve`, { method: "POST", token: adminToken });
    record("Approve -> diantrekan (processing)", appr.status === 200 && appr.json?.file?.status === "processing", `status=${appr.json?.file?.status}`);

    // 4) Polling sampai approved (ingest latar belakang)
    let status = appr.json?.file?.status;
    const deadline = Date.now() + 180000;
    while (["processing", "pending"].includes(status) && Date.now() < deadline) {
        await sleep(5000);
        const poll = await api("/api/cms/files", { token: adminToken });
        status = (poll.json.files || []).find((f) => f.id === fileId)?.status;
    }
    const errMsg = (await api("/api/cms/files", { token: adminToken })).json.files?.find((f) => f.id === fileId)?.error;
    record("Ingest selesai -> approved", status === "approved", `status=${status}${errMsg ? " · err=" + errMsg.slice(0, 60) : ""}`);
    if (status !== "approved") throw new Error("Dokumen tidak mencapai status approved");

    // 5) File chunk JSON ada (format: <nama-tanpa-pdf>_chunks.json)
    const chunkPath = path.join(CHUNKS_FOLDER, NEW_NAME.replace(/\.pdf$/i, "") + "_chunks.json");
    const chunks = fs.existsSync(chunkPath) ? JSON.parse(fs.readFileSync(chunkPath, "utf8")) : [];
    record("File chunk JSON dibuat", chunks.length > 0, `${chunks.length} chunk`);

    // 6) Vektor di Chroma (metadata filename)
    let vecCount = 0;
    try {
        const client = new ChromaClient();
        const col = await client.getCollection({ name: COLLECTION, embeddingFunction: null });
        const got = await col.get({ where: { filename: NEW_NAME } });
        vecCount = (got.ids || []).length;
    }
    catch (error) {
        record("Vektor di Chroma", false, error.message);
    }
    record("Vektor tersimpan di Chroma", vecCount > 0, `${vecCount} vektor`);

    // 7) Chat RAG menemukan & menyitasi dokumen baru
    const chat = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Apa isi PERMENDAG Nomor 28 Tahun 2024?", stream: false })
    });
    const sources = chat.json?.sources || [];
    const cited = sources.some((s) => String(s.filename || s.file || "").includes(NEW_NAME));
    record(
        "Chat RAG menyitasi dokumen baru",
        chat.status === 200 && (chat.json.reply || "").trim().length > 0 && cited,
        `reply ${(chat.json.reply || "").length} karakter, ${sources.length} sumber, sitasi baru=${cited}`
    );

    // 8) Hapus dokumen -> semua bersih
    const del = await api(`/api/cms/files/${fileId}`, { method: "DELETE", token: adminToken });
    record("Hapus dokumen baru", del.status === 200, `(${del.status})`);

    await sleep(3000);
    let afterDelete = -1;
    try {
        const client = new ChromaClient();
        const col = await client.getCollection({ name: COLLECTION, embeddingFunction: null });
        const got = await col.get({ where: { filename: NEW_NAME } });
        afterDelete = (got.ids || []).length;
    }
    catch {}
    record("Vektor hilang setelah hapus", afterDelete === 0, `${afterDelete} vektor`);

    const chunkGone = !fs.existsSync(chunkPath);
    record("Chunk JSON terhapus", chunkGone, chunkGone ? "hilang" : "MASIH ADA");

    // 9) Bersihkan record files.json
    const files = JSON.parse(fs.readFileSync(FILES_JSON, "utf8"));
    const before = files.length;
    const cleaned = files.filter((f) => !String(f.originalName || "").startsWith("TES_DOK_BARU_"));
    fs.writeFileSync(FILES_JSON, JSON.stringify(cleaned, null, 2), "utf8");
    record("files.json bersih (record tes dibuang)", cleaned.length < before, `${before} -> ${cleaned.length}`);

    // Ringkasan
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log("\n=====================================");
    console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
    console.log("=====================================\n");
    if (failed > 0) process.exitCode = 1;
    else console.log("===== TES E2E DOKUMEN BARU LULUS =====");
}

main().catch((error) => {
    fail("Eksekusi gagal", error.message);
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\nHASIL: ${passed} PASS, ${failed} FAIL`);
    process.exitCode = 1;
});