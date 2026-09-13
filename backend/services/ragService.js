import crypto from "crypto";
import { searchDocuments } from "./retrieverService.js";
import { generateAnswer, generateAnswerStream, generateConversationalAnswer, generateConversationalAnswerStream } from "./llmService.js";
import { resolveContextualQuery } from "./contextGateService.js";
import { detectConversational } from "./conversationalGateService.js";

// Cache jawaban 10 menit untuk pertanyaan identik (hemat embedding+rerank+LLM, <100ms hit)
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


// ==== Deteksi jawaban "informasi tidak ditemukan" ====
//
// Fungsi & konstanta diletakkan di level modul agar bisa
// dipakai oleh askRAG (non-stream) dan streamRAG (stream).
//
// Strategi:
//   - Cocok persis dengan kalimat baku (kasus ideal).
//   - ATAU mengandung frasa negatif yang jelas + TIDAK memuat
//     kutipan [n]. Sesuai aturan prompt #52, jawaban "tidak
//     ditemukan" memang tidak boleh disertai kutipan. Sebaliknya
//     jawaban SAH yang memuat data dari dokumen pasti mengutip
//     [n], sehingga tidak akan salah dianggap "tidak ditemukan".
// =====================================================

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

// ==== Deteksi jawaban berkualitas rendah (jangka pendek) ====
//
// Model gratis kadang berhenti di tengah kata ("...31,2 j") atau
// lupa sitasi [n] padahal sumber ada. Kedua pola ini dideteksi
// agar bisa retry 1x sebelum dikirim ke user.
//
// BUKAN not-found: isNotFoundAnswer dicek duluan oleh pemanggil,
// helper ini hanya untuk jawaban yang SEHARUSNYA berisi data.
// =============================================================

function isTruncatedAnswer(answer) {
    if (!answer || typeof answer !== "string") return true;
    const t = answer.trim();
    if (t.length < 50) return true; // terlalu pendek utk jawaban berisi data
    // Lengkap bila diakhiri tanda akhir kalimat / kutip / kurung / sitasi
    if (/[.!?…)"'\]}:]\s*$/.test(t)) return false;
    if (/\[\s*\d+\s*\]\.?$/.test(t)) return false;
    return true; // berakhir tengah kata/klausa = terpotong
}

function answerQuality(answer) {
    // Skor 0-2: +1 lengkap (tidak terpotong), +1 ada sitasi [n]
    let score = 0;
    if (!isTruncatedAnswer(answer)) score++;
    if (CITATION_PATTERN.test(answer || "")) score++;
    return score;
}

function filterSourcesByCitations(answer, sources) {
    if (!answer || !Array.isArray(sources) || sources.length === 0) return sources;
    const matches = [...String(answer).matchAll(/\[\s*(\d+)\s*\]/g)];
    if (matches.length === 0) {
        // LLM lupa sitasi tapi jawaban bukan NotFound — tampilkan 1 paling relevan saja biar kerucut
        return sources.slice(0, 1);
    }
    const cited = new Set();
    for (const m of matches) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= sources.length) cited.add(n - 1);
    }
    if (cited.size === 0) return sources.slice(0, 1);
    // Universal: tampilkan semua yang dikutip (1 dokumen 1 halaman bila 1 fakta, 3-5 dokumen bila gabungan seperti "informasi lain tentang Jepang")
    // Batasi longgar 7 biar tidak bawa 10 bila LLM kutip banyak
    return [...cited].sort((a, b) => a - b).slice(0, 7).map(i => sources[i]);
}


export async function askRAG(question, model, history) {
    // ==========================================
    // GATE 0: Deteksi percakapan (sapaan/chit-chat)
    // Skip retrieval, langsung ke LLM tanpa context
    // ==========================================
    const conv = detectConversational(question, history);
    if (conv.isConversational) {
        console.log(`[CONV-GATE] Percakapan terdeteksi (${conv.matchName}) -> skip retrieval:`);
        console.log(`  Q: "${question.slice(0, 80)}"`);
        const answer = await generateConversationalAnswer(question, model, history, conv.matchName);
        console.log(`[CONV-GATE] Jawaban: "${answer.slice(0, 100)}..."`);
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

    console.log("\n======================");
    console.log("PERTANYAAN USER:");
    console.log(question);
    if (gate.gateApplied) {
        console.log(`[GATE] follow-up terdeteksi (${gate.reason}) -> retrieval diperkaya:`);
        console.log(`  Q asli: "${question.slice(0,120)}"`);
        console.log(`  + konteks: "${gate.contextUsed?.slice(0,120)}"`);
    }
    console.log("======================");

    // ==========================
    // 1. RETRIEVE DOCUMENT (dengan Context Gate)
    // ==========================

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



    // ==========================
    // 2. BUAT CONTEXT
    // ==========================


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



    // ==========================
    // 3. KIRIM KE LLM
    // ==========================

    console.log("\n===== CONTEXT =====");
    console.log(context);
    console.log("===================");

    let answer =
    await generateAnswer(

        question,

        context,

        model,

        history

    );


    console.log("\n===== HASIL JAWABAN LLM =====");
    console.log(answer);
    console.log("==============================");

    // Retry 1x bila jawaban berkualitas rendah (terpotong / tanpa
    // sitasi padahal sumber ada). Bukan untuk NotFound yang sah.
    if (!isNotFoundAnswer(answer) && sources.length > 0) {
        const q0 = answerQuality(answer);
        if (q0 < 2) {
            console.log(`[RETRY] kualitas rendah (skor ${q0}/2, terpotong:${isTruncatedAnswer(answer)}) -> coba 1x lagi`);
            try {
                const retry = await generateAnswer(question, context, model, history);
                if (!isNotFoundAnswer(retry) && answerQuality(retry) > q0) {
                    console.log(`[RETRY] hasil retry lebih baik (skor ${answerQuality(retry)}/2) -> pakai retry`);
                    answer = retry;
                } else {
                    console.log(`[RETRY] retry tidak lebih baik (skor ${answerQuality(retry)}/2) -> pakai jawaban awal`);
                }
            } catch (err) {
                console.log("[RETRY] gagal:", err.message, "-> pakai jawaban awal");
            }
        }
    }



    let finalSources = sources;

if (isNotFoundAnswer(answer)) {
        finalSources = [];
        console.log("[CITE-FILTER] NotFound -> 0 sumber");
    } else {
        const before = sources.length;
        finalSources = filterSourcesByCitations(answer, sources);
        console.log(`[CITE-FILTER] ${before} -> ${finalSources.length} sumber (kutipan: ${[...answer.matchAll(/\[\s*\d+\s*\]/g)].map(m=>m[0]).join(", ").slice(0,120)})`);
    }

    const resultToReturn = {
        answer,
        sources: finalSources
    };

    // simpan cache hanya untuk tanpa history (pertanyaan tunggal)
    if (!history || history.length === 0) {
        setCached(key, resultToReturn);
    }

    return resultToReturn;


}


// =====================================================
// Streaming jawaban untuk efek "mengetik".
// Menghasilkan potongan teks (delta) satu per satu.
// Pada akhirnya mengirim status done beserta sitasi.
// =====================================================

export async function* streamRAG(
    question,
    model,
    history
){
    // ==========================================
    // GATE 0: Deteksi percakapan (sapaan/chit-chat)
    // Skip retrieval, langsung stream tanpa context
    // ==========================================
    const convStream = detectConversational(question, history);
    if (convStream.isConversational) {
        console.log(`[CONV-GATE-STREAM] Percakapan terdeteksi (${convStream.matchName}) -> skip retrieval:`);
        console.log(`  Q: "${question.slice(0, 80)}"`);
        try {
            const stream = await generateConversationalAnswerStream(question, model, history, convStream.matchName);
            let full = "";
            for await (const part of stream) {
                const delta = part.choices?.[0]?.delta?.content;
                if (!delta) continue;
                full += delta;
                yield { type: "delta", text: delta };
            }
            yield { type: "done", answer: full.trim(), sources: [], conversational: true };
        } catch (err) {
            console.log("[CONV-GATE-STREAM] Error:", err.message);
            yield { type: "done", answer: "Maaf, terjadi kesalahan. Silakan coba lagi.", sources: [], conversational: true };
        }
        return;
    }

    const gateStream = resolveContextualQuery(question, history);
    const retrievalQueryStream = gateStream.gateApplied ? gateStream.searchQuery : question;
    if (gateStream.gateApplied) {
        console.log(`[GATE-STREAM] follow-up (${gateStream.reason}) -> retrieval diperkaya`);
        console.log(`  Q: "${question.slice(0,120)}" + "${gateStream.contextUsed?.slice(0,120)}"`);
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

        const delta =
        part.choices?.[0]?.delta?.content;

        if (!delta) continue;

        full += delta;

        yield {
            type: "delta",
            text: delta
        };

    }

    // Retry 1x (non-stream) bila hasil stream berkualitas rendah.
    // Aman: frontend mengganti teks stream dengan answer pada done,
    // jadi user melihat jawaban retry yang utuh, bukan duplikat.
    let finalAnswer = full.trim();
    if (!isNotFoundAnswer(finalAnswer) && sources.length > 0 && answerQuality(finalAnswer) < 2) {
        console.log(`[RETRY-STREAM] kualitas rendah (skor ${answerQuality(finalAnswer)}/2) -> ambil ulang non-stream 1x`);
        try {
            const retry = await generateAnswer(question, context, model, history);
            if (!isNotFoundAnswer(retry) && answerQuality(retry) > answerQuality(finalAnswer)) {
                console.log(`[RETRY-STREAM] hasil retry lebih baik (skor ${answerQuality(retry)}/2) -> pakai retry`);
                finalAnswer = retry.trim();
            } else {
                console.log(`[RETRY-STREAM] retry tidak lebih baik -> pakai hasil stream`);
            }
        } catch (err) {
            console.log("[RETRY-STREAM] gagal:", err.message, "-> pakai hasil stream");
        }
    }

    const notFound =
    isNotFoundAnswer(finalAnswer);

    const finalStreamSources = notFound ? [] : filterSourcesByCitations(finalAnswer, sources);

    yield {
        type: "done",
        answer: finalAnswer,
        sources: finalStreamSources
    };

}