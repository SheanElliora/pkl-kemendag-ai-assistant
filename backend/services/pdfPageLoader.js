import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";


const DOCS_FOLDER = "./docs";


export async function loadPDFWithPages(filename){


    const pdfPath =
        path.join(
            DOCS_FOLDER,
            filename
        );


    const data =
        new Uint8Array(
            fs.readFileSync(pdfPath)
        );


    const pdfDocument =
    await pdfjsLib.getDocument({
        data
    }).promise;



    let pages = [];



    for(
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber++
    ){


        const page =
            await pdfDocument.getPage(
                pageNumber
            );



        const content =
            await page.getTextContent();



        const text =
            content.items
            .map(
                item => item.str
            )
            .join(" ");



        pages.push({

            page: pageNumber,

            text: text

        });


    }



    return pages;

}