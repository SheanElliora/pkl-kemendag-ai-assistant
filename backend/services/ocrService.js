import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { OCR_FOLDER } from "../config.js";

const execAsync = promisify(exec);


const TEMP_FOLDER = "./temp_ocr";


export async function pdfToTextOCR(pdfPath) {


    console.log("Mulai OCR:", pdfPath);


    if (!fs.existsSync(TEMP_FOLDER)) {
        fs.mkdirSync(TEMP_FOLDER);
    }



    const outputPrefix =
        path.join(
            TEMP_FOLDER,
            "page"
        );



    console.log(
        "Convert PDF ke gambar..."
    );


    await execAsync(
        `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`
    );



    const images =
        fs.readdirSync(TEMP_FOLDER)
        .filter(
            file => file.endsWith(".png")
        )
        .sort();



    console.log(
        "Jumlah halaman:",
        images.length
    );



    let fullText = "";

    let pages = [];



    for(
        let i = 0;
        i < images.length;
        i++
    ){


        const imagePath =
            path.join(
                TEMP_FOLDER,
                images[i]
            );



        console.log(
            `OCR halaman ${i+1}`
        );



        const {stdout} =
            await execAsync(
                `tesseract "${imagePath}" stdout`
            );



        const pageText =
            stdout.trim();



        pages.push({

            page:i+1,

            text:pageText

        });



        fullText +=
        `\n\n--- HALAMAN ${i+1} ---\n\n`
        +
        pageText;

    }




    fs.rmSync(
        TEMP_FOLDER,
        {
            recursive:true,
            force:true
        }
    );




    console.log(
        "OCR selesai"
    );



    const outputFolder =
        OCR_FOLDER;


    if(!fs.existsSync(outputFolder)){
        fs.mkdirSync(outputFolder);
    }



    const txtName =
        path.basename(
            pdfPath,
            ".pdf"
        )
        +
        ".txt";



    const txtPath =
        path.join(
            outputFolder,
            txtName
        );



    fs.writeFileSync(
        txtPath,
        fullText,
        "utf8"
    );



    console.log(
        "TXT berhasil disimpan:",
        txtName
    );



    return {

        text:fullText,

        pages:pages,

        pageCount:images.length,

        characters:fullText.length

    };

}