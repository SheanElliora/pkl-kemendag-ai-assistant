import { 
    loadAllPDFs,
    loadSinglePDF
} from "./services/pdfLoader.js";

import { createEmbedding } from "./services/embedderService.js";

import {
    saveVector,
    getExistingIds
} from "./services/vectorStorage.js";



// ======================================
// Fungsi ingest 1 dokumen
// Dipakai saat upload file baru
// ======================================

export async function ingestDocument(filename){


    const document =
    await loadSinglePDF(filename);


    await processDocuments(
        [document]
    );


}



// ======================================
// Fungsi proses embedding + simpan vector
// ======================================

async function processDocuments(documents){


    const existingIds =
    await getExistingIds();


    console.log(
        "Vector lama:",
        existingIds.length
    );


    let total = 0;
    let baru = 0;
    let skip = 0;



    for(const doc of documents){


        console.log("\n==================================");
        console.log(
            "Dokumen:",
            doc.filename
        );
        console.log("==================================");



        for(
            let i = 0;
            i < doc.chunks.length;
            i++
        ){


            total++;


            const chunk =
            doc.chunks[i];



            const id =
            `${doc.filename}_${chunk.page}_${i}`;



            if(existingIds.includes(id)){


                skip++;

                continue;

            }



            console.log(
                `Embedding ${total}`
            );



            const vector =
            await createEmbedding(
                chunk.text
            );



            await saveVector(

                {

                    id,

                    filename:
                    doc.filename,

                    page:
                    chunk.page,

                    text:
                    chunk.text

                },

                vector

            );



            baru++;


            console.log(
                `Selesai ${baru}`
            );


        }


    }



    console.log("\n==============================");

    console.log(
        "Total chunk :",
        total
    );


    console.log(
        "Vector baru :",
        baru
    );


    console.log(
        "Vector lama :",
        skip
    );


    console.log(
        "INGEST SELESAI"
    );


    console.log(
        "==============================");


}



// ======================================
// Mode lama: npm run ingest
// Proses semua dokumen di docs
// ======================================

const isDirectRun =
process.argv[1]?.includes("ingest.js");



if(isDirectRun){


    const documents =
    await loadAllPDFs();



    await processDocuments(
        documents
    );


}