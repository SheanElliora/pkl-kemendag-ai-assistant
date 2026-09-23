import crypto from "crypto";
import { searchDocuments } from "./retrieverService.js";
import { generateAnswer, generateAnswerStream, generateConversationalAnswer, generateConversationalAnswerStream, stripModelReasoning, findAnswerStart, couldBeReasoningStart } from "./llmService.js";
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

function hasAnswerMarkerSafe(text) {
    return /(?:let'?s craft (?:the )?answer|let me craft (?:the )?answer|here(?:'s| is) (?:the )?(?:final )?answer|berikut (?:adalah )?jawaban|\bjawaban\s*:|\bfinal answer\s*:)/i.test(text);
}

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
    if (t.length < 40) return true;

    if (/\*\*[^*\n]*$/.test(t)) return true;
    if (/\n\s*\d+\.?\s*$/.test(t)) return true;
    if (/\d+\.\s*$/.test(t) && !/\[\s*\d+\s*\]\s*\.\s*$/.test(t)) return true;
    if (/[,;:]\s*$/.test(t)) return true;
    if (/\b(dan|yang|atau|dengan|untuk|adalah|the|and|of|to|in|for)\s*$/i.test(t)) return true;

    if (/\[\s*\d+\s*\]\.?\s*$/.test(t)) return false;
    if (/[.!?…)"'\]}\-•]\s*$/.test(t)) return false;
    return !/[0-9A-Za-zÀ-ÿ%)\]]\s*$/.test(t);
}

function answerQuality(answer) {

    let score = 0;
    if (!isTruncatedAnswer(answer)) score++;
    if (CITATION_PATTERN.test(answer || "")) score++;
    if (visibleText(answer).length >= 20) score++;
    return score;
}

function needsQualityRetry(answer, sources) {
    if (!answer || isNotFoundAnswer(answer)) return false;
    if (!sources || sources.length === 0) return false;
    if (!isUsableAnswer(answer)) return false;
    if (isTruncatedAnswer(answer)) return true;
    if (!CITATION_PATTERN.test(answer || "")) return true;
    return false;
}

function isBetterAnswer(candidate, current) {
    if (!candidate || !String(candidate).trim()) return false;
    if (!current || !String(current).trim()) return true;
    if (isNotFoundAnswer(candidate) && !isNotFoundAnswer(current)) return false;
    if (!isNotFoundAnswer(candidate) && isNotFoundAnswer(current)) return true;

    const cTrunc = isTruncatedAnswer(candidate);
    const curTrunc = isTruncatedAnswer(current);
    if (curTrunc && !cTrunc) return true;
    if (!curTrunc && cTrunc) return false;

    const cq = answerQuality(candidate);
    const curq = answerQuality(current);
    if (cq !== curq) return cq > curq;

    return candidate.trim().length > current.trim().length;
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
    let { answer, model: usedModel } = await generateAnswer(question, context, model, history);
    console.log("[answer]:", answer);

    const shouldRetry =
    !isNotFoundAnswer(answer) &&
    sources.length > 0 &&
    (!isUsableAnswer(answer) || needsQualityRetry(answer, sources));

    if (shouldRetry) {
        console.log(`[RETRY] kualitas skor ${answerQuality(answer)}/3 truncated=${isTruncatedAnswer(answer)}, 1x retry`);
        try {
            const retry = await generateAnswer(question, context, model, history, [usedModel]);
            if (
                (isUsableAnswer(retry.answer) || isNotFoundAnswer(retry.answer)) &&
                (isBetterAnswer(retry.answer, answer) || !isUsableAnswer(answer))
            ) {
                console.log(`[RETRY] pakai hasil retry (skor ${answerQuality(retry.answer)}/3 truncated=${isTruncatedAnswer(retry.answer)})`);
                answer = retry.answer;
                usedModel = retry.model;
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

    return { answer, model: usedModel };
}

export async function askRAG(question, model, history) {

    const conv = detectConversational(question, history);
    if (conv.isConversational) {
        console.log(`[CONV] ${conv.matchName}, skip retrieval`);
        const { answer, model: usedModel } = await generateConversationalAnswer(question, model, history, conv.matchName);
        if (!answer || !String(answer).trim()) {
            throw new Error("Model tidak menghasilkan jawaban. Silakan coba lagi.");
        }
        return { answer, sources: [], conversational: true, model: usedModel };
    }

    const gate = resolveContextualQuery(question, history);
    const retrievalQuery = gate.gateApplied ? gate.searchQuery : question;
    const key = cacheKey(retrievalQuery, model);
    const cached = getCached(key);
    if (cached && (!history || history.length === 0)) {
        console.log("Cache hit:", retrievalQuery.slice(0, 60));
        return cached;
    }

    console.log("Q:", question);
    if (gate.gateApplied) {
        console.log(`[GATE] follow-up (${gate.reason})`);
    }

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

    const { answer, model: usedModel } =
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
        sources: finalSources,
        model: usedModel
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
            const { stream, model: usedModel } = await generateConversationalAnswerStream(question, model, history, convStream.matchName);
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
                conversational: true,
                model: usedModel
            };
        } catch (err) {
            console.log("[CONV-GATE-STREAM] Error:", err.message);
            yield { type: "done", answer: "Maaf, terjadi kesalahan. Silakan coba lagi.", sources: [], conversational: true, model: model || null };
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

    const STREAM_ABORT_CHARS = 80;
    const STREAM_MAX_RETRIES = 1;
    const STREAM_MIN_DECIDE = 40;
    const STREAM_MAX_HOLD = 2500;
    const triedModels = [];
    let finalAnswer = "";
    let usedModel = model || null;
    let bestAnswer = "";
    let bestModel = model || null;

    for (let attempt = 0; attempt <= STREAM_MAX_RETRIES; attempt++) {
        const started = await generateAnswerStream(question, context, model, history, triedModels);
        usedModel = started.model;
        triedModels.push(started.model);

        let full = "";
        let held = "";
        let released = false;
        let aborted = false;
        let sawError = null;

        try {
            for await (const part of started.stream) {
                if (part && part.error) {
                    sawError = part.error.message || part.error.code || "stream LLM gagal";
                    break;
                }

                const delta = part.choices?.[0]?.delta?.content;
                if (!delta) continue;

                full += delta;

                if (!released) {
                    held += delta;
                    let startIdx;
                    if (held.length < STREAM_MIN_DECIDE && !hasAnswerMarkerSafe(held)) {
                        startIdx = couldBeReasoningStart(held) ? -2 : 0;
                    } else {
                        startIdx = findAnswerStart(held);
                    }

                    if (startIdx === -2) {
                        if (held.length >= 12) {
                            released = true;
                            yield { type: "delta", text: held };
                            held = "";
                        }
                    } else if (startIdx === 0) {
                        released = true;
                        yield { type: "delta", text: held };
                        held = "";
                    } else if (startIdx > 0) {
                        released = true;
                        const partText = held.slice(startIdx);
                        held = "";
                        if (partText) yield { type: "delta", text: partText };
                    } else {
                        if (held.length >= STREAM_MAX_HOLD) {
                            console.log(`[STREAM-REASONING] tanpa jawaban setelah ${held.length} char, pindah model`);
                            aborted = true;
                            break;
                        }
                    }
                    continue;
                }

                yield { type: "delta", text: delta };
            }
        } catch (err) {
            sawError = err.message;
        }

        if (sawError) {
            console.log(`[STREAM] model ${usedModel} error: ${sawError}`);
            if (attempt >= STREAM_MAX_RETRIES) {
                throw new Error("Model AI gagal: " + sawError);
            }
            continue;
        }

        finalAnswer = stripModelReasoning(full).trim();

        if (isUsableAnswer(finalAnswer) && (!bestAnswer || isBetterAnswer(finalAnswer, bestAnswer))) {
            bestAnswer = finalAnswer;
            bestModel = usedModel;
        }

        const bad = aborted
            || !isUsableAnswer(finalAnswer)
            || (!isNotFoundAnswer(finalAnswer) && sources.length > 0 && needsQualityRetry(finalAnswer, sources));

        if (!bad) break;

        if (isNotFoundAnswer(finalAnswer) || sources.length === 0) break;

        if (attempt >= STREAM_MAX_RETRIES) {
            console.log(`[RETRY-STREAM] habis retry, pakai hasil terbaik`);
            break;
        }

        console.log(`[RETRY-STREAM] belum utuh/kosong (pakai: ${usedModel}), coba model berikut`);
    }

    if (bestAnswer && isBetterAnswer(bestAnswer, finalAnswer)) {
        finalAnswer = bestAnswer;
        usedModel = bestModel;
    }

    if (
        needsQualityRetry(finalAnswer, sources) &&
        isUsableAnswer(finalAnswer) &&
        !isNotFoundAnswer(finalAnswer)
    ) {
        console.log(`[RETRY-STREAM] 1x non-stream final`);
        try {
            const retry = await generateAnswer(question, context, model, history, triedModels);
            if (isBetterAnswer(retry.answer, finalAnswer) || !isUsableAnswer(finalAnswer)) {
                finalAnswer = retry.answer.trim();
                usedModel = retry.model;
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
        sources: finalStreamSources,
        model: usedModel
    };

}
