import { ChromaClient } from "chromadb";
import { createEmbedding } from "../services/embedderService.js";

const client = new ChromaClient();
const collection = await client.getCollection({ name: "sip_documents", embeddingFunction: null });

const cases = [
  { q: "Apa tujuan utama Permendag No. 28 Tahun 2024?", expect: "PERMENDAG NOMOR 28 TAHUN 2024" },
  { q: "Apa proyeksi Jepang pada tahun 2030?", expect: "TEST" },
  { q: "Apa peluang bisnis game publisher Indonesia di pasar Jepang?", expect: "Jepang_Data_Game" },
  { q: "Bagaimana cara memprediksi harga komoditas pertanian menggunakan machine learning?", expect: "jurnal ai 1" },
  { q: "Bagaimana tahapan mendirikan restoran di Jepang bagi WNA?", expect: "Jepang_Data_Restoran" },
  { q: "Bagaimana peluang pasar instrumen dan peralatan medis di Jepang?", expect: "Jepang_Instrumen_Peralatan_Medis" },
  { q: "Apa yang dimaksud dengan Retrieval-Augmented Generation?", expect: "Retrieval-Augmented Generation for JURNAL" },
  { q: "Kode HS untuk produk decoration lights adalah berapa?", expect: "ND208_Laporan Informasi Pasar_Decoration Lights" },
  { q: "Bagaimana peluang ekspor tekstil kain Ankara ke Nigeria?", expect: "Nigeria_Martel Tekstil Kain Ankara" },
];

for (const c of cases) {
  const qv = await createEmbedding(c.q);
  const r = await collection.query({ queryEmbeddings: [qv], nResults: 8 });
  console.log("\n### " + c.q);
  r.ids[0].forEach((id, i) => {
    const m = r.metadatas[0][i];
    const hit = m.filename.includes(c.expect) || c.expect.includes(m.filename);
    console.log(`  ${hit ? "OK " : "!!!"} ${m.filename} | hp ${m.page} | d=${r.distances[0][i].toFixed(3)}`);
  });
}
