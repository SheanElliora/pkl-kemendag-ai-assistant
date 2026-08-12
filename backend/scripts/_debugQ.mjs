import { searchDocuments } from "../services/retrieverService.js";
import { createEmbedding } from "../services/embedderService.js";
import { rerankDocuments } from "../services/rerankerService.js";
import { ChromaClient } from "chromadb";

const client = new ChromaClient();

const QUESTIONS = [
    "Framework apa yang digunakan untuk membangun sistem prediksi harga?",
    "Komoditas apa saja yang diprediksi dalam jurnal tersebut?",
    "Berapa rentang harga eceran lampu dekorasi di Nigeria?",
    "Berapa jumlah dokumen Wikipedia yang dipakai sebagai memori non-parametrik?",
    "Berapa hasil akurasi RAG pada NQ saat jawaban tidak ada di dokumen?",
    "Algoritma mana yang unggul dibanding ARIMA dalam prediksi harga komoditas?"
];

for (const q of QUESTIONS) {
    const collection = await client.getCollection({ name: "sip_documents", embeddingFunction: null });
    const searchQuery = q; // tanpa ekspansi utk isolasi
    const queryVector = await createEmbedding(searchQuery, "query");
    const result = await collection.query({ queryEmbeddings: [queryVector], nResults: 10 });

    console.log("\n### Q:", q);
    console.log("-- vektor (sebelum rerank) top 10 --");
    result.documents[0].slice(0, 10).forEach((doc, i) => {
        const meta = result.metadatas[0][i];
        const d = result.distances[0][i];
        console.log(`   ${(i+1).toString().padStart(2)}. ${meta.filename} hal ${meta.page} dist ${d.toFixed(3)} | ${doc.slice(0, 60).replace(/\n/g," ")}`);
    });

    // rerank 10 kandidat
    const scores = await rerankDocuments(q, result.documents[0].slice(0, 10));
    const pairs = result.documents[0].slice(0, 10).map((doc, i) => ({ doc, meta: result.metadatas[0][i], score: scores[i] }));
    pairs.sort((a, b) => b.score - a.score);
    console.log("-- setelah rerank (ms-marco, EN) top 5 --");
    pairs.slice(0, 5).forEach((p, i) => {
        console.log(`   ${(i+1)}. ${p.meta.filename} hal ${p.meta.page} rerank ${p.score.toFixed(3)} | ${p.doc.slice(0, 60).replace(/\n/g," ")}`);
    });
}
console.log("\nDEBUG SELESAI");
