import { pipeline } from "@xenova/transformers";
import crypto from "crypto";

let embedder = null;

const queryCache = new Map();
const QUERY_CACHE_MAX = 500;
const QUERY_CACHE_TTL = 10 * 60 * 1000;
function qCacheKey(text, role) {
    return crypto.createHash("md5").update((role || "") + "|" + String(text).toLowerCase().trim()).digest("hex");
}
function getQCache(key) {
    const hit = queryCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > QUERY_CACHE_TTL) {
        queryCache.delete(key);
        return null;
    }

    queryCache.delete(key);
    queryCache.set(key, hit);
    return hit.value;
}
function setQCache(key, value) {
    if (queryCache.size >= QUERY_CACHE_MAX) {
        const first = queryCache.keys().next().value;
        queryCache.delete(first);
    }
    queryCache.set(key, { value, ts: Date.now() });
}

async function getEmbedder() {

    if (!embedder) {

        console.log(
            "Memuat model embedding (multilingual-e5-small)..."
        );

        embedder = await pipeline(
            "feature-extraction",
            "Xenova/multilingual-e5-small"
        );

        console.log(
            "Embedding model siap"
        );

    }

    return embedder;

}

export async function createEmbedding(
    text,
    role = "passage"
) {

    if (role === "query") {
        const k = qCacheKey(text, role);
        const hit = getQCache(k);
        if (hit) return hit;
    }

    const model = await getEmbedder();

    const input =
    role === "query"
        ? "query: " + text
        : "passage: " + text;

    const output = await model(

        input,

        {
            pooling: "mean",
            normalize: true
        }

    );

    const vec = Array.from(output.data);
    if (role === "query") {
        setQCache(qCacheKey(text, role), vec);
    }
    return vec;

}

export async function createEmbeddingsBatch(
    texts,
    role = "passage"
) {

    const model = await getEmbedder();

    const inputs =
    texts.map(
        (t) =>
        role === "query"
            ? "query: " + t
            : "passage: " + t
    );

    const output =
    await model(
        inputs,
        {
            pooling: "mean",
            normalize: true
        }
    );

    const outputs =
    Array.isArray(output)
        ? output
        : [output];

    const flat =
    new Float32Array(
        outputs.reduce(
            (acc, tensor) =>
            acc.concat(
                Array.from(tensor.data)
            ),
            []
        )
    );

    const n = texts.length;

    const dim = flat.length / n;

    const result = [];

    for (let i = 0; i < n; i++) {

        result.push(
            Array.from(
                flat.slice(
                    i * dim,
                    (i + 1) * dim
                )
            )
        );

    }

    return result;

}
