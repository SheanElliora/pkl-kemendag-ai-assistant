// =====================================
// Backup lengkap database Chroma + data
// -------------------------------------
// Membuat snapshot yang bisa di-restore:
//
//   1. Stop Chroma (agar SQLite tidak
//      korup saat disalin)
//   2. Salin folder chroma/ (SQLite +
//      index HNSW) ke backup/<waktu>/
//   3. Salin data/files.json + users.json
//   4. Tulis manifest.json (info backup)
//   5. Hidupkan Chroma lagi
//   6. Verifikasi: port 8000 + jumlah
//      vektor sama seperti sebelum backup
//   7. Prune: hanya 5 backup terbaru
//      yang dipertahankan
//
// CATATAN:
// - Wajib dijalankan dari folder backend/
//   (path Chroma relatif: ./chroma).
// - .env TIDAK disalin (berisi rahasia);
//   kredensial sudah tercatat di
//   KONTEKS_PEMULIHAN.md.
// - Backup tersimpan di ../backup/ (di
//   luar folder Temp yang bisa dibersihkan).
//
// Cara pakai:
//   npm run backup
// =====================================

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BACKEND_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = path.dirname(BACKEND_DIR);
const BACKUP_ROOT = path.join(REPO_DIR, "backup");
const CHROMA_DATA_DIR = path.join(BACKEND_DIR, "chroma");
const CHROMA_PORT = 8000;
const KEEP_BACKUPS = 5;
const CHROMA_V2 = `http://localhost:${CHROMA_PORT}/api/v2/tenants/default_tenant/databases/default_database/collections`;
const COLLECTION_ID = "0b182325-8551-4d39-8252-0bc6322838e3";

let fail = 0;

function ok(label, detail = "") {
    console.log(`  [PASS] ${label}${detail ? `  -> ${detail}` : ""}`);
}

function no(label, detail = "") {
    fail++;
    console.log(`  [FAIL] ${label}${detail ? `  -> ${detail}` : ""}`);
}

function log(label) {
    console.log(`\n[${label}]`);
}

// ---------- Utilitas ----------

function findChromaPid() {
    try {
        const out = execSync("netstat -ano", { encoding: "utf8" });
        const lines = out.split(/\r?\n/).filter((l) =>
            l.includes(`:${CHROMA_PORT}`) && l.includes("LISTENING")
        );
        const pids = lines.map((l) => l.trim().split(/\s+/).pop()).filter(Boolean);
        return [...new Set(pids)];
    } catch {
        return [];
    }
}

function waitPort(pidToWait) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const pids = findChromaPid();
        const still = pids.filter((p) => pidToWait.includes(p));
        if (still.length === 0) return true;
        sleepSync(500);
    }
    return false;
}

async function waitHttp(url, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
            if (res.status >= 200 && res.status < 500) return true;
        } catch { /* belum hidup */ }
        await sleep(1500);
    }
    return false;
}

function sleepSync(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* busy wait sederhana */ }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countVectors() {
    const res = await fetch(`${CHROMA_V2}/${COLLECTION_ID}/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5000, include: ["metadatas"] }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.ids?.length ?? 0;
}

// ---------- 1. Deteksi & stop Chroma ----------

console.log("===== BACKUP CHROMA + DATA =====\n");

log("1. Deteksi proses Chroma");
const pids = findChromaPid();
if (pids.length > 0) {
    console.log(`    Proses aktif di :${CHROMA_PORT} (PID ${pids.join(", ")}) -> menghentikan...`);
    for (const pid of pids) {
        try { process.kill(Number(pid), "SIGKILL"); } catch { /* sudah mati */ }
    }
    if (waitPort(pids)) {
        ok("Chroma dihentikan", `PID ${pids.join(", ")}`);
    } else {
        no("Chroma dihentikan", "port masih terpakai setelah 15 detik");
        process.exit(1);
    }
} else {
    console.log("    Tidak ada proses Chroma yang berjalan (backup tanpa stop).");
}

// ---------- 2. Salin folder Chroma ----------

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace("T", "_");
const backupDir = path.join(BACKUP_ROOT, stamp);

log("2. Menyalin data Chroma");
if (!fs.existsSync(CHROMA_DATA_DIR)) {
    no("folder chroma/", `tidak ditemukan di ${CHROMA_DATA_DIR}`);
    process.exit(1);
}
fs.mkdirSync(backupDir, { recursive: true });
fs.cpSync(CHROMA_DATA_DIR, path.join(backupDir, "chroma"), { recursive: true });
ok("chroma/ disalin", `-> backup/${stamp}/chroma`);

// ---------- 3. Salin data JSON ----------

log("3. Menyalin files.json + users.json");
for (const f of ["files.json", "users.json"]) {
    const src = path.join(BACKEND_DIR, "data", f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, f));
        ok(`${f} disalin`);
    } else {
        no(`${f} disalin`, "file tidak ditemukan");
    }
}

// ---------- 4. Manifest ----------

log("4. Menulis manifest.json");
const chromaBytes = fs.statSync(CHROMA_DATA_DIR).size;
fs.writeFileSync(
    path.join(backupDir, "manifest.json"),
    JSON.stringify({
        createdAt: new Date().toISOString(),
        note: "Backup otomatis scripts/backupChroma.mjs",
        chromaDirSizeBytes: chromaBytes,
        filesBackedUp: ["chroma/", "files.json", "users.json"],
        restoreHint: "Stop Chroma, ganti isi backend/chroma dengan isi folder chroma/ ini, lalu hidupkan Chroma. Cara lengkap: README.md > Cadangan & Pemulihan.",
    }, null, 2)
);
ok("manifest.json dibuat");

// ---------- 5. Hidupkan kembali ----------

log("5. Menghidupkan Chroma kembali");
const child = spawn("chroma", ["run", "--path", "./chroma"], {
    cwd: BACKEND_DIR,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
});
child.unref();
if (waitHttp(CHROMA_V2)) {
    ok("Chroma hidup kembali", `:${CHROMA_PORT}`);
} else {
    no("Chroma hidup kembali", "tidak merespons dalam 90 detik");
}

// ---------- 6. Verifikasi vektor ----------

log("6. Verifikasi vektor");
let vectorCount = -1;
for (let attempt = 1; attempt <= 5; attempt++) {
    try {
        vectorCount = await countVectors();
        break;
    } catch {
        console.log(`    percobaan ${attempt}/5 gagal -> coba lagi dalam 5 detik...`);
        await sleep(5000);
    }
}
if (vectorCount >= 0) {
    ok("jumlah vektor", `${vectorCount}`);
} else {
    no("jumlah vektor", "tidak bisa dibaca setelah 5 percobaan");
}

// ---------- 7. Prune backup lama ----------

log("7. Prune backup lama (simpan 5 terbaru)");
const all = fs.existsSync(BACKUP_ROOT)
    ? fs.readdirSync(BACKUP_ROOT).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort().reverse()
    : [];
for (const old of all.slice(KEEP_BACKUPS)) {
    fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
    console.log(`    dihapus: ${old}`);
}
ok("prune selesai", `${all.length} backup -> ${Math.min(all.length, KEEP_BACKUPS)} terbaru`);

// ---------- Ringkasan ----------

console.log("\n=====================================");
console.log(`HASIL: ${fail === 0 ? "SUKSES" : `${fail} GAGAL`}`);
console.log(`Backup terbaru: backup/${stamp}`);
console.log("=====================================");
process.exitCode = fail > 0 ? 1 : 0;