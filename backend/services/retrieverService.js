import { ChromaClient } from "chromadb";
import { createEmbedding } from "./embedderService.js";


const client = new ChromaClient();



export async function searchDocuments(question){


    const collection =
    await client.getCollection({

        name:"sip_documents",

        embeddingFunction:null

    });




    // ==================================
    // Membuat query embedding
    // ==================================

    let searchQuery = question;


    const lowerQuestion =
    question.toLowerCase();



    // Tambahan keyword untuk membantu pencarian jurnal
    if(
    lowerQuestion.includes("algoritma") ||
    lowerQuestion.includes("model") ||
    lowerQuestion.includes("machine learning") ||
    lowerQuestion.includes("terbaik")
){

    searchQuery +=
    " ARIMA SVR Prophet XGBoost LSTM best model selected prediction engine mean square error";

}



    const queryVector =
    await createEmbedding(searchQuery);






    // ==================================
    // Search vector database
    // ==================================

    const result =
    await collection.query({

        queryEmbeddings:[
            queryVector
        ],

        nResults:20

    });






    console.log("\n===== SEARCH RESULT =====");

    console.log(
        "Question:",
        question
    );






    const candidates = [];




    // kata-kata dari pertanyaan
    const questionWords =
    lowerQuestion.split(/\s+/);






    result.documents[0].forEach(

        (doc,index)=>{


            const distance =
            result.distances[0][index];


            const meta =
            result.metadatas[0][index];





            console.log(

                "Candidate:",
                meta.filename,
                "| Page:",
                meta.page,
                "| Distance:",
                distance

            );







            const lowerDoc =
            doc.toLowerCase();






            // ==================================
            // Filter daftar isi
            // ==================================

            if(

                lowerDoc.includes("daftar isi") ||
                lowerDoc.includes("table of contents") ||
                lowerDoc.includes("daftar tabel") ||
                lowerDoc.includes("daftar gambar")

            ){

                console.log(
                    "Dibuang daftar isi:",
                    meta.filename,
                    meta.page
                );


                return;

            }







            // ==================================
            // Filter cover
            // ==================================

            if(

                lowerDoc.includes("market intelligence") &&
                lowerDoc.length < 500

            ){

                console.log(
                    "Dibuang cover:",
                    meta.page
                );


                return;

            }








            // ==================================
            // Threshold relevansi
            // ==================================

            if(distance > 1.2){


                console.log(
                    "Distance terlalu jauh:",
                    distance
                );


                return;

            }








            // ==================================
            // Cek kecocokan nama file
            // ==================================

            const filename =
            meta.filename.toLowerCase();



            let filenameMatch = false;



            for(const word of questionWords){


                if(

                    word.length > 4 &&
                    filename.includes(word)

                ){

                    filenameMatch = true;

                }

            }







            candidates.push({

                doc,

                meta,

                distance,

                filenameMatch

            });



        }

    );









    // ==================================
    // Ranking hasil
    //
    // Prioritas:
    // 1. filename cocok
    // 2. distance kecil
    // ==================================

    candidates.sort(

        (a,b)=>{


            if(
                a.filenameMatch &&
                !b.filenameMatch
            ){

                return -1;

            }



            if(
                !a.filenameMatch &&
                b.filenameMatch
            ){

                return 1;

            }



            return a.distance - b.distance;


        }

    );








    // ==================================
    // Ambil context terbaik
    // ==================================

    const finalCandidates =
    candidates.slice(0,5);





    const documents = [];
    const metadata = [];
    const distances = [];






    finalCandidates.forEach(item=>{


        documents.push(
            item.doc
        );


        metadata.push(
            item.meta
        );


        distances.push(
            item.distance
        );


    });






    console.log(
        "Dokumen lolos:",
        documents.length
    );







    return {


        documents,

        metadata,

        distances


    };



}