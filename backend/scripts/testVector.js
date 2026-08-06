import { ChromaClient } from "chromadb";


const client = new ChromaClient();


const collection =
await client.getCollection({

    name:"sip_documents",

    embeddingFunction:null

});


const result =
await collection.get({

    where:{
        filename:"jurnal ai 1.pdf"
    }

});


console.log(
    "Jumlah vector jurnal:",
    result.ids.length
);


console.log(
    result.metadatas.slice(0,5)
);