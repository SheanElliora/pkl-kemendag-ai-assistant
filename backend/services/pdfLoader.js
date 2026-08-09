import fs from "fs";
import path from "path";

import { pdfToTextOCR } from "./ocrService.js";
import { createChunks } from "./chunkService.js";
import { cleanText } from "./textCleaner.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPDFWithPages } from "./pdfPageLoader.js";

import {
    saveChunks,
    loadChunks
} from "./chunkStorageService.js";
import {
    DOCS_FOLDER,
    OCR_FOLDER
} from "../config.js";

// =====================================
// Ambang minimum karakter untuk dianggap
// PDF berisi teks digital (selectable text).
// Bila total teks yang diekstrak pdfjs
// kurang dari ini, PDF dianggap hasil scan
// dan diteruskan ke OCR.
// =====================================

const MIN_DIGITAL_CHARS = 500;



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
// Ambil judul dokumen dari metadata PDF
// =====================================

async function getPdfTitle(pdfPath){

    try {

        const data =
        new Uint8Array(
            fs.readFileSync(pdfPath)
        );

        const pdf =
        await pdfjsLib.getDocument({
            data
        }).promise;

        const meta =
        await pdf.getMetadata();

        const title =
        meta?.info?.Title;

        if(
            typeof title === "string" &&
            title.trim()
        ){

            return title.trim();

        }

    }
    catch(error){

        console.log(
            "Gagal membaca judul PDF:",
            error.message
        );

    }

    return null;

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

    const pdfPath =
    path.join(
        DOCS_FOLDER,
        file
    );

    const title =
    await getPdfTitle(
        pdfPath
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
            /--- HALAMAN \d+ ---/
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
            "TXT belum ada, mencoba ekstraksi teks digital..."
        );


        // ======================================
        // 1) Coba ekstraksi teks digital (pdfjs)
        //    Lebih cepat & akurat untuk PDF yang
        //    memang berisi teks (selectable text).
        // ======================================

        let extractedPages = [];


        try {

            extractedPages =
            await loadPDFWithPages(
                file
            );


        }
        catch(error){


            console.log(
                "Ekstraksi teks digital gagal:",
                error.message
            );


            extractedPages = [];


        }


        const totalChars =
        extractedPages.reduce(
            (sum, page) =>
            sum + page.text.length,
            0
        );


        if(totalChars >= MIN_DIGITAL_CHARS){


            console.log(
                `Teks digital ditemukan (${totalChars} karakter), tanpa OCR`
            );


            pages =
            extractedPages.map(
                page=>({

                    page:
                    page.page,

                    text:
                    cleanText(
                        page.text
                    )

                })
            );


            // Simpan cache TXT agar tidak perlu
            // diekstrak ulang pada ingest berikutnya.
            // Format sama dengan hasil OCR agar
            // cabang "TXT ditemukan" bisa membacanya.
            const txtContent =
            extractedPages
            .map(
                page =>
                `\n\n--- HALAMAN ${page.page} ---\n\n` +
                page.text
            )
            .join("");


            fs.writeFileSync(
                txtPath,
                txtContent,
                "utf8"
            );


            console.log(
                "TXT hasil ekstraksi tersimpan:",
                txtName
            );


        }
        else{


            console.log(
                "Teks digital kosong, beralih ke OCR (dokumen scan)..."
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

        title:title,

        chunks:chunks

    };


}