import { 
    loadAllPDFs,
    loadSinglePDF
} from "./services/pdfLoader.js";

import { createEmbeddingsBatch } from "./services/embedderService.js";

import {
    saveVector,
    getExistingIds,
    deleteVectorsByFilename
} from "./services/vectorStorage.js";

const EMBED_BATCH = 16;

export async function ingestDocument(filename){

    const document =
    await loadSinglePDF(filename);

    await processDocuments(
        [document]
    );

}

async function processDocuments(documents){

    let existingIds =
    await getExistingIds();

    console.log(
        "Vector lama:",
        existingIds.length
    );

    let total = 0;
    let baru = 0;
    let skip = 0;

    let pendingBatch = [];

    async function flushBatch() {

        if (pendingBatch.length === 0) return;

        console.log(
            `Embedding batch (${pendingBatch.length} chunk)...`
        );

        const vectors =
        await createEmbeddingsBatch(
            pendingBatch.map((p) => p.chunk.text)
        );

        for (let k = 0; k < pendingBatch.length; k++) {

            const { id, chunk, doc } = pendingBatch[k];

            await saveVector(

                {

                    id,

                    filename:
                    doc.filename,

                    title:
                    doc.title,

                    page:
                    chunk.page,

                    printedPage:
                    chunk.printedPage,

                    text:
                    chunk.text

                },

                vectors[k]

            );

            baru++;

        }

        console.log(
            `Selesai ${baru}`
        );

        pendingBatch = [];

    }

    for(const doc of documents){

        if (doc.rebuilt) {

            console.log(
                "Dokumen berubah, menghapus vektor lama:",
                doc.filename
            );

            await deleteVectorsByFilename(doc.filename);

            const prefix = doc.filename + "_";

            existingIds =
            existingIds.filter(
                id => !id.startsWith(prefix)
            );

        }

        console.log(
            "Dokumen:",
            doc.filename
        );

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

            pendingBatch.push({ id, chunk, doc });

            if (pendingBatch.length >= EMBED_BATCH) {

                await flushBatch();

            }

        }

        await flushBatch();

    }

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

    console.log("Ingest selesai");

}

const isDirectRun =
process.argv[1]?.includes("ingest.js");

if(isDirectRun){

    const documents =
    await loadAllPDFs();

    await processDocuments(
        documents
    );

}
