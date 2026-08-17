// =====================================
// Cek kesehatan sistem (seluruh layanan)
// -------------------------------------
// Memeriksa satu per satu komponen yang
// harus hidup agar demo PKL jalan:
//
//   1. Backend  :3001  -> /api/health
//   2. Frontend :5173  -> halaman utama
//   3. ChromaDB :8000  -> API v2 + collection
//   4. ChromaDB         -> jumlah vektor
//   5. (Opsional) Chat RAG end-to-end
//      (backend -> Chroma -> OpenRouter)
//
// Chat RAG bisa dilewati dengan flag
// --no-chat (hemat kredit API) atau
// --chat untuk memaksanya.
//
// Cara pakai (dari folder backend/):
//   node scripts/healthCheck.mjs
// =====================================


const BACKEND = "http://127.0.0.1:3001";
const FRONTEND = "http://127.0.0.1:5173";
// Catatan: Chroma instance ini bind di
// localhost/[::1], jadi pakai "localhost"
// (bukan 127.0.0.1) seperti CHROMA_URL
// di backend/.env.
const CHROMA = "http://localhost:8000";
const CHROMA_V2 = `${CHROMA}/api/v2/tenants/default_tenant/databases/default_database/collections`;
const COLLECTION_ID = "0b182325-8551-4d39-8252-0bc6322838e3";
const COLLECTION_NAME = "sip_documents";
const MIN_VECTORS = 600;

const args = process.argv.slice(2);
const doChat = args.includes("--chat") || !args.includes("--no-chat");

let pass = 0;
let fail = 0;
let skipped = 0;

function ok(label, detail = "") {
    pass++;
    console.log(`  [PASS] ${label}${detail ? `  -> ${detail}` : ""}`);
}

function no(label, detail = "") {
    fail++;
    console.log(`  [FAIL] ${label}${detail ? `  -> ${detail}` : ""}`);
}

function skip(label, detail = "") {
    skipped++;
    console.log(`  [SKIP] ${label}${detail ? `  -> ${detail}` : ""}`);
}

async function http(method, url, body, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* bukan JSON */ }
        return { status: res.status, text, json };
    } catch (e) {
        clearTimeout(timer);
        return { status: 0, text: "", json: null, error: e.message };
    }
}

console.log("===== CEK KESEHATAN SISTEM =====\n");

// ---------- 1. Backend ----------
console.log(`Backend (${BACKEND})`);
const health = await http("GET", `${BACKEND}/api/health`);
if (health.status === 200 && health.json?.status === "OK") {
    ok("health endpoint", "200 OK");
} else {
    no("health endpoint", health.error || `HTTP ${health.status}`);
}

// ---------- 2. Frontend ----------
console.log(`\nFrontend (${FRONTEND})`);
const fe = await http("GET", FRONTEND, null, 8000);
if (fe.status === 200) {
    ok("halaman utama", "200");
} else {
    no("halaman utama", fe.error || `HTTP ${fe.status}`);
}

// ---------- 3. ChromaDB ----------
console.log(`\nChromaDB (${CHROMA})`);
const cols = await http("GET", CHROMA_V2);
if (cols.status === 200 && Array.isArray(cols.json)) {
    const found = cols.json.find((c) => c.id === COLLECTION_ID || c.name === COLLECTION_NAME);
    if (found) {
        ok("API v2 + collection", `${found.name} (${found.id})`);
    } else {
        no("collection", `"${COLLECTION_NAME}" tidak ditemukan`);
    }
} else {
    no("API v2", cols.error || `HTTP ${cols.status}`);
}

// ---------- 4. Jumlah vektor ----------
if (cols.status === 200 && Array.isArray(cols.json) && cols.json.some((c) => c.id === COLLECTION_ID)) {
    const getRes = await http("POST", `${CHROMA_V2}/${COLLECTION_ID}/get`, { limit: 5000, include: ["metadatas"] });
    const count = getRes.json?.ids?.length ?? 0;
    if (getRes.status === 200 && count >= MIN_VECTORS) {
        ok("jumlah vektor", `${count} (min ${MIN_VECTORS})`);
    } else {
        no("jumlah vektor", getRes.error || `HTTP ${getRes.status}, count=${count}`);
    }
} else {
    skip("jumlah vektor", "collection tidak tersedia");
}

// ---------- 5. Chat RAG (opsional) ----------
console.log(`\nChat RAG (${doChat ? "aktif" : "dilewati --no-chat"})`);
if (doChat) {
    const chat = await http("POST", `${BACKEND}/api/chat`, {
        message: "Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024? Jawab singkat.",
    }, 90000);
    const reply = chat.json?.reply ?? "";
    const sources = chat.json?.sources ?? [];
    if (chat.status === 200 && reply.length > 0 && sources.length > 0) {
        ok("end-to-end RAG", `reply ${reply.length} char, ${sources.length} sumber`);
    } else {
        no("end-to-end RAG", chat.error || `HTTP ${chat.status}, reply=${reply.length} char, sources=${sources.length}`);
    }
} else {
    skip("end-to-end RAG");
}

// ---------- Ringkasan ----------
console.log("\n=====================================");
console.log(`HASIL: ${pass} PASS, ${fail} FAIL${skipped ? `, ${skipped} SKIP` : ""}`);
console.log("=====================================");
process.exitCode = fail > 0 ? 1 : 0;