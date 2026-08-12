import { searchDocuments } from "./retrieverService.js";
import { generateAnswer, generateAnswerStream } from "./llmService.js";


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


export async function askRAG(
    question,
    model
){


    console.log("\n======================");
    console.log("PERTANYAAN USER:");
    console.log(question);
    console.log("======================");



    // ==========================
    // 1. RETRIEVE DOCUMENT
    // ==========================

    const result =
    await searchDocuments(question);



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

    const answer =
    await generateAnswer(

        question,

        context,

        model

    );


    console.log("\n===== HASIL JAWABAN LLM =====");
    console.log(answer);
    console.log("==============================");



    let finalSources = sources;


// ==============================================
// Deteksi jawaban "informasi tidak ditemukan"
//
// (Definisi konstanta & fungsi dipindah ke level
//  modul agar bisa dipakai jadi satu oleh
//  askRAG dan streamRAG. Lihat bagian bawah file.)
// ==============================================

if(isNotFoundAnswer(answer)){

    finalSources = [];

}



return {

    answer,

    sources: finalSources

};


}


// =====================================================
// Streaming jawaban untuk efek "mengetik".
// Menghasilkan potongan teks (delta) satu per satu.
// Pada akhirnya mengirim status done beserta sitasi.
// =====================================================

export async function* streamRAG(
    question,
    model
){

    const result =
    await searchDocuments(question);

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
        model
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

    const notFound =
    isNotFoundAnswer(full);

    yield {
        type: "done",
        answer: full.trim(),
        sources: notFound ? [] : sources
    };

}