import { ChromaClient } from "chromadb";

const client = new ChromaClient();

const COLLECTION_NAME = "sip_documents";

async function getCollection() {

    try {

        return await client.getCollection({

            name: COLLECTION_NAME,
            embeddingFunction: null

        });

    }

    catch {

        return await client.createCollection({

            name: COLLECTION_NAME,
            embeddingFunction: null

        });

    }

}

// ======================================================
// Menyimpan SATU chunk saja
// ======================================================

export async function saveVector(chunk, vector) {

    const collection = await getCollection();

    await collection.add({

        ids: [

            chunk.id

        ],

        embeddings: [

            vector

        ],

        documents: [

            chunk.text

        ],

        metadatas: [

            {

                filename: chunk.filename,

                title: chunk.title ?? "",

                page: chunk.page,

                printedPage:
                    chunk.printedPage ?? chunk.page

            }

        ]

    });

}

// ======================================================

export async function getExistingIds() {

    try {

        const collection = await getCollection();

        const result = await collection.get();

        return result.ids;

    }

    catch {

        return [];

    }

}

// ======================================================
// Menghapus SEMUA vector milik satu dokumen (per filename)
// Dipakai saat dokumen dihapus dari sistem.
// ======================================================

export async function deleteVectorsByFilename(filename) {

    const collection = await getCollection();

    await collection.delete({

        where: { filename }

    });

}