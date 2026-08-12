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