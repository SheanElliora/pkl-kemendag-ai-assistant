import { pipeline } from "@xenova/transformers";



// ==============================
// Local Embedding Model
// ==============================


let embedder = null;



async function getEmbedder() {

    if (!embedder) {

        console.log(
            "Loading embedding model..."
        );


        embedder = await pipeline(
            "feature-extraction",
            "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
        );


        console.log(
            "Embedding model siap"
        );

    }


    return embedder;

}



// ==============================
// Membuat embedding vector
// ==============================


export async function createEmbedding(text) {


    const model = await getEmbedder();



    const output = await model(

        text,

        {
            pooling: "mean",
            normalize: true
        }

    );



    return Array.from(output.data);

}