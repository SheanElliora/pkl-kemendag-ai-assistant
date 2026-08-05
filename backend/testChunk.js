import fs from "fs";
import { createChunks } from "./services/chunkService.js";


const text =
fs.readFileSync(
    "./ocr_text/Jepang_Data_Game.txt",
    "utf8"
);



const pages =
text
.split(/-- HALAMAN \d+ ---/)
.filter(
    x=>x.trim() !== ""
)
.map(
    (page,index)=>({

        page:index+1,

        text:page

    })
);



console.log(
    "Jumlah halaman:",
    pages.length
);



const chunks =
createChunks(
    pages
);



console.log(
    "Total chunk:",
    chunks.length
);