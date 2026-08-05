import { ChromaClient } from "chromadb";


const client = new ChromaClient();


async function reset(){

    try{

        await client.deleteCollection({
            name:"sip_documents"
        });


        console.log(
            "Collection sip_documents berhasil dihapus"
        );


    }
    catch(error){

        console.log(
            "Gagal:",
            error.message
        );

    }

}


reset();