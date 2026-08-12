import { ChromaClient } from "chromadb";
import fs from "fs";
import path from "path";
import { createEmbedding } from "./embedderService.js";
import { DOCS_FOLDER } from "../config.js";


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
// SEARCH_WIDTH    : jumlah kandidat awal yang
//                   diambil dari Chroma sebelum
//                   di-rerank. Lebar = peluang halaman
//                   fakta yang tepat ikut masuk.
// KEYWORD_BONUS   : pengurangan skor per kata kunci
//                   pertanyaan yang muncul di chunk
//                   (menguatkan angka/nama yang sering
//                   gagal dipahami embedding).
// FILENAME_BONUS  : pengurangan skor bila nama file
//                   cocok dengan kata pada pertanyaan.
// MIN_CHUNK_LENGTH: chunk terlalu pendek (header,
//                   cover, "-") dibuang.
// ============================================

const MAX_CANDIDATES = 7;
const DISTANCE_RATIO = 3.0;
const DISTANCE_OFFSET = 0.3;
const SEARCH_WIDTH = 60;
const KEYWORD_BONUS = 0.05;
const FILENAME_BONUS = 0.15;
const MIN_CHUNK_LENGTH = 40;

// Kata umum yang bising untuk token 3 huruf.
const STOP3 = new Set([
    "dan","dari","apa","itu","ini","ada","atau",
    "the","and","for","was","are","but","not","you",
    "all","can","had","her","his","its","our","out",
    "who","may","per","dna","nas","hns","xbe"
]);

// ============================================
// Perluasan query Indonesia -> Inggris
//
// Dokumen hampir semuanya berbahasa Inggris,
// sedangkan pertanyaan user berbahasa Indonesia.
// Model embedding multilingual bisa bekerja lintas
// bahasa, tapi sinyalnya lemah untuk istilah
// teknis (harga->price, jurnal->journal, dst.).
// Kata Inggris yang diketahui ditambahkan ke
// query embedding agar halaman yang tepat naik.
// ============================================

const TERM_EN = [
    ["harga", "price pricing"],
    ["komoditas", "commodity commodities"],
    ["jurnal", "journal"],
    ["prediksi", "prediction predicting forecast"],
    ["pasar", "market"],
    ["tahun", "year"],
    ["pendapatan", "revenue income earnings"],
    ["penjualan", "sales revenue"],
    ["impor", "import"],
    ["ekspor", "export"],
    ["nilai", "value total amount"],
    ["jumlah", "number total count"],
    ["total", "total"],
    ["gamer", "gamer gamers video game player"],
    ["konsol", "console"],
    ["penerbit", "publisher"],
    ["terlaris", "best selling top"],
    ["populasi", "population"],
    ["penduduk", "population"],
    ["rekening", "bank account"],
    ["modal", "capital"],
    ["bank", "bank"],
    ["dokumen", "document documents"],
    ["eksperimen", "experiment experiments"],
    ["formulasi", "formulation"],
    ["komponen", "component"],
    ["sistem", "system"],
    ["perdagangan", "trade trading commerce"],
    ["peraturan", "regulation regulation"],
    ["menteri", "minister ministry"],
    ["perusahaan", "company"],
    ["bea", "customs duty tariff"],
    ["tarif", "tariff duty rate"],
    ["peralatan", "equipment devices"],
    ["medis", "medical surgical"],
    ["instrumen", "instruments"],
    ["kesehatan", "health"],
    ["inflasi", "inflation"],
    ["pengangguran", "unemployment"],
    ["sertifikasi", "certification"],
    ["pajak", "tax"],
    ["tekstil", "textile"],
    ["katun", "cotton"],
    ["kain", "fabric cloth"],
    ["statistik", "statistics"],
    ["algoritma", "algorithm"],
    ["dibandingkan", "compared comparison compare"],
    ["kelima", "five"],
    ["model", "model"],
    ["percobaan", "experiment trial"],
    ["dataset", "dataset data"],
    ["media", "media social"],
    ["jasa", "service services"],
    ["makanan", "food"],
    ["restoran", "restaurant"],
    ["pemasok", "supplier"],
    ["pasokan", "supply imports"],
    ["asosiasi", "association"],
    ["gambar", "figure image"],
    ["tabel", "table"],
    ["bola", "football football"],
    ["sepak", "football"],
    ["internet", "internet"],
    ["pengguna", "user users"],
    ["wikipedia", "wikipedia"],
    ["page", "page"],
    ["rag", "retrieval augmented generation rag"],
    ["mse", "mean squared error mse"],
    ["lstm", "long short term memory lstm"],
    ["gdp", "gross domestic product gdp"]
];

function expandQuestion(questionLower) {

    const added = [];

    for(const [term, en] of TERM_EN){

        if(questionLower.includes(term)){

            added.push(en);

        }

    }

    return added.flatMap(s=>s.split(" ")).join(" ");

}

// ============================================
// Dokumen aktif = file yang benar-benar ada di
// folder docs. Chunk dari dokumen yang sudah
// dihapus (tertinggal di Chroma) tidak akan
// pernah ikut ter-retrieve.
// ============================================

function getActiveFilenames() {

    try {

        return new Set(
            fs.readdirSync(DOCS_FOLDER).map(f => f.toLowerCase())
        );

    }
    catch {

        return new Set();

    }

}



export async function searchDocuments(question){


    const collection =
    await client.getCollection({

        name:"sip_documents",

        embeddingFunction:null

    });




    // Dokumen aktif saat ini (file yang ada di folder docs)
    const activeFiles =
    getActiveFilenames();




    // ==================================
    // Membuat query embedding
    // ==================================

    const lowerQuestion =
    question.toLowerCase();

    // Perluasan query: tambahkan istilah Inggris
    // agar sinyal embedding ke dokumen Inggris kuat.
    const expansion =
    expandQuestion(lowerQuestion);

    const searchQuery =
    expansion
        ? question + " " + expansion
        : question;

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

        nResults:SEARCH_WIDTH

    });






    console.log("\n===== SEARCH RESULT =====");

    console.log(
        "Question:",
        question
    );






    const candidates = [];




    // kata-kata dari pertanyaan
    // (tanda baca dibuang agar "jepang?" cocok dengan
    //  nama file "jepang_...", "learning?" -> "learning", dst.)
    // Angka (2022, 901890, 7,5% -> "75"?) juga diperhitungkan
    // sebagai kata kunci karena embedding sering gagal
    // memahami angka/tahun.
    const questionTokens =
    lowerQuestion
    // pecah pada semua karakter non-alfanumerik agar
    // "RAG-Sequence/RAG-Token" -> rag, sequence, rag, token
    // (bukan satu token campur aduk yang tak cocok apa-apa)
    .split(/[^a-z0-9]+/)
    .filter(w=>{
        // angka 2+ digit, kata 4+ huruf, atau
        // kata 3 huruf yang bukan stopword
        return (w.length >= 2 && /^\d+$/.test(w))
            || w.length >= 4
            || (w.length === 3 && !STOP3.has(w));
    });



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




            // ==================================
            // Filter dokumen tidak aktif
            // (sudah dihapus dari folder docs)
            // ==================================

            if (!activeFiles.has((meta.filename || "").toLowerCase())) {

                console.log(
                    "Dibuang dokumen tidak aktif:",
                    meta.filename,
                    meta.page
                );

                return;

            }




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
            // Filter chunk terlalu pendek
            // (halaman header, judul bab, "-",
            //  halaman kosong, dst.)
            // ==================================

            if(doc.trim().length < MIN_CHUNK_LENGTH){

                console.log(
                    "Dibuang chunk pendek:",
                    meta.filename,
                    meta.page,
                    `(${doc.trim().length} char)`
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
    //     (7) agar jangkauan konteks lebih luas dan
    //     jawaban benar tidak terlewat. Untuk
    //     konteks lebih fokus, turunkan kembali.
    // ==================================







            // ==================================
            // Cek kecocokan nama file
            // ==================================

            const filename =
            meta.filename.toLowerCase();



            let filenameMatch = false;



            for(const word of questionTokens){


                if(

                    filename.includes(word)

                ){

                    filenameMatch = true;

                }

            }



            // ==================================
            // Cek kata kunci pada isi chunk
            //
            // Kata/angka penting dari pertanyaan yang
            // muncul di dalam teks chunk (mis. "2022",
            // "901890", "restoran", "mse") merupakan
            // sinyal kuat bahwa halaman itu memuat
            // jawaban. Skor (jarak) dikurangi sedikit
            // tiap kemunculan agar halaman itu naik ke
            // atas meski jarak embedding-nya kurang
            // meyakinkan.
            // ==================================

            let keywordHits = 0;

            for(const word of questionTokens){


                if(lowerDoc.includes(word)){

                    keywordHits += 1;

                }

            }




            candidates.push({

                doc,

                meta,

                distance,

                keywordHits,

                filenameMatch

            });



        }

    );








    // ==================================
    // Ranking hasil
    //
    // Skor hybrid = jarak embedding dikurangi
    //   - bonus tiap kata kunci pertanyaan yang
    //     muncul di isi chunk (KEYWORD_BONUS)
    //   - bonus bila nama file cocok (FILENAME_BONUS)
    // Semakin kecil skor, semakin relevan.
    // ==================================

    candidates.forEach(item=>{

        item.score =
        item.distance
        - KEYWORD_BONUS * item.keywordHits
        - (item.filenameMatch ? FILENAME_BONUS : 0);

    });

    candidates.sort((a,b)=>a.score - b.score);








    // ==================================
    // Ambil context terbaik
    //
    // PEMOTONGAN ADAPTIF:
    // Skala jarak L2 (embedding ternormalisasi) sangat
    // berbeda antardokumen: laporan pasar ~0.3-0.6,
    // sedangkan jurnal akademik ~0.9-1.2. Karena itu kita
    // TIDAK memakai angka absolut, melainkan membandingkan
    // tiap kandidat dengan SKOR TERBAIK (paling relevan).
    // Kandidat yang skornya melampaui batas relatif
    // dianggap tidak relevan dan dibuang.
    // ==================================

    const bestScore =
    candidates.length > 0
        ? candidates[0].score
        : 0;

    const maxAllowedScore =
    bestScore * DISTANCE_RATIO + DISTANCE_OFFSET;

    const finalCandidates =
    candidates
    .filter(item=>{

        if(
            bestScore > 0 &&
            item.score > maxAllowedScore
        ){

            console.log(
                "Dibuang (skor jauh relatif):",
                item.score.toFixed(4),
                "> batas",
                maxAllowedScore.toFixed(4)
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