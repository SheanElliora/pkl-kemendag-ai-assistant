import fs from "fs";
import path from "path";

import { pdfToTextOCR } from "./ocrService.js";
import { createChunks } from "./chunkService.js";
import { cleanText } from "./textCleaner.js";

import {
    saveChunks,
    loadChunks
} from "./chunkStorageService.js";


const OCR_FOLDER = "./ocr_text";
const DOCS_FOLDER = "./docs";



// =====================================
// Load semua PDF (untuk npm run ingest)
// =====================================

export async function loadAllPDFs(){


    const files =
    fs.readdirSync(DOCS_FOLDER)
    .filter(
        file =>
        file.endsWith(".pdf")
    );


    const documents = [];


    for(const file of files){


        const document =
        await processPDF(file);


        documents.push(document);


    }


    return documents;


}



// =====================================
// Load satu PDF (untuk upload baru)
// =====================================

export async function loadSinglePDF(file){


    return await processPDF(file);


}



// =====================================
// Fungsi utama proses PDF
// dipakai oleh dua fungsi di atas
// =====================================

async function processPDF(file){


    console.log("\n======================");
    console.log(
        "Memproses:",
        file
    );
    console.log("======================");



    const txtName =
    path.basename(
        file,
        ".pdf"
    )
    +
    ".txt";



    const txtPath =
    path.join(
        OCR_FOLDER,
        txtName
    );



    let pages;



    // ==========================
    // Ambil TXT hasil OCR
    // ==========================

    if(fs.existsSync(txtPath)){


        console.log(
            "TXT ditemukan:",
            txtName
        );



        const text =
        fs.readFileSync(
            txtPath,
            "utf8"
        );



        pages =
        text
        .split(
            /-- HALAMAN \d+ ---/
        )
        .filter(
            page =>
            page.trim()
        )
        .map(
            (page,index)=>({


                page:index+1,


                text:
                cleanText(page)


            })
        );


    }
    else{


        console.log(
            "TXT belum ada, melakukan OCR..."
        );



        const pdfPath =
        path.join(
            DOCS_FOLDER,
            file
        );



        const result =
        await pdfToTextOCR(
            pdfPath
        );



        pages =
        result.pages.map(
            page=>({


                page:
                page.page,


                text:
                cleanText(
                    page.text
                )


            })
        );


    }



    console.log(
        "Jumlah halaman:",
        pages.length
    );



    // ==========================
    // Chunking
    // ==========================


    let chunks =
    loadChunks(file);



    if(chunks){


        console.log(
            "Menggunakan chunk lama"
        );


    }
    else{


        console.log(
            "Membuat chunk baru"
        );


        chunks =
        createChunks(
            pages
        );


        saveChunks(
            file,
            chunks
        );


    }



    console.log(
        "Jumlah chunk:",
        chunks.length
    );



    return {

        filename:file,

        chunks:chunks

    };


}