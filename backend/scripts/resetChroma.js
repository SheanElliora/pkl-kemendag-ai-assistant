import { ChromaClient } from "chromadb";


const client =
new ChromaClient();



await client.deleteCollection({

    name:"sip_documents"

});



console.log(
    "Collection Chroma berhasil dihapus"
);