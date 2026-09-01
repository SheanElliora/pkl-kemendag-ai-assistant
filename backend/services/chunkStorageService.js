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



const CHUNK_VERSION = "v3-adaptive-512";

// menyimpan chunk (dengan version agar chunk lama otomatis rebuild saat config berubah)
export function saveChunks(filename, chunks, meta = {}) {


    ensureFolder();



    const filePath =
    getChunkPath(filename);



    const payload = {
        version: CHUNK_VERSION,
        docType: meta.docType || null,
        chunkSize: meta.chunkSize || null,
        overlap: meta.overlap || null,
        chunks
    };

    const data = JSON.stringify(payload);



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



        const parsed = JSON.parse(data);

        // Backward compat: file lama berisi array langsung -> anggap versi lama, rebuild
        if (Array.isArray(parsed)) {
            console.log("Chunk versi lama (array), membuat ulang");
            return null;
        }

        if (parsed.version !== CHUNK_VERSION) {
            console.log(
                `Chunk versi ${parsed.version || "unknown"} != ${CHUNK_VERSION}, membuat ulang`
            );
            return null;
        }

        console.log("Chunk ditemukan:", filePath);

        return parsed.chunks;



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