import fs from "fs";
import path from "path";
import crypto from "crypto";

// =====================================
// Query Expansion (universal)
//
// Tujuan: membantu retrieval memahami
// pertanyaan Indonesia terhadap dokumen
// yang mayoritas berbahasa Inggris, untuk
// TOPIK APA PUN — termasuk dokumen baru
// yang belum pernah ada di kamus manual.
//
// Strategi berlapis (cepat -> lambat):
//   1. Kamus lokal TERM_EN (dikirim dari
//      retrieverService) — instan, gratis,
//      cocok untuk istilah umum & dikenal.
//   2. Cache (memori + file) — query yang
//      sama tidak perlu dipanggil API lagi.
//   3. LLM — menghasilkan sinonim Inggris
//      untuk istilah di luar kamus. Tunduk
//      pada timeout; bila gagal, fallback
//      ke hasil kamus saja (tetap jalan).
//
// Bisa dimatikan: QUERY_EXPANSION=off
// =====================================

// LLM apa yang dipakai untuk ekspansi.
// Bisa dioverride via .env (QUERY_EXPANSION_MODEL).
const EXPANSION_MODEL =
process.env.QUERY_EXPANSION_MODEL ||
process.env.OPENROUTER_MODEL ||
"openai/gpt-4o-mini";

const EXPANSION_ENABLED =
(process.env.QUERY_EXPANSION || "on") !== "off";

// Cache di memori (cepat untuk sesi berjalan)
const memCache = new Map();

// Cache di file (bertahan antar sesi).
// Lokasi: backend/data/query_expansion_cache.json
const CACHE_FILE =
path.resolve(
    process.env.DATA_PATH || "./data",
    "query_expansion_cache.json"
);

// Max istilah Inggris yang diminta (jaga token kecil)
const MAX_TERMS = 20;

function extractEntities(question) {
    const entities = [];
    entities.push(...(question.match(/HS\s*\d+/gi) || []));
    entities.push(...(question.match(/(?:USD|Rp|IDR)\s*[\d.]+\s*(?:juta|miliar|triliun|jutaan|miliaran)?/gi) || []));
    entities.push(...(question.match(/\d{4}/g) || []));
    entities.push(...(question.match(/\b\d+\.?\d*\s*(?:%|persen|percent)\b/gi) || []));
    entities.push(...(question.match(/\b(?:negara|country|negeri)\b/gi) || []));
    entities.push(...(question.match(/\b(?:kota|city|town|daerah)\b/gi) || []));
    entities.push(...(question.match(/\b(?:impor|export|ekspor|impori|eksportir)\b/gi) || []));
    return [...new Set(entities)].map(e => e.toLowerCase());
}

// =====================================
// Cache
// =====================================

function loadDiskCache() {

    try {

        if (fs.existsSync(CACHE_FILE)) {

            return JSON.parse(
                fs.readFileSync(CACHE_FILE, "utf8")
            );

        }

    }
    catch { /* cache rusak = mulai kosong */ }

    return {};

}

function saveDiskCache(cache) {

    try {

        fs.mkdirSync(
            path.dirname(CACHE_FILE),
            { recursive: true }
        );

        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify(cache),
            "utf8"
        );

    }
    catch { /* gagal simpan = tidak fatal */ }

}

function cacheKey(question) {

    return crypto
    .createHash("md5")
    .update(question.toLowerCase().trim())
    .digest("hex");

}

// =====================================
// Ekspansi via LLM
//
// Prompt meminta daftar sinonim/kata kunci
// Inggris untuk istilah penting dalam
// pertanyaan. Diminta HANYA kata, tanpa
// kalimat, agar bisa langsung disuntikkan
// ke query embedding.
// =====================================

async function expandWithLLM(question) {

    const { default: OpenAI } = await import("openai");

    const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        timeout: 15000
    });

    const entities = extractEntities(question);
    const entitySection = entities.length > 0
        ? `\nIMPORTANT: The question contains these specific entities that MUST appear in the keywords: ${entities.join(", ")}`
        : "";

    const prompt =
`Extract key terms from this Indonesian question and translate them into English keywords for document search.

Question: "${question}"

Rules:
- Output ONLY English keywords/phrases relevant for matching the topic, separated by spaces.
- Cover each important term. Include technical terms specific to the question's domain (e.g. for "harga obat" include "price", "dosage", "medicine"; for "perdata" include "civil", "law", "settlement").
- Also include the raw numbers, codes, or acronyms that appear in the question (e.g. "2024", "HS 901890", "VAT").
- No explanations, no sentences, no punctuation except spaces.
- At most 10 terms.${entitySection}

IMPORTANT: Always include these domain-agnostic keywords if present in the question:
- "indonesia", "indonesian" (for local content)
- "export", "import" (for trade documents)
- "regulation", "regulation" (for legal docs)
- "price", "value", "amount" (for financial docs)
- "study", "research", "paper" (for academic docs)`;

    const completion =
    await client.chat.completions.create({
        model: EXPANSION_MODEL,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
            { role: "user", content: prompt }
        ]
    });

    const text =
    completion
    .choices?.[0]
    ?.message
    ?.content || "";

    const llmTerms = text
    .split(/[^A-Za-z0-9]+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length > 1)
    .slice(0, MAX_TERMS)
    .join(" ");

    const entityTerms = entities.join(" ");

    return [
        ...llmTerms.split(" ").filter(Boolean),
        ...entityTerms.split(" ").filter(Boolean)
    ]
    .map(w => w.toLowerCase())
    .filter((w, i, arr) => w && arr.indexOf(w) === i)
    .slice(0, MAX_TERMS)
    .join(" ");

}

// =====================================
// API utama
//
// localTerms : hasil ekspansi dari kamus
//              manual (sudah berupa string).
// Kembalian : string istilah Inggris ekstra
//             (kosong bila tidak ada/off).
// =====================================

export async function getQueryExpansion(
    question,
    localTerms
) {

    // Mati total? Kembalikan kamus lokal saja.
    if (!EXPANSION_ENABLED) {

        return localTerms || "";

    }

    const key = cacheKey(question);

    // 1) Cache memori
    if (memCache.has(key)) {

        return memCache.get(key);

    }

    // 2) Cache disk
    const disk = loadDiskCache();

    if (disk[key]) {

        memCache.set(key, disk[key]);

        return disk[key];

    }

    // 3) Panggil LLM (dengan timeout internal)
    let llmExpansion = "";

    try {

        llmExpansion =
        await expandWithLLM(question);

    }
    catch (error) {

        console.log(
            "Query expansion LLM gagal, pakai kamus lokal:",
            error.message
        );

    }

    // Gabung dengan kamus lokal; dedup.
    const combined =
    [
        ...(localTerms || "").split(" "),
        ...(llmExpansion || "").split(" ")
    ]
    .map(w => w.toLowerCase())
    .filter((w, i, arr) => w && arr.indexOf(w) === i)
    .slice(0, MAX_TERMS)
    .join(" ");

    memCache.set(key, combined);

    const newDisk = loadDiskCache();
    newDisk[key] = combined;
    saveDiskCache(newDisk);

    return combined;

}
