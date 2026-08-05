import { ChromaClient } from "chromadb";
import { createEmbedding } from "./embedderService.js";


const client = new ChromaClient();


export async function retrieveFromChroma(query){

    const collection =
    await client.getCollection({
        name:"sip_documents"
    });


    const queryVector =
    await createEmbedding(query);


    const results =
    await collection.query({

        queryEmbeddings:[
            queryVector
        ],

        nResults:5

    });


    return results;

}