import { ChromaClient } from "chromadb";
import fs from "fs";
import path from "path";
import { createEmbedding } from "./embedderService.js";
import { rerankDocuments } from "./rerankerService.js";
import { searchBM25 } from "./bm25Service.js";
import { DOCS_FOLDER } from "../config.js";

const client = new ChromaClient();

const DEBUG = process.env.RETRIEVER_DEBUG === "1";

const MAX_CANDIDATES = 10;
const DISTANCE_RATIO = 3.0;
const DISTANCE_OFFSET = 0.3;
const SEARCH_WIDTH = 80;
const KEYWORD_BONUS = 0.1;
const FILENAME_BONUS = 0.15;
const MIN_CHUNK_LENGTH = 200;
const RERANK_WIDTH = 10;
const RERANK_WEIGHT = 0.7;
const BM25_WIDTH = 80;

const VALUE_FACT_BONUS = 0.1;
const VALUE_FACT_PATTERN =
/(\$\s?\d|\busd\b|\brp\s?\d|\beur\b|\d+[.,]\d+\s*%|\d+(?:[.,]\d+)?\s*(?:juta|miliar|triliun|ton|unit)|\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2})/i;
const BM25_BONUS = 0.3;

const STOP3 = new Set([
    "dan","dari","apa","itu","ini","ada","atau",
    "the","and","for","was","are","but","not","you",
    "all","can","had","her","his","its","our","out",
    "who","may","per","dna","nas","hns","xbe"
]);

const STOPWORD_ANY_LENGTH = new Set([
    "yang","dengan","untuk","dari","dalam","pada","akan","tidak","juga",
    "dapat","harus","serta","sudah","lebih","saat","agar","supaya",
    "bagi","oleh","karena","sampai","antara","melalui","menjadi",
    "adalah","sebagai","bahwa","atau","namun","tentang","mengenai",
    "terkait","berdasarkan","membutuhkan","sistem","merupakan",
    "berapa","bagaimana","apakah","mengapa","kapan","dimana","mana",
    "tolong","bisa","untuk","sebutkan","jelaskan","apa","siapa",
    "digunakan","membangun","melakukan","terdapat","tersebut",
    "itu","ini","ada","dengan","sebuah","seluruh","semua","setiap",
    "beberapa","banyak","utama","umum","besar","kecil","tinggi",
    "rendah","baru","lama","sangat","kurang","cukup","hampir",
    "maka","saya","kami","kita","mereka","anda","kalian",
    "were","been","being","have","has","had","does","did","doing",
    "would","could","should","shall","will","may","might","must",
    "than","then","them","they","this","that","these","those",
    "which","whose","where","when","while","there","here","about",
    "into","over","under","again","further","once","only","other",
    "some","such","same","own","each","both","few","more","most",
    "because","through","during","before","after","above","below",
    "use","using","used","using","make","made","making","get","got",
    "take","took","know","known","see","saw","say","said","give",
    "given","come","came","think","tell","show","find","found"
]);

const TERM_EN = [
    ["harga", "price pricing"],
    ["komoditas", "commodity commodities"],
    ["jurnal", "journal"],
    ["prediksi", "prediction predicting forecast"],
    ["pasar", "market"],
    ["tahun", "year"],
    ["pendapatan", "revenue income earnings"],
    ["penjualan", "sales revenue"],
    ["impor", "import"],
    ["ekspor", "export"],
    ["nilai", "value total amount"],
    ["jumlah", "number total count"],
    ["total", "total"],
    ["gamer", "gamer gamers video game player"],
    ["konsol", "console"],
    ["penerbit", "publisher"],
    ["terlaris", "best selling top"],
    ["populasi", "population"],
    ["penduduk", "population"],
    ["rekening", "bank account"],
    ["modal", "capital"],
    ["bank", "bank"],
    ["dokumen", "document documents"],
    ["hambatan", "barrier obstacle challenges risks"],
    ["risiko", "risk risks"],
    ["persyaratan", "requirements regulations"],
    ["penulis", "author authors writers paper"],
    ["peneliti", "researcher researchers study paper"],
    ["eksperimen", "experiment experiments"],
    ["formulasi", "formulation"],
    ["komponen", "component"],
    ["sistem", "system"],
    ["perdagangan", "trade trading commerce"],
    ["peraturan", "regulation regulation"],
    ["menteri", "minister ministry"],
    ["perusahaan", "company"],
    ["bea", "customs duty tariff"],
    ["tarif", "tariff duty rate"],
    ["peralatan", "equipment devices"],
    ["medis", "medical surgical"],
    ["instrumen", "instruments"],
    ["kesehatan", "health"],
    ["inflasi", "inflation"],
    ["pengangguran", "unemployment"],
    ["pajak", "tax"],
    ["tekstil", "textile"],
    ["katun", "cotton"],
    ["kain", "fabric cloth"],
    ["statistik", "statistics"],
    ["algoritma", "algorithm"],
    ["dibandingkan", "compared comparison compare"],
    ["kelima", "five"],
    ["model", "model"],
    ["percobaan", "experiment trial"],
    ["dataset", "dataset data"],
    ["media", "media social"],
    ["jasa", "service services"],
    ["makanan", "food"],
    ["restoran", "restaurant"],
    ["pemasok", "supplier"],
    ["pasokan", "supply imports"],
    ["asosiasi", "association"],
    ["gambar", "figure image"],
    ["tabel", "table"],
    ["bola", "football football"],
    ["sepak", "football"],
    ["internet", "internet"],
    ["pengguna", "user users"],
    ["wikipedia", "wikipedia"],
    ["page", "page"],
    ["rag", "retrieval augmented generation rag"],
    ["mse", "mean squared error mse"],
    ["lstm", "long short term memory lstm"],
    ["gdp", "gross domestic product gdp"],
    ["univariate", "time-series one dimension single variable"],
    ["multivariate", "multivariable multi-dimensions multiple variables features"],
    ["nilai unit", "unit value per unit price"],
    ["distribusi", "distribution channel retail traditional showroom"],
    ["segmen", "segment massal menengah premium institutional"],
    ["margin", "margin profit markup"],
    ["rantai nilai", "value chain"],
    ["sertifikasi", "certification GS1 standards compliance"],
    ["label", "label language japanese"],
    ["kompetitif", "competitive position ranking market share"],
    ["series 1", "first experiment initial experiment awal percobaan"],
    ["series 2", "second experiment follow-up follow up experiment lanjutan"],
    ["regresi", "regression analysis"],
    ["r square", "r-squared r2 coefficient determination koefisien determinasi"],
    ["multikolinearitas", "multicollinearity vif variance inflation factor"],
    ["kain ankara", "ankara wax print textile fabric cotton HS 5208 5212"],
    ["ekspor indonesia", "indonesia export HS 5208 5212 textile"],
    ["tren ekspor", "export trend decline penurunan"],
    ["strategi distribusi", "distribution strategy channel showroom retail market"],
    ["eksperimen", "experiment experimental design methodology"],
    ["hot-swap", "hot swap index swapping index swapping"],
    ["swapping", "swap swapping replacement"],
    ["akurasi", "accuracy correct percentage rate"],
    ["indeks", "index document storage index"],
    ["hot", "hot swap"],
    ["persentase", "percentage percent rate"],
    ["kumpulan", "set collection group"],
    ["penghitungan", "calculation computation measure"],
];

function getLocalExpansion(questionLower) {

    const added = [];

    for(const [term, en] of TERM_EN){

        if(questionLower.includes(term)){

            added.push(en);

        }

    }

    return added.flatMap(s=>s.split(" ")).join(" ");

}

function getActiveFilenames() {

    try {

        return new Set(
            fs.readdirSync(DOCS_FOLDER).map(f => f.toLowerCase())
        );

    }
    catch {

        return new Set();

    }

}

export async function searchDocuments(question){

    const collection =
    await client.getCollection({

        name:"sip_documents",

        embeddingFunction:null

    });

    const activeFiles =
    getActiveFilenames();

    const lowerQuestion =
    question.toLowerCase();

    const localExpansion =
    getLocalExpansion(lowerQuestion);

    const bm25Results =
    searchBM25(question, BM25_WIDTH);

    const searchQuery =
    localExpansion
        ? question + " " + localExpansion
        : question;

    const queryVector =
    await createEmbedding(
        searchQuery,
        "query"
    );

    const result =
    await collection.query({

        queryEmbeddings:[
            queryVector
        ],

        nResults:SEARCH_WIDTH

    });

    if (DEBUG) {
        console.log("[search] hasil:");

        console.log(
            "Pertanyaan:",
            question
        );
    }

    let candidates = [];

    const questionTokens =
    lowerQuestion

    .split(/[^a-z0-9]+/)
    .filter(w=>{

        return (w.length >= 2 && /^\d+$/.test(w))
            || (w.length >= 4 && !STOPWORD_ANY_LENGTH.has(w))
            || (w.length === 3 && !STOP3.has(w));
    });

result.documents[0].forEach(

        (doc,index)=>{

            const distance =
            result.distances[0][index];

            const meta =
            result.metadatas[0][index];

            if (DEBUG) {
                console.log(
                    "Candidate:",

                    meta.filename,

                    "| Page:",

                    meta.page,

                    "| Distance:",

                    distance
                );
            }

            if (!activeFiles.has((meta.filename || "").toLowerCase())) {

                if (DEBUG) {
                    console.log(
                        "Dibuang dokumen tidak aktif:",
                        meta.filename,
                        meta.page
                    );
                }

                return;

            }

            const lowerDoc =
            doc.toLowerCase();

            if(

                lowerDoc.includes("daftar isi") ||
                lowerDoc.includes("table of contents") ||
                lowerDoc.includes("daftar tabel") ||
                lowerDoc.includes("daftar gambar")

            ){

                if (DEBUG) {
                    console.log(
                        "Dibuang daftar isi:",
                        meta.filename,
                        meta.page
                    );
                }

                return;

            }

            if(

                lowerDoc.includes("market intelligence") &&
                lowerDoc.length < 500

            ){

                if (DEBUG) {
                    console.log(
                        "Dibuang cover:",
                        meta.page
                    );
                }

                return;

            }

            if(doc.trim().length < MIN_CHUNK_LENGTH){

                if (DEBUG) {
                    console.log(
                        "Dibuang chunk pendek:",
                        meta.filename,
                        meta.page,
                        `(${doc.trim().length} char)`
                    );
                }

                return;

            }

            const filename =
            meta.filename.toLowerCase();

            let filenameMatch = false;

            for(const word of questionTokens){

                if(

                    filename.includes(word)

                ){

                    filenameMatch = true;

                }

            }

            let keywordHits = 0;

            for(const word of questionTokens){

                if(lowerDoc.includes(word)){

                    keywordHits += 1;

                }

            }

candidates.push({

                doc,

                meta,

                distance,

                keywordHits,

                filenameMatch

            });

        }

    );

    if (bm25Results.length > 0) {

        const worstDistance =
        candidates.length > 0
            ? Math.max(...candidates.map((c) => c.distance))
            : 1.2;

        const bm25Max =
        Math.max(...bm25Results.map((r) => r.bm25Score));

        const existingKeys =
        new Set(
            candidates.map(
                (c) =>
                (c.meta.filename || "") + "|" +
                c.doc.trim().slice(0, 100).toLowerCase()
            )
        );

        for (const hit of bm25Results) {

            const lowerDoc =
            hit.doc.toLowerCase();

            if (!activeFiles.has((hit.meta.filename || "").toLowerCase())) continue;

            if (
                lowerDoc.includes("daftar isi") ||
                lowerDoc.includes("table of contents") ||
                lowerDoc.includes("daftar tabel") ||
                lowerDoc.includes("daftar gambar")
            ) continue;

            if (
                lowerDoc.includes("market intelligence") &&
                lowerDoc.length < 500
            ) continue;

            if (hit.doc.trim().length < MIN_CHUNK_LENGTH) continue;

            const key =
            (hit.meta.filename || "") + "|" +
            hit.doc.trim().slice(0, 100).toLowerCase();

            if (existingKeys.has(key)) continue;

            existingKeys.add(key);

            const norm = hit.bm25Score / bm25Max;

            candidates.push({
                doc: hit.doc,
                meta: hit.meta,
                distance: worstDistance + (1 - norm) * 0.5,
                keywordHits: 0,
                filenameMatch: false,
                bm25Bonus: norm * BM25_BONUS
            });

        }

    }

    candidates.forEach(item=>{

        item.score =
        item.distance
        - KEYWORD_BONUS * item.keywordHits
        - (item.filenameMatch ? FILENAME_BONUS : 0)
        - (item.bm25Bonus || 0);

    });

    candidates.sort((a,b)=>a.score - b.score);

    if (candidates.length > 0) {

        const isValueQuestion =
        /\b(berapa|nilai|jumlah|volume|persen|how\s+much|what\s+(?:is\s+the\s+)?(?:value|amount|percentage)|export\s+value)\b/i.test(question);

        const activeRerankWeight =
        isValueQuestion ? 0.15 : RERANK_WEIGHT;

        const topForRerank =
        candidates
        .slice(0, RERANK_WIDTH);

        if (DEBUG) {
            console.log(
                "Rerank",
                topForRerank.length,
                "kandidat dengan cross-encoder..."
            );
        }

        const rerankScores =
        await rerankDocuments(
            question,
            topForRerank.map(item=>item.doc)
        );

        topForRerank.forEach((item, i)=>{

            item.rerankScore = rerankScores[i];

        });

        candidates =
        candidates
        .map(item=>{

            if (item.rerankScore !== undefined) {

                return {
                    ...item,
                    score: item.score - activeRerankWeight * item.rerankScore
                };

            }

            return item;

        })
        .sort((a,b)=>a.score - b.score);

        if (DEBUG) {
            console.log(
                "[rerank] weight=" +
                activeRerankWeight + ", valueQ=" + isValueQuestion
            );
            candidates.slice(0, 15).forEach((item, i)=>{
                console.log(
                    `[${i}] ${item.meta?.filename || "?"} p${item.meta?.page}` +
                    ` dist=${(item.distance??0).toFixed(4)}` +
                    ` kwHits=${item.keywordHits??0}` +
                    ` bm25=${(item.bm25Bonus||0).toFixed(3)}` +
                    ` rerank=${item.rerankScore!==undefined ? item.rerankScore.toFixed(4) : "-"}` +
                    ` final=${item.score.toFixed(4)}`
                );
            });
        }

    }

    const bestScore =
    candidates.length > 0
        ? candidates[0].score
        : 0;

    const maxAllowedScore =
    bestScore * DISTANCE_RATIO + DISTANCE_OFFSET;

    const finalCandidates =
    candidates
    .filter(item=>{

        if(
            bestScore > 0 &&
            item.score > maxAllowedScore
        ){

        if (DEBUG) {
            console.log(
                "Dibuang (skor jauh relatif):",
                item.score.toFixed(4),
                "> batas",
                maxAllowedScore.toFixed(4)
            );
        }

            return false;

        }

        return true;

    })
    .slice(0, MAX_CANDIDATES);

    const documents = [];
    const metadata = [];
    const distances = [];

    finalCandidates.forEach(item=>{

        documents.push(
            item.doc
        );

        metadata.push(
            item.meta
        );

        distances.push(
            item.distance
        );

    });

    if (DEBUG) {
        console.log(
            "Dokumen lolos:",
            documents.length
        );
    }

    return {

        documents,

        metadata,

        distances

    };

}
