import fs from "fs";
import path from "path";
import crypto from "crypto";

const EXPANSION_MODEL =
process.env.OPENROUTER_MODEL ||
"cohere/north-mini-code:free";

const EXPANSION_ENABLED =
(process.env.QUERY_EXPANSION || "on") !== "off";

const memCache = new Map();

const CACHE_FILE =
path.resolve(
    process.env.DATA_PATH || "./data",
    "query_expansion_cache.json"
);

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

function loadDiskCache() {

    try {

        if (fs.existsSync(CACHE_FILE)) {

            return JSON.parse(
                fs.readFileSync(CACHE_FILE, "utf8")
            );

        }

    }
    catch {  }

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
    catch {  }

}

function cacheKey(question) {

    return crypto
    .createHash("md5")
    .update(question.toLowerCase().trim())
    .digest("hex");

}

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

export async function getQueryExpansion(
    question,
    localTerms
) {

    if (!EXPANSION_ENABLED) {

        return localTerms || "";

    }

    const key = cacheKey(question);

    if (memCache.has(key)) {

        return memCache.get(key);

    }

    const disk = loadDiskCache();

    if (disk[key]) {

        memCache.set(key, disk[key]);

        return disk[key];

    }

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
