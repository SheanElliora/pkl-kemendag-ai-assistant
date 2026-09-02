import { Router } from "express";
import rateLimit from "express-rate-limit";
import { askRAG, streamRAG } from "../services/ragService.js";
import { translateLLMError } from "../services/llmService.js";
import { verifyToken } from "../services/authService.js";
import * as chatHistory from "../services/chatHistoryService.js";


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
// Autentikasi OPSIONAL (tidak wajib)
//
// Chat tetap publik. Bila header Bearer valid, riwayat
// dicatat atas nama user login; bila tidak, dipakai
// clientId dari body (frontend menyimpan UUID di
// localStorage) atau fallback "guest".
// ==============================

function resolveOwner(req, clientId) {

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const payload = verifyToken(token);

    if (payload && payload.id) {

        return "user:" + payload.id;

    }

    if (clientId && typeof clientId === "string" && clientId.trim()) {

        return "client:" + clientId.trim().slice(0, 100);

    }

    return "guest";

}


function sessionFromBody(req) {

    const { sessionId, clientId } = req.body || {};

    const owner =
    resolveOwner(req, clientId);

    const session =
    chatHistory.getOrCreateSession(
        owner,
        sessionId
    );

    return { session, owner };

}


// ==============================
// POST /api/chat
// Tanya jawab RAG. Publik (tidak
// perlu login) sesuai desain demo.
// - Body normal -> jawaban sekali kirim (JSON)
// - Body { stream: true } -> Server-Sent Events
//   (delta teks bertahap, lalu done + sources).
// - Body { sessionId } -> pesan disimpan ke riwayat
//   dan pertanyaan berikutnya memakai konteks
//   percakapan (multi-turn).
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


    // Sesi riwayat (multi-turn) — opsional, tidak mengubah
    // perilaku bila klien tidak mengirim sessionId.
    const { session } = sessionFromBody(req);

    const history =
    chatHistory.getRecentMessages(
        session.id,
        6
    );

    // Simpan pesan user SEKARANG (sebelum proses), supaya
    // riwayat tetap utuh walau jawaban gagal/gagal stream.
    chatHistory.appendMessage(
        session.id,
        { role: "user", content: message }
    );


    // ------------- MODE STREAMING (SSE) -------------

    if (stream) {

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        try {

            for await (const evt of streamRAG(message, model, history)) {

                if (evt.type === "delta") {

                    res.write(`data: ${JSON.stringify({ type: "delta", text: evt.text })}\n\n`);

                } else if (evt.type === "done") {

                    const saved =
                    chatHistory.appendMessage(
                        session.id,
                        {
                            role: "assistant",
                            content: evt.answer,
                            sources: evt.sources,
                            model: model || null
                        }
                    );

                    res.write(`data: ${JSON.stringify({
                        type: "done",
                        answer: evt.answer,
                        sources: evt.sources,
                        sessionId: session.id,
                        messageId: saved ? saved.id : null
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

        const result = await askRAG(message, model, history);

        console.log("askRAG selesai.");

        console.log(result);
        


        console.log(
            "Jawaban berhasil dibuat."
        );


        const saved =
        chatHistory.appendMessage(
            session.id,
            {
                role: "assistant",
                content: result.answer,
                sources: result.sources,
                model: model || null
            }
        );


        res.json({

            reply:
            result.answer,


            sources:
            result.sources,


            sessionId:
            session.id,


            messageId:
            saved ? saved.id : null

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


// ==============================
// GET /api/chat/history
// Daftar sesi percakapan milik
// pemilik (guest / clientId / user).
// ==============================

router.get("/history", (req, res) => {

    const clientId = req.query.clientId;

    const owner =
    resolveOwner(req, clientId);

    const sessions =
    chatHistory.listSessions(owner);

    res.json({ sessions });

});


// ==============================
// GET /api/chat/history/:sessionId
// Isi lengkap satu percakapan.
// ==============================

router.get("/history/:sessionId", (req, res) => {

    const session =
    chatHistory.getSession(req.params.sessionId);

    if (!session) {

        return res.status(404).json({
            error: "Percakapan tidak ditemukan"
        });

    }

    res.json({ session });

});


// ==============================
// DELETE /api/chat/history/:sessionId
// Hapus satu percakapan.
// ==============================

router.delete("/history/:sessionId", (req, res) => {

    const ok =
    chatHistory.deleteSession(req.params.sessionId);

    if (!ok) {

        return res.status(404).json({
            error: "Percakapan tidak ditemukan"
        });

    }

    res.json({ ok: true });

});


// ==============================
// POST /api/chat/feedback
// Penilaian jawaban (up/down) +
// komentar opsional. Dipakai untuk
// mengevaluasi kualitas RAG.
// ==============================

router.post("/feedback", (req, res) => {

    const { sessionId, messageId, rating, comment } = req.body || {};

    if (!sessionId || !messageId) {

        return res.status(400).json({
            error: "sessionId dan messageId wajib diisi"
        });

    }

    const result =
    chatHistory.setFeedback(
        sessionId,
        messageId,
        rating,
        comment
    );

    if (result.error) {

        return res.status(404).json({ error: result.error });

    }

    res.json(result);

});


// ==============================
// GET /api/chat/history/:sessionId/export
// Ekspor percakapan ke HTML (bisa dicetak
// jadi PDF dari browser) atau DOC (dibuka
// Word). format=html | doc, default html.
// ==============================

router.get("/history/:sessionId/export", (req, res) => {

    const session =
    chatHistory.getSession(req.params.sessionId);

    if (!session) {

        return res.status(404).json({
            error: "Percakapan tidak ditemukan"
        });

    }

    const format =
    String(req.query.format || "html").toLowerCase();

    const safeTitle =
    String(session.title || "percakapan")
        .replace(/[^\w\- ]+/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 80);

    const rows =
    session.messages
    .map((m) => {

        const role =
        m.role === "user" ? "Pengguna" : "Asisten AI";

        const cls =
        m.role === "user" ? "user" : "assistant";

        const sources =
        (m.sources && m.sources.length > 0)
            ? `<div class="sources"><strong>Sumber:</strong><ul>${m.sources.map((s) =>
                `<li>${escapeHtml(s.title || s.filename)} — halaman ${s.printedPage ?? s.page}</li>`
              ).join("")}</ul></div>`
            : "";

        const feedback =
        m.feedback
            ? `<div class="feedback">Feedback: ${m.feedback.rating === "up" ? "👍" : "👎"}${m.feedback.comment ? " — " + escapeHtml(m.feedback.comment) : ""}</div>`
            : "";

        return `
        <div class="msg ${cls}">
            <div class="role">${role}</div>
            <div class="content">${escapeHtml(m.content).replace(/\n/g, "<br/>")}</div>
            ${sources}
            ${feedback}
            <div class="time">${new Date(m.createdAt).toLocaleString("id-ID")}</div>
        </div>`;

    })
    .join("\n");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Percakapan — ${escapeHtml(session.title)}</title>
<style>
    body { font-family: "Segoe UI", Arial, sans-serif; max-width: 760px; margin: 24px auto; padding: 0 16px; color: #1e293b; }
    h1 { font-size: 20px; border-bottom: 2px solid #e9a319; padding-bottom: 8px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .msg { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
    .msg.assistant { background: #f8fafc; border-left: 4px solid #e9a319; }
    .msg.user { background: #ffffff; border-left: 4px solid #64748b; }
    .role { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
    .content { line-height: 1.55; font-size: 14px; white-space: normal; }
    .sources { font-size: 12px; color: #475569; margin-top: 8px; background: #f1f5f9; padding: 6px 10px; border-radius: 6px; }
    .sources ul { margin: 4px 0 0 18px; }
    .feedback { font-size: 12px; color: #475569; margin-top: 6px; }
    .time { font-size: 12px; color: #94a3b8; margin-top: 6px; }
    @media print { body { margin: 0; } .msg { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Percakapan — ${escapeHtml(session.title)}</h1>
<div class="meta">Dibuat: ${new Date(session.createdAt).toLocaleString("id-ID")} · ${session.messages.length} pesan</div>
${rows}
</body>
</html>`;

    const ext =
    format === "doc" ? "doc" : "html";

    res.setHeader("Content-Type",
        format === "doc"
            ? "application/msword"
            : "text/html; charset=utf-8");

    res.setHeader(
        "Content-Disposition",
        `attachment; filename="percakapan_${safeTitle}.${ext}"`
    );

    res.send(html);

});


function escapeHtml(text) {

    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}


export default router;