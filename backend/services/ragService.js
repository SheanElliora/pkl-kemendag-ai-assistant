import { searchDocuments } from "./retrieverService.js";
import { generateAnswer } from "./llmService.js";


export async function askRAG(question){


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



            context += `

FILE:
${meta.filename}

HALAMAN:
${meta.page}


ISI DOKUMEN:
${doc}


========================


`;



            sources.push({

    filename:
    meta.filename,

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

        context

    );


    console.log("\n===== HASIL JAWABAN LLM =====");
    console.log(answer);
    console.log("==============================");



    let finalSources = sources;


const noInformationFound =
answer.toLowerCase().includes("tidak ditemukan") ||
answer.toLowerCase().includes("tidak terdapat informasi") ||
answer.toLowerCase().includes("tidak tersedia");


if(noInformationFound){

    finalSources = [];

}



return {

    answer,

    sources: finalSources

};


}