import { searchDocuments } from "./retrieverService.js";
import { generateAnswer } from "./llmService.js";


function getDisplayName(meta){

    if(
        meta.title &&
        meta.title.trim()
    ){

        return meta.title;

    }

    return meta.filename;

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
${meta.page}


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
// Sebelumnya: memakai substring (mis. cek "tidak
// tersedia"), sehingga jawaban SAH yang kebetulan
// memuat kata itu pun sitasinya ikut dihapus.
//
// Sekarang: dibandingkan dengan KALIMAT BAKU yang
// didefinisikan di prompt LLM (llmService.js, aturan
// 6). Hanya jika jawaban LLM persis kalimat itu,
// sistem menganggap tidak ada informasi dan
// mengosongkan sitasi. Selain itu, sitasi tetap
// dipertahankan.
// ==============================================

const NOT_FOUND_SENTENCE =
"Informasi tersebut tidak ditemukan dalam dokumen yang tersedia";


function isNotFoundAnswer(answer){


    const normalized =
    answer
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.*$/, "");


    return normalized === NOT_FOUND_SENTENCE;


}


if(isNotFoundAnswer(answer)){

    finalSources = [];

}



return {

    answer,

    sources: finalSources

};


}