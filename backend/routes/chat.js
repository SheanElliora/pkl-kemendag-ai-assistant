import { Router } from "express";
import { askRAG } from "../services/ragService.js";


const router = Router();


// ==============================
// POST /api/chat
// Tanya jawab RAG. Publik (tidak
// perlu login) sesuai desain demo.
// ==============================

router.post("/", async (req, res) => {


    console.log("\n==============================");
    console.log("Request diterima");


    const { message, model } = req.body;


    if (!message) {

        return res.status(400).json({

            error:
            "Message tidak boleh kosong."

        });

    }


    console.log("Pertanyaan:");
    console.log(message);

    console.log("Model:");
    console.log(model || "(default dari .env)");


    try {


        console.log("Memanggil askRAG...");

        const result = await askRAG(message, model);

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


export default router;