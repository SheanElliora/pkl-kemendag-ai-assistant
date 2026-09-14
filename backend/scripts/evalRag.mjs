import { searchDocuments } from "../services/retrieverService.js";
import { askRAG } from "../services/ragService.js";

const TEST_SET = [
    {
        question: "Apa dasar hukum penyelenggaraan Sistem Informasi Perdagangan?",
        expected: "PERMENDAG NOMOR 28 TAHUN 2024",
        topic: "Regulasi SIP"
    },
    {
        question: "Bagaimana proyeksi pendapatan industri game di Jepang?",
        expected: "Jepang_Data_Game",
        topic: "Pasar game Jepang"
    },
    {
        question: "Bagaimana perkembangan pasar restoran Jepang?",
        expected: "Jepang_Data_Restoran",
        topic: "Pasar restoran Jepang"
    },
    {
        question: "Apa saja persyaratan impor instrumen dan peralatan medis di Jepang?",
        expected: "Jepang_Instrumen_Peralatan_Medis",
        topic: "Alat medis Jepang"
    },
    {
        question: "Bagaimana tren pasar lampu hias (decoration lights) untuk ekspor ke Nigeria?",
        expected: "ND208_Laporan Informasi Pasar_Decoration Lights",
        topic: "Lampu hias Nigeria"
    },
    {
        question: "Bagaimana peluang ekspor kain tekstil Ankara ke Nigeria?",
        expected: "Nigeria_Martel Tekstil Kain Ankara",
        topic: "Tekstil Nigeria"
    },
    {
        question: "Apa yang dimaksud dengan Retrieval-Augmented Generation (RAG)?",
        expected: "Retrieval-Augmented Generation for JURNAL",
        topic: "Konsep RAG"
    }
];

const USE_LLM = !process.argv.includes("--no-llm");

const results = [];

function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
    console.log(
        `${ok ? "  [PASS]" : "  [FAIL]"} ${name}${detail ? "  -> " + detail : ""}`
    );
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {

    console.log(
        `Evaluasi RAG (${USE_LLM ? "dengan LLM" : "retrieval saja"})`
    );

    let totalRecall = 0;
    let totalHits = 0;

    for (const item of TEST_SET) {

        const t0 = Date.now();

        let retrievalMs = 0;
        let answerMs = 0;
        let docNames = [];

        try {

            const result =
            await searchDocuments(item.question);

            retrievalMs = Date.now() - t0;

            docNames =
            (result.metadata || []).map((m) => String(m.filename || ""));

            const hit =
            docNames.some((name) =>
                name.toLowerCase().includes(item.expected.toLowerCase())
            );

            record(
                `[${item.topic}] Recall@7 "${item.question.slice(0, 48)}…"`,
                hit,
                `${retrievalMs} ms, ${docNames.length} dokumen: ${docNames.slice(0, 3).join(" | ") || "-"}`
            );

            if (hit) totalHits++;

            totalRecall++;

            if (USE_LLM) {

                const t1 = Date.now();

                const answer =
                await askRAG(item.question);

                answerMs = Date.now() - t1;

                const citesExpected =
                (answer.sources || []).some((s) =>
                    String(s.filename || "").toLowerCase().includes(item.expected.toLowerCase())
                );

                record(
                    `  -> Jawaban menyitasi dokumen yang benar`,
                    citesExpected,
                    `${(answer.answer || "").length} karakter, ${(answer.sources || []).length} sumber, ${answerMs} ms`
                );

                await sleep(500);

            }

        }

        catch (error) {

            record(
                `[${item.topic}] Gagal`,
                false,
                error.message
            );

        }

        console.log("");

    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    console.log(`Recall: ${totalHits}/${totalRecall}`);
    console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);

    if (failed > 0 || totalHits < totalRecall) {

        process.exitCode = 1;

    }

    else {

        console.log("Evaluasi RAG lulus");

    }

}

main().catch((error) => {

    console.error("Evaluasi gagal:", error.message);

    process.exitCode = 1;

});
