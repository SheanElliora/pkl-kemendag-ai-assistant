import { ChromaClient } from "chromadb";
import { createEmbedding } from "./embedderService.js";


const client = new ChromaClient();


// ============================================
// Parameter retrieval (bisa di-tune di sini)
//
// MAX_CANDIDATES  : jumlah chunk yang dipakai
//                   sebagai context jawaban.
//                   Kecil = sitasi lebih sedikit &
//                   fokus; besar = jangkauan lebih
//                   luas tapi ada risiko halaman
//                   kurang relevan ikut tampil.
// DISTANCE_RATIO  : batas jarak adaptif = terbaik
//                   * ratio. Naikkan = lebih longgar.
// DISTANCE_OFFSET : batas minimum mutlak tambahan.
// ============================================

const MAX_CANDIDATES = 5;
const DISTANCE_RATIO = 3.0;
const DISTANCE_OFFSET = 0.3;



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
// Pemotongan relevansi dilakukan
    // SETELAH ranking (lihat "Pemotongan
    // adaptif" di bawah), karena skala jarak
    // L2 berbeda antarjenis dokumen.
    //
//     Jumlah akhir dibatasi MAX_CANDIDATES
    //     (5) agar jangkauan konteks lebih luas dan
    //     jawaban benar tidak terlewat. Untuk
    //     konteks lebih fokus, turunkan kembali.
    // ==================================








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
    //
    // PEMOTONGAN ADAPTIF:
    // Skala jarak L2 (embedding ternormalisasi) sangat
    // berbeda antardokumen: laporan pasar ~0.3-0.6,
    // sedangkan jurnal akademik ~0.9-1.2. Karena itu kita
    // TIDAK memakai angka absolut, melainkan membandingkan
    // tiap kandidat dengan jarak TERBAIK (paling relevan).
    // Kandidat yang jaraknya melampaui batas relatif
    // dianggap tidak relevan dan dibuang.
    // ==================================

    const bestDistance =
    candidates.length > 0
        ? candidates[0].distance
        : 0;

    const maxAllowedDistance =
    bestDistance * DISTANCE_RATIO + DISTANCE_OFFSET;

    const finalCandidates =
    candidates
    .filter(item=>{

        if(
            bestDistance > 0 &&
            item.distance > maxAllowedDistance
        ){

            console.log(
                "Dibuang (jarak jauh relatif):",
                item.distance,
                "> batas",
                maxAllowedDistance
            );

            return false;

        }

        return true;

    })
    .slice(0, MAX_CANDIDATES);





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