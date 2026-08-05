import { ChromaClient } from "chromadb";


const client =
new ChromaClient({

    host:"localhost",
    port:8000

});


const collections =
await client.listCollections();


console.log(collections);