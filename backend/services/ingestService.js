import { loadAllPDFs } from "./pdfLoader.js";
import { createEmbedding } from "./embedderService.js";
import {
    saveVector,
    getExistingIds
} from "./vectorStorage.js";


export async function ingestDocument(){


    const documents = await loadAllPDFs();


    const existingIds =
    await getExistingIds();


    console.log(
        "Vector lama:",
        existingIds.length
    );


    let total = 0;
    let baru = 0;
    let skip = 0;



    for (const doc of documents) {


        console.log("\n==================================");
        console.log("Dokumen:", doc.filename);
        console.log("==================================");



        for (let i = 0; i < doc.chunks.length; i++) {


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

    console.log("==============================");

}

    export async function ingestSinglePDF(filename){


    console.log(
        "\n================================"
    );

    console.log(
        "INGEST SINGLE:",
        filename
    );

    console.log(
        "================================"
    );



    const documents =
    await loadAllPDFs();



    const doc =
    documents.find(
        item =>
        item.filename === filename
    );



    if(!doc){

        console.log(
            "Dokumen tidak ditemukan:",
            filename
        );

        return;

    }



    const existingIds =
    await getExistingIds();



    let baru = 0;



    for(
        let i = 0;
        i < doc.chunks.length;
        i++
    ){


        const chunk =
        doc.chunks[i];



        const id =
        `${doc.filename}_${chunk.page}_${i}`;



        if(existingIds.includes(id)){

            console.log(
                "Skip:",
                id
            );

            continue;

        }



        console.log(
            "Embedding:",
            i+1
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


    }



    console.log(
        "Vector baru:",
        baru
    );


    console.log(
        "INGEST SINGLE SELESAI"
    );


}