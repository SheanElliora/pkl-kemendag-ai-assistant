import fs from "fs";
import path from "path";

import { CHUNK_FOLDER } from "../config.js";



// membuat folder chunks jika belum ada
function ensureFolder(){


    if(!fs.existsSync(CHUNK_FOLDER)){


        fs.mkdirSync(
            CHUNK_FOLDER,
            {
                recursive:true
            }
        );


    }


}



// mendapatkan lokasi file chunk
export function getChunkPath(filename){


    const name =
    path.basename(
        filename,
        ".pdf"
    );


    return path.join(
        CHUNK_FOLDER,
        name + "_chunks.json"
    );


}



// menyimpan chunk
export function saveChunks(
    filename,
    chunks
){


    ensureFolder();



    const filePath =
    getChunkPath(filename);



    const data =
    JSON.stringify(
        chunks
    );



    fs.writeFileSync(
        filePath,
        data,
        "utf8"
    );



    console.log(
        "Chunk tersimpan:",
        filePath
    );


}



// membaca chunk lama
export function loadChunks(filename){



    const filePath =
    getChunkPath(filename);



    if(!fs.existsSync(filePath)){


        return null;


    }



    try{


        const data =
        fs.readFileSync(
            filePath,
            "utf8"
        );



        const chunks =
        JSON.parse(data);



        console.log(
            "Chunk ditemukan:",
            filePath
        );



        return chunks;



    }
    catch(error){



        console.log(
            "Chunk rusak, membuat ulang"
        );


        return null;


    }


}


// menghapus file chunk milik satu dokumen
export function deleteChunks(filename){


    const filePath =
    getChunkPath(filename);


    if(fs.existsSync(filePath)){


        fs.unlinkSync(filePath);


        console.log(
            "Chunk dihapus:",
            filePath
        );


    }


}