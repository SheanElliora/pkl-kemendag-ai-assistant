import fs from "fs";
import path from "path";
import { CHUNK_FOLDER } from "../config.js";

const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set([
    "yang","dengan","untuk","dari","dalam","pada","akan","tidak","juga",
    "dapat","harus","serta","sudah","lebih","saat","agar","supaya",
    "bagi","oleh","karena","sampai","antara","melalui","menjadi",
    "adalah","sebagai","bahwa","atau","namun","tentang","mengenai",
    "terkait","berdasarkan","membutuhkan","sistem","merupakan",
    "berapa","bagaimana","apakah","mengapa","kapan","dimana","mana",
    "tolong","bisa","sebutkan","jelaskan","apa","siapa","digunakan",
    "membangun","melakukan","terdapat","tersebut","itu","ini","ada",
    "sebuah","seluruh","semua","setiap","beberapa","banyak","utama",
    "umum","besar","kecil","tinggi","rendah","baru","lama","sangat",
    "kurang","cukup","hampir","maka","saya","kami","kita","mereka",
    "anda","kalian","the","and","for","was","are","but","not","you",
    "all","can","had","her","his","its","our","out","who","may",
    "were","been","being","have","has","had","does","did","doing",
    "would","could","should","shall","will","might","must","than",
    "then","them","they","this","that","these","those","which",
    "whose","where","when","while","there","here","about","into",
    "over","under","again","further","once","only","other","some",
    "such","same","own","each","both","few","more","most","because",
    "through","during","before","after","above","below","use","using",
    "used","make","made","making","get","got","take","took","know",
    "known","see","saw","say","said","give","given","come","came",
    "think","tell","show","find","found"
]);

function tokenize(text) {

    return String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => {
            if (!w) return false;
            if (w.length === 1) return false;
            if (w.length < 4 && !/^\d+$/.test(w)) return false;
            return !STOPWORDS.has(w);
        });

}

let cache = null;
let cacheKey = "";

function corpusFingerprint() {

    try {

        return fs.readdirSync(CHUNK_FOLDER)
            .filter((f) => f.endsWith("_chunks.json"))
            .map((f) => f + ":" + fs.statSync(path.join(CHUNK_FOLDER, f)).mtimeMs)
            .join("|");

    }

    catch {

        return "";

    }

}

function loadCorpus() {

    const fp = corpusFingerprint();

    if (cache && cache.fp === fp) {

        return cache;

    }

    let docs = [];

    try {

        const files =
        fs.readdirSync(CHUNK_FOLDER)
            .filter((f) => f.endsWith("_chunks.json"));

        for (const file of files) {

            const filename =
            file.replace(/_chunks\.json$/, "") + ".pdf";

            let chunks = [];

            try {
                const parsed = JSON.parse(
                    fs.readFileSync(path.join(CHUNK_FOLDER, file), "utf8")
                );

                chunks = Array.isArray(parsed) ? parsed : parsed.chunks || [];
            } catch {
                continue;
            }

            if (!Array.isArray(chunks)) continue;

            chunks.forEach((chunk, index) => {

                if (!chunk.text || chunk.text.trim().length < 40) return;

                docs.push({
                    id: `${filename}_${chunk.page}_${index}`,
                    filename,
                    page: chunk.page,
                    printedPage: chunk.printedPage ?? chunk.page,
                    text: chunk.text,
                    tokens: tokenize(chunk.text)
                });

            });

        }

    }

    catch (error) {

        console.log("BM25: gagal memuat korpus:", error.message);

    }

    const docCount = docs.length;

    const avgdl =
    docCount > 0
        ? docs.reduce((sum, d) => sum + d.tokens.length, 0) / docCount
        : 0;

    const df = new Map();

    for (const doc of docs) {

        const seen = new Set(doc.tokens);

        for (const term of seen) {

            df.set(term, (df.get(term) || 0) + 1);

        }

    }

    const idf = new Map();

    for (const [term, count] of df) {

        idf.set(
            term,
            Math.log(1 + (docCount - count + 0.5) / (count + 0.5))
        );

    }

    cache = { fp, docs, docCount, avgdl, idf };

    console.log(
        `BM25: korpus dimuat (${docCount} chunk dari ${docs.length > 0 ? new Set(docs.map((d) => d.filename)).size : 0} dokumen)`
    );

    return cache;

}

function scoreDoc(doc, queryTerms, idf) {

    const tf = new Map();

    for (const term of doc.tokens) {

        tf.set(term, (tf.get(term) || 0) + 1);

    }

    const len = doc.tokens.length;

    let score = 0;

    for (const term of queryTerms) {

        const termFreq = tf.get(term) || 0;

        if (termFreq === 0) continue;

        const idfVal = idf.get(term) || 0;

        const denom =
        termFreq + K1 * (1 - B + B * (len / (cache.avgdl || 1)));

        score += idfVal * ((termFreq * (K1 + 1)) / denom);

    }

    return score;

}

export function searchBM25(question, topN = 60) {

    const corpus = loadCorpus();

    if (corpus.docCount === 0) {

        return [];

    }

    const queryTerms = tokenize(question);

    if (queryTerms.length === 0) {

        return [];

    }

    const scored = [];

    for (const doc of corpus.docs) {

        const s = scoreDoc(doc, queryTerms, corpus.idf);

        if (s > 0) {

            scored.push({
                doc: doc.text,
                meta: {
                    filename: doc.filename,
                    title: "",
                    page: doc.page,
                    printedPage: doc.printedPage
                },
                distance: null,
                bm25Score: s
            });

        }

    }

    scored.sort((a, b) => b.bm25Score - a.bm25Score);

    return scored.slice(0, topN);

}
