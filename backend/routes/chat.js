import { Router } from "express";
import rateLimit from "express-rate-limit";
import { askRAG, streamRAG } from "../services/ragService.js";
import { translateLLMError } from "../services/llmService.js";


const router = Router();


// ==============================
// Rate limit chat: 20 pertanyaan
// per menit per IP. Melindungi
// kredit API OpenRouter dari
// pemakaian berlebihan, karena
// endpoint ini publik (tanpa
// login) sesuai desain demo.
// ==============================

const chatLimiter = rateLimit({

    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Terlalu banyak pertanyaan dalam satu menit. Coba lagi sebentar lagi."
    }

});


// ==============================
// POST /api/chat
// Tanya jawab RAG. Publik (tidak
// perlu login) sesuai desain demo.
// - Body normal -> jawaban sekali kirim (JSON)
// - Body { stream: true } -> Server-Sent Events
//   (delta teks bertahap, lalu done + sources).
// ==============================

router.post("/", chatLimiter, async (req, res) => {


    console.log("\n==============================");
    console.log("Request diterima");


    const { message, model, stream } = req.body;


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

    console.log("Stream:", stream ? "ya" : "tidak");


    // ------------- MODE STREAMING (SSE) -------------

    if (stream) {

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        try {

            for await (const evt of streamRAG(message, model)) {

                if (evt.type === "delta") {

                    res.write(`data: ${JSON.stringify({ type: "delta", text: evt.text })}\n\n`);

                } else if (evt.type === "done") {

                    res.write(`data: ${JSON.stringify({
                        type: "done",
                        answer: evt.answer,
                        sources: evt.sources
                    })}\n\n`);

                }

            }

        } catch (err) {

            console.error("\n===== ERROR (STREAM) =====");
            console.error(err);

            res.write(`data: ${JSON.stringify({
                type: "error",
                message: translateLLMError(err) || "Gagal menjawab."
            })}\n\n`);

        } finally {

            res.end();

        }

        return;

    }


    // ------------- MODE BIASA (JSON) -------------


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
            translateLLMError(err),

            detail:
            err.message

        });


    }


});


export default router;