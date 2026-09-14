import fs from "fs";
import path from "path";

import { pdfToTextOCR } from "./ocrService.js";
import {
    createChunks,
    detectDocType,
    getChunkConfig
} from "./chunkService.js";
import { cleanText } from "./textCleaner.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPDFWithPages } from "./pdfPageLoader.js";

import {
    saveChunks,
    loadChunks,
    getChunkPath
} from "./chunkStorageService.js";
import {
    DOCS_FOLDER,
    OCR_FOLDER
} from "../config.js";

const MIN_DIGITAL_CHARS = 1200;

function isCacheStale(pdfPath, cachePath) {

    try {

        const pdfMtime =
        fs.statSync(pdfPath).mtimeMs;

        const cacheMtime =
        fs.statSync(cachePath).mtimeMs;

        return cacheMtime < pdfMtime;

    }
    catch {

        return true;

    }

}

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

export async function loadSinglePDF(file){

    return await processPDF(file);

}

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

async function processPDF(file){

    console.log(
        "Memproses:",
        file
    );

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

    if(
        fs.existsSync(txtPath) &&
        !isCacheStale(pdfPath, txtPath)
    ){

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

        const meaningfulPages = extractedPages.filter(
            (p) => p.text.trim().length > 100
        ).length;

        if (
            totalChars >= MIN_DIGITAL_CHARS &&
            meaningfulPages >= 3
        ) {
            console.log(
                `Teks digital ditemukan (${totalChars} karakter, ${meaningfulPages} halaman bermakna), tanpa OCR`
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

    let chunks =
    loadChunks(file);

    let rebuilt = false;

    const chunkPath = getChunkPath(file);

    if (
        chunks &&
        !isCacheStale(pdfPath, chunkPath)
    ) {
        console.log(
            "Menggunakan chunk lama"
        );
    }
    else {
        console.log(
            "Membuat chunk baru"
        );

        const docType = detectDocType(pages, file);
        const { chunkSize, overlap } = getChunkConfig(docType);

        console.log(
            `Tipe dokumen terdeteksi: ${docType} -> chunkSize=${chunkSize}, overlap=${overlap}`
        );

        chunks = createChunks(pages, chunkSize, overlap);

        saveChunks(file, chunks, {
            docType,
            chunkSize,
            overlap
        });

        rebuilt = true;
    }

    console.log(
        "Jumlah chunk:",
        chunks.length
    );

    return {
        filename: file,
        title: title,
        chunks: chunks,
        rebuilt
    };
}
