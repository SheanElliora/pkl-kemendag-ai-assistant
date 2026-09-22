import crypto from "crypto";
import { searchDocuments } from "./retrieverService.js";
import { generateAnswer, generateAnswerStream, generateConversationalAnswer, generateConversationalAnswerStream } from "./llmService.js";
import { resolveContextualQuery } from "./contextGateService.js";
import { detectConversational } from "./conversationalGateService.js";

const answerCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 100;

function cacheKey(question, model) {
    return crypto
        .createHash("md5")
        .update((question || "").toLowerCase().trim() + "|" + (model || ""))
        .digest("hex");
}

function getCached(key) {
    const hit = answerCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL) {
        answerCache.delete(key);
        return null;
    }
    return hit.value;
}

function setCached(key, value) {
    if (answerCache.size >= CACHE_MAX) {
        const first = answerCache.keys().next().value;
        answerCache.delete(first);
    }
    answerCache.set(key, { value, ts: Date.now() });
}

function getDisplayName(meta){

    if(
        meta.title &&
        meta.title.trim()
    ){

        return meta.title;

    }

    return meta.filename;

}

const NOT_FOUND_SENTENCE =
"Informasi tersebut tidak ditemukan dalam dokumen yang tersedia";

const NEGATIVE_PHRASES = [
    "tidak ditemukan",
    "tidak tersedia",
    "tidak ada informasi",
    "tidak terdapat",
    "tidak disebutkan",
    "tidak ada data"
];

const CITATION_PATTERN = /\[\s*\d+\s*\]/;

function isNotFoundAnswer(answer) {

    if (!answer || typeof answer !== "string") return false;

    const normalized =
    answer
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.*$/, "");

    if (normalized === NOT_FOUND_SENTENCE) return true;

    const lower =
    normalized
    .toLowerCase();

    const hasNegativePhrase =
    NEGATIVE_PHRASES.some((p) => lower.includes(p));

    const hasCitation =
    CITATION_PATTERN.test(answer);

    return hasNegativePhrase && !hasCitation;

}

function visibleText(answer) {
    return String(answer || "")
        .replace(/\s*\[\d+\s*(?:,\s*\d+\s*)*\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isUsableAnswer(answer) {
    if (!answer || !String(answer).trim()) return false;
    return visibleText(answer).length >= 10;
}

function isTruncatedAnswer(answer) {
    if (!answer || typeof answer !== "string") return true;
    const t = answer.trim();
    if (t.length < 50) return true;

    if (/[.!?…)"'\]}:]\s*$/.test(t)) return false;
    if (/\[\s*\d+\s*\]\.?$/.test(t)) return false;
    return true;
}

function answerQuality(answer) {

    let score = 0;
    if (!isTruncatedAnswer(answer)) score++;
    if (CITATION_PATTERN.test(answer || "")) score++;
    if (visibleText(answer).length >= 20) score++;
    return score;
}

function filterSourcesByCitations(answer, sources) {
    if (!isUsableAnswer(answer)) return [];
    if (!Array.isArray(sources) || sources.length === 0) return sources;
    const matches = [...String(answer).matchAll(/\[\s*(\d+)\s*\]/g)];
    if (matches.length === 0) {

        return sources.slice(0, 1);
    }
    const cited = new Set();
    for (const m of matches) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= sources.length) cited.add(n - 1);
    }
    if (cited.size === 0) return sources.slice(0, 1);

    return [...cited].sort((a, b) => a - b).slice(0, 7).map(i => sources[i]);
}

async function generateUsableAnswer(question, context, model, history, sources) {
    let answer = await generateAnswer(question, context, model, history);
    console.log("[answer]:", answer);

    if (!isNotFoundAnswer(answer) && sources.length > 0 && !isUsableAnswer(answer)) {
        console.log("[RETRY] jawaban kosong/hanya sitasi, coba lagi");
        try {
            const retry = await generateAnswer(question, context, model, history);
            if (isUsableAnswer(retry) || isNotFoundAnswer(retry)) {
                console.log("[RETRY] pakai hasil retry");
                answer = retry;
            }
        } catch (err) {
            console.log("[RETRY] gagal:", err.message);
        }
    }

    if (!isNotFoundAnswer(answer) && sources.length > 0 && answerQuality(answer) < 2 && isUsableAnswer(answer)) {
        const q0 = answerQuality(answer);
        console.log(`[RETRY] skor ${q0}/3, coba lagi`);
        try {
            const retry = await generateAnswer(question, context, model, history);
            if (!isNotFoundAnswer(retry) && answerQuality(retry) > q0) {
                console.log(`[RETRY] pakai hasil retry (skor ${answerQuality(retry)}/3)`);
                answer = retry;
            }
        } catch (err) {
            console.log("[RETRY] gagal:", err.message);
        }
    }

    if (!isNotFoundAnswer(answer) && sources.length > 0 && !isUsableAnswer(answer)) {
        throw new Error("Model tidak menghasilkan jawaban yang dapat ditampilkan. Silakan coba lagi.");
    }

    if (!answer || !String(answer).trim()) {
        throw new Error("Model tidak menghasilkan jawaban. Silakan coba lagi.");
    }

    return answer;
}

export async function askRAG(question, model, history) {

    const conv = detectConversational(question, history);
    if (conv.isConversational) {
        console.log(`[CONV] ${conv.matchName}, skip retrieval`);
        const answer = await generateConversationalAnswer(question, model, history, conv.matchName);
        if (!answer || !String(answer).trim()) {
            throw new Error("Model tidak menghasilkan jawaban. Silakan coba lagi.");
        }
        return { answer, sources: [], conversational: true };
    }

    const gate = resolveContextualQuery(question, history);
    const retrievalQuery = gate.gateApplied ? gate.searchQuery : question;
    const key = cacheKey(retrievalQuery, model);
    const cached = getCached(key);
    if (cached && (!history || history.length === 0)) {
        console.log("Cache hit ->", retrievalQuery.slice(0, 60));
        return cached;
    }

    console.log("Q:", question);
    if (gate.gateApplied) {
        console.log(`[GATE] follow-up (${gate.reason})`);
    }
    console.log("======================");

    const result =
    await searchDocuments(retrievalQuery);

    if(
        !result.documents ||
        result.documents.length === 0
    ){

        return {

            answer:
            "Informasi tersebut tidak ditemukan dalam dokumen yang tersedia.",

            sources:[]

        };

    }

    console.log(
        "Jumlah dokumen:",
        result.documents.length
    );

    let context = "";

    let sources = [];

    result.documents.forEach(
        (doc,index)=>{

            const meta =
            result.metadata[index];

            const displayName =
            getDisplayName(meta);

            context += `

FILE:
${displayName}

HALAMAN:
${meta.printedPage ?? meta.page}

ISI DOKUMEN:
${doc}

========================

`;

            sources.push({

    filename:
    meta.filename,

    title:
    meta.title ?? "",

    page:
    meta.page,

    printedPage:
    meta.printedPage ?? meta.page,

    distance:
    result.distances[index]

});

        }

    );

    console.log(
        "Context berhasil dibuat"
    );

    const answer =
    await generateUsableAnswer(question, context, model, history, sources);

    let finalSources = sources;

    if (isNotFoundAnswer(answer)) {
        finalSources = [];
        console.log("[CITE-FILTER] NotFound -> 0 sumber");
    } else {
        const before = sources.length;
        finalSources = filterSourcesByCitations(answer, sources);
        console.log(`[CITE-FILTER] ${before} -> ${finalSources.length} sumber`);
    }

    const resultToReturn = {
        answer,
        sources: finalSources
    };

    if (!history || history.length === 0) {
        setCached(key, resultToReturn);
    }

    return resultToReturn;

}

export async function* streamRAG(
    question,
    model,
    history
){

    const convStream = detectConversational(question, history);
    if (convStream.isConversational) {
        console.log(`[CONV-STREAM] ${convStream.matchName}, skip retrieval`);
        try {
            const stream = await generateConversationalAnswerStream(question, model, history, convStream.matchName);
            let full = "";
            for await (const part of stream) {
                const delta = part.choices?.[0]?.delta?.content;
                if (!delta) continue;
                full += delta;
                yield { type: "delta", text: delta };
            }
            const convAnswer = full.trim();
            yield {
                type: "done",
                answer: convAnswer || "Maaf, terjadi kesalahan. Silakan coba lagi.",
                sources: [],
                conversational: true
            };
        } catch (err) {
            console.log("[CONV-GATE-STREAM] Error:", err.message);
            yield { type: "done", answer: "Maaf, terjadi kesalahan. Silakan coba lagi.", sources: [], conversational: true };
        }
        return;
    }

    const gateStream = resolveContextualQuery(question, history);
    const retrievalQueryStream = gateStream.gateApplied ? gateStream.searchQuery : question;
    if (gateStream.gateApplied) {
        console.log(`[GATE-STREAM] follow-up (${gateStream.reason})`);
    }

    const result =
    await searchDocuments(retrievalQueryStream);

    if(
        !result.documents ||
        result.documents.length === 0
    ){

        const fallback =
        "Informasi tersebut tidak ditemukan dalam dokumen yang tersedia.";

        yield {
            type: "done",
            answer: fallback,
            sources: []
        };

        return;

    }

    let context = "";

    let sources = [];

    result.documents.forEach(
        (doc,index)=>{

            const meta =
            result.metadata[index];

            const displayName =
            getDisplayName(meta);

            context += `

FILE:
${displayName}

HALAMAN:
${meta.printedPage ?? meta.page}

ISI DOKUMEN:
${doc}

========================

`;

            sources.push({
                filename: meta.filename,
                title: meta.title ?? "",
                page: meta.page,
                printedPage: meta.printedPage ?? meta.page,
                distance: result.distances[index]
            });

        }
    );

    const stream =
    await generateAnswerStream(
        question,
        context,
        model,
        history
    );

    let full = "";

    for await (const part of stream) {

        if (part && part.error) {
            const errMsg =
            part.error.message || part.error.code || "stream LLM gagal";
            throw new Error("Model AI gagal: " + errMsg);
        }

        const delta =
        part.choices?.[0]?.delta?.content;

        if (!delta) continue;

        full += delta;

        yield {
            type: "delta",
            text: delta
        };

    }

    let finalAnswer = full.trim();

    if (!isNotFoundAnswer(finalAnswer) && sources.length > 0 && !isUsableAnswer(finalAnswer)) {
        console.log("[RETRY-STREAM] jawaban kosong/hanya sitasi, ambil ulang");
        try {
            const retry = await generateAnswer(question, context, model, history);
            if (isUsableAnswer(retry) || isNotFoundAnswer(retry)) {
                console.log("[RETRY-STREAM] pakai hasil retry");
                finalAnswer = retry.trim();
            }
        } catch (err) {
            console.log("[RETRY-STREAM] gagal:", err.message);
        }
    } else if (!isNotFoundAnswer(finalAnswer) && sources.length > 0 && answerQuality(finalAnswer) < 2 && isUsableAnswer(finalAnswer)) {
        console.log(`[RETRY-STREAM] skor ${answerQuality(finalAnswer)}/3, ambil ulang`);
        try {
            const retry = await generateAnswer(question, context, model, history);
            if (!isNotFoundAnswer(retry) && answerQuality(retry) > answerQuality(finalAnswer)) {
                console.log(`[RETRY-STREAM] pakai hasil retry (skor ${answerQuality(retry)}/3)`);
                finalAnswer = retry.trim();
            }
        } catch (err) {
            console.log("[RETRY-STREAM] gagal:", err.message);
        }
    }

    const notFound =
    isNotFoundAnswer(finalAnswer);

    if (!finalAnswer || !finalAnswer.trim()) {
        throw new Error("Model tidak menghasilkan jawaban. Silakan coba lagi.");
    }

    if (!notFound && sources.length > 0 && !isUsableAnswer(finalAnswer)) {
        throw new Error("Model tidak menghasilkan jawaban yang dapat ditampilkan. Silakan coba lagi.");
    }

    const finalStreamSources = notFound ? [] : filterSourcesByCitations(finalAnswer, sources);

    yield {
        type: "done",
        answer: finalAnswer,
        sources: finalStreamSources
    };

}
