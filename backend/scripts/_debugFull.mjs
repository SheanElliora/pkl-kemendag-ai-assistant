import { ChromaClient } from "chromadb";
import fs from "fs";
import { createEmbedding } from "../services/embedderService.js";
import { rerankDocuments } from "../services/rerankerService.js";

const client = new ChromaClient();

const STOP3 = new Set(["dan","dari","apa","itu","ini","ada","atau","the","and","for","was","are","but","not","you","all","can","had","her","his","its","our","out","who","may","per","dna","nas","hns","xbe"]);

const TERM_EN = [
    ["harga", "price pricing"],["komoditas", "commodity commodities"],["jurnal", "journal"],
    ["prediksi", "prediction predicting forecast"],["pasar", "market"],["tahun", "year"],
    ["pendapatan", "revenue income earnings"],["penjualan", "sales revenue"],["impor", "import"],
    ["ekspor", "export"],["nilai", "value total amount"],["jumlah", "number total count"],
    ["total", "total"],["gamer", "gamer gamers video game player"],["konsol", "console"],
    ["penerbit", "publisher"],["terlaris", "best selling top"],["populasi", "population"],
    ["penduduk", "population"],["rekening", "bank account"],["modal", "capital"],["bank", "bank"],
    ["dokumen", "document documents"],["hambatan", "barrier obstacle challenges risks"],
    ["risiko", "risk risks"],["persyaratan", "requirements regulations"],["penulis", "author authors writers paper"],
    ["peneliti", "researcher researchers study paper"],["eksperimen", "experiment experiments"],
    ["formulasi", "formulation"],["komponen", "component"],["sistem", "system"],
    ["perdagangan", "trade trading commerce"],["peraturan", "regulation regulation"],
    ["menteri", "minister ministry"],["perusahaan", "company"],["bea", "customs duty tariff"],
    ["tarif", "tariff duty rate"],["peralatan", "equipment devices"],["medis", "medical surgical"],
    ["instrumen", "instruments"],["kesehatan", "health"],["inflasi", "inflation"],
    ["pengangguran", "unemployment"],["sertifikasi", "certification"],["pajak", "tax"],
    ["tekstil", "textile"],["katun", "cotton"],["kain", "fabric cloth"],["statistik", "statistics"],
    ["algoritma", "algorithm"],["dibandingkan", "compared comparison compare"],["kelima", "five"],
    ["model", "model"],["percobaan", "experiment trial"],["dataset", "dataset data"],
    ["media", "media social"],["jasa", "service services"],["makanan", "food"],
    ["restoran", "restaurant"],["pemasok", "supplier"],["pasokan", "supply imports"],
    ["asosiasi", "association"],["gambar", "figure image"],["tabel", "table"],
    ["bola", "football football"],["sepak", "football"],["internet", "internet"],
    ["pengguna", "user users"],["wikipedia", "wikipedia"],["page", "page"],
    ["rag", "retrieval augmented generation rag"],["mse", "mean squared error mse"],
    ["lstm", "long short term memory lstm"],["gdp", "gross domestic product gdp"]
];

function expandQuestion(questionLower) {
    const added = [];
    for(const [term, en] of TERM_EN){
        if(questionLower.includes(term)) added.push(en);
    }
    return added.flatMap(s=>s.split(" ")).join(" ");
}

const QUESTIONS = [
    "Framework apa yang digunakan untuk membangun sistem prediksi harga?",
    "Komoditas apa saja yang diprediksi dalam jurnal tersebut?",
    "Berapa rentang harga eceran lampu dekorasi di Nigeria?",
    "Berapa jumlah dokumen Wikipedia yang dipakai sebagai memori non-parametrik?",
    "Berapa hasil akurasi RAG pada NQ saat jawaban tidak ada di dokumen?",
    "Algoritma mana yang unggul dibanding ARIMA dalam prediksi harga komoditas?"
];

const collection = await client.getCollection({ name: "sip_documents", embeddingFunction: null });

for (const q of QUESTIONS) {
    const lower = q.toLowerCase();
    const expansion = expandQuestion(lower);
    const searchQuery = expansion ? q + " " + expansion : q;
    console.log(`\n### Q: ${q}`);
    console.log(`   ekspansi -> ${searchQuery}`);

    const qv = await createEmbedding(searchQuery, "query");
    const res = await collection.query({ queryEmbeddings: [qv], nResults: 16 });

    // skor hybrid + rerank
    const cands = [];
    res.documents[0].forEach((doc, i) => {
        const meta = res.metadatas[0][i];
        const tokens = lower.split(/[^a-z0-9]+/).filter(w =>
            (w.length >= 2 && /^\d+$/.test(w)) || w.length >= 4 || (w.length === 3 && !STOP3.has(w)));
        let hits = 0;
        for (const w of tokens) if (doc.toLowerCase().includes(w)) hits++;
        const fMatch = tokens.some(w => meta.filename.toLowerCase().includes(w));
        cands.push({ doc, meta, dist: res.distances[0][i], hits, fMatch,
            score: res.distances[0][i] - 0.05*hits - (fMatch?0.15:0) });
    });
    cands.sort((a,b)=>a.score-b.score);

    console.log("   urutan hybrid (dist - bonus):");
    cands.slice(0,6).forEach((c,i)=>{
        console.log(`   ${i+1}. ${c.meta.filename} hal ${c.meta.page} dist ${c.dist.toFixed(3)} hits${c.hits} fM${c.fMatch} score ${c.score.toFixed(3)} | ${c.doc.slice(0,50).replace(/\n/g," ")}`);
    });

    const top16 = cands.slice(0,16);
    const scores = await rerankDocuments(searchQuery, top16.map(c=>c.doc));
    top16.forEach((c,i)=> c.rerank = scores[i]);
    cands.sort((a,b)=>{
        const sa = a.rerank !== undefined ? a.score - 0.5*a.rerank : a.score;
        const sb = b.rerank !== undefined ? b.score - 0.5*b.rerank : b.score;
        return sa-sb;
    });
    console.log("   urutan hybrid+rerank (score - 0.5*rerank):");
    cands.slice(0,6).forEach((c,i)=>{
        console.log(`   ${i+1}. ${c.meta.filename} hal ${c.meta.page} rerank ${(c.rerank??0).toFixed(4)} skorAkhir ${((c.rerank!==undefined?c.score-0.5*c.rerank:c.score)).toFixed(3)} | ${c.doc.slice(0,50).replace(/\n/g," ")}`);
    });
}
console.log("\nSELESAI");
