import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@xenova/transformers";


// ==============================
// Membagi text menjadi chunk
// ==============================

export async function splitText(text) {

    const splitter = new RecursiveCharacterTextSplitter({

        chunkSize: 1000,
        chunkOverlap: 200

    });


    const chunks = await splitter.splitText(text);


    console.log(
        "Jumlah chunk:",
        chunks.length
    );


    return chunks;

}



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
            "Xenova/all-MiniLM-L6-v2"
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