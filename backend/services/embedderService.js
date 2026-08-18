import { pipeline } from "@xenova/transformers";



// ==============================
// Local Embedding Model
//
// intfloat/multilingual-e5-small:
// model retrieval lintas bahasa (termasuk
// Indonesia <-> Inggris) dengan akurasi jauh
// lebih baik daripada MiniLM untuk pencarian
// semantik. e5 mengharuskan teks diberi
// prefix sesuai peran:
//   - "query: "   untuk pertanyaan user
//   - "passage: " untuk isi dokumen/chunk
// Tanpa prefix, kualitas embedding menurun.
// ==============================


let embedder = null;



async function getEmbedder() {

    if (!embedder) {

        console.log(
            "Loading embedding model (multilingual-e5-small)..."
        );


        embedder = await pipeline(
            "feature-extraction",
            "Xenova/multilingual-e5-small"
        );


        console.log(
            "Embedding model siap"
        );

    }


    return embedder;

}



// ==============================
// Membuat embedding vector
//
// role:
//   "query"   -> pertanyaan user (prefix "query: ")
//   "passage" -> isi dokumen (prefix "passage: ")
// ==============================


export async function createEmbedding(
    text,
    role = "passage"
) {


    const model = await getEmbedder();


    const input =
    role === "query"
        ? "query: " + text
        : "passage: " + text;


    const output = await model(

        input,

        {
            pooling: "mean",
            normalize: true
        }

    );


    return Array.from(output.data);

}


// ==============================
// Embedding BATCH
//
// Memanggil model satu kali untuk
// BANYAK teks sekaligus (jauh lebih
// cepat daripada per-teks berurutan,
// terutama saat ingest dokumen baru).
//
// CATATAN transformers.js: bentuk
// keluaran bisa bervariasi antar
// versi — tensor batch tunggal,
// array Tensor per-teks, atau array
// berisi satu tensor batch. Semua
// bentuk digabung jadi flat lalu
// dipotong per teks berdasarkan
// dimensi model.
// ==============================

export async function createEmbeddingsBatch(
    texts,
    role = "passage"
) {

    const model = await getEmbedder();

    const inputs =
    texts.map(
        (t) =>
        role === "query"
            ? "query: " + t
            : "passage: " + t
    );

    const output =
    await model(
        inputs,
        {
            pooling: "mean",
            normalize: true
        }
    );

    const outputs =
    Array.isArray(output)
        ? output
        : [output];

    const flat =
    new Float32Array(
        outputs.reduce(
            (acc, tensor) =>
            acc.concat(
                Array.from(tensor.data)
            ),
            []
        )
    );

    const n = texts.length;

    const dim = flat.length / n;

    const result = [];

    for (let i = 0; i < n; i++) {

        result.push(
            Array.from(
                flat.slice(
                    i * dim,
                    (i + 1) * dim
                )
            )
        );

    }

    return result;

}