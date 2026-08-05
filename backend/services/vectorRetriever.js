import { ChromaClient } from "chromadb";
import { createEmbedding } from "./embedderService.js";


const client = new ChromaClient({
    host:"localhost",
    port:8000
});


export async function searchVector(query){


    const collection =
        await client.getCollection({
            name:"sip_documents"
        });


    const queryVector =
        await createEmbedding(query);



    const result =
        await collection.query({

            queryEmbeddings:[
                queryVector
            ],

            nResults:5

        });



    return {

    documents:
        result.documents[0],

    metadata:
        result.metadatas[0]

};

}