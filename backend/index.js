import "dotenv/config";
import express from "express";
import cors from "cors";

import multer from "multer";
import path from "path";
import fs from "fs";

import { ingestDocument } from "./ingest.js";
import { askRAG } from "./services/ragService.js";
import { ingestSinglePDF } from "./services/ingestService.js";


const app = express();

// ======================================
// Folder Upload
// ======================================

const DOCS_FOLDER = "./docs";

if (!fs.existsSync(DOCS_FOLDER)) {

    fs.mkdirSync(DOCS_FOLDER);

}

// ======================================
// Konfigurasi Upload PDF
// ======================================

const storage = multer.diskStorage({

    destination: function(req, file, cb){

        cb(null, DOCS_FOLDER);

    },


    filename: function(req, file, cb){

        cb(null, file.originalname);

    }

});


const upload = multer({

    storage: storage,

    fileFilter: function(req, file, cb){


        if(file.mimetype === "application/pdf"){

            cb(null, true);

        }
        else{

            cb(
                new Error("File harus PDF"),
                false
            );

        }


    }

});

app.use(cors());

app.use(express.json());


// ==============================
// Cek Environment
// ==============================

console.log(
    "OPENROUTER KEY:",
    process.env.OPENROUTER_API_KEY
        ? "TERBACA"
        : "TIDAK TERBACA"
);

// ==============================
// Endpoint Upload PDF
// ==============================

app.post(
    "/api/upload",
    upload.single("file"),
    async (req, res) => {


        try {


            if(!req.file){

                return res.status(400).json({

                    error:
                    "File PDF belum dikirim."

                });

            }


            console.log(
    "File diterima:",
    req.file.filename
);

console.log(
    "Lokasi file:",
    req.file.path
);


            console.log(
    "Mulai proses ingest..."
);


await ingestDocument(
    req.file.filename
);



res.json({

    message:
    "Upload dan proses dokumen berhasil.",

    filename:
    req.file.filename

});


        }
        catch(error){


            console.error(error);


            res.status(500).json({

                error:
                error.message

            });


        }


    }
);

// ==============================
// Endpoint Chat RAG
// ==============================

app.post("/api/chat", async (req, res) => {


    console.log("\n==============================");
    console.log("Request diterima");


    const { message } = req.body;


    if (!message) {

        return res.status(400).json({

            error:
            "Message tidak boleh kosong."

        });

    }


    console.log("Pertanyaan:");
    console.log(message);



    try {


        console.log("Memanggil askRAG...");

        const result = await askRAG(message);

        console.log("askRAG selesai.");

        console.log(result);
        


        console.log(
            "Jawaban berhasil dibuat."
        );



        res.json({

            reply:
            result.answer,


            sources:
            result.sources

        });



    } catch (err) {


        console.error("\n===== ERROR =====");

        console.error(err);



        res.status(500).json({

            error:
            "Gagal menjalankan RAG.",

            detail:
            err.message

        });


    }


});



// ==============================
// Health Check
// ==============================

app.get("/api/health", (req, res) => {


    res.json({

        status:
        "OK"

    });


});



// ==============================
// Server
// ==============================

const PORT =
process.env.PORT || 3001;



app.listen(PORT, () => {


    console.log(
        `Backend berjalan di http://localhost:${PORT}`
    );


});