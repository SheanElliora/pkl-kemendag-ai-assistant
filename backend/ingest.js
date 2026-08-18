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


// ======================================
// Ukuran batch embedding: berapa chunk
// yang di-embed dalam SATU panggilan
// model ONNX. Lebih besar = lebih cepat,
// namun menaikkan puncak memori.
// ======================================

const EMBED_BATCH = 16;



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


    let existingIds =
    await getExistingIds();


    console.log(
        "Vector lama:",
        existingIds.length
    );


    let total = 0;
    let baru = 0;
    let skip = 0;

    // Batch chunk yang menunggu di-embed. Di-flush
    // tiap EMBED_BATCH item atau di akhir dokumen.
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


        // Chunk di-build ulang => dokumen baru/berubah.
        // Hapus vektor lama milik dokumen ini dari Chroma
        // agar tidak ada sisa vektor usang (sumber berubah
        // tapi vektor lama masih tertinggal).
        if (doc.rebuilt) {

            console.log(
                "Dokumen berubah, menghapus vektor lama:",
                doc.filename
            );

            await deleteVectorsByFilename(doc.filename);

            // ID vektor dokumen ini sudah terhapus, jadi
            // keluarkan dari snapshot existingIds agar
            // chunk-nya di-embed & disimpan ulang (tidak
            // di-skip karena id masih tercatat di snapshot
            // lama).
            const prefix = doc.filename + "_";

            existingIds =
            existingIds.filter(
                id => !id.startsWith(prefix)
            );

        }


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


            // Kumpulkan chunk yang belum punya vektor
            // lalu embed SECARA BATCH (satu panggilan
            // model untuk banyak chunk) — jauh lebih
            // cepat daripada satu per satu.



            pendingBatch.push({ id, chunk, doc });


            if (pendingBatch.length >= EMBED_BATCH) {

                await flushBatch();

            }


        }


        // Flush sisa chunk dokumen ini
        await flushBatch();


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