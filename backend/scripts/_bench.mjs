import { searchDocuments } from "../services/retrieverService.js";

const cases = [
  { q: "Apa tujuan utama Peraturan Menteri Perdagangan Nomor 28 Tahun 2024?", expect: "PERMENDAG NOMOR 28 TAHUN 2024" },
  { q: "Bagaimana langkah membuka bisnis restoran di Jepang?", expect: "Jepang_Data_Restoran" },
  { q: "Apa peluang bisnis game publisher Indonesia di pasar Jepang?", expect: "Jepang_Data_Game" },
  { q: "Bagaimana peluang pasar instrumen dan peralatan medis di Jepang?", expect: "Jepang_Instrumen_Peralatan_Medis" },
  { q: "Bagaimana kondisi pasar ekspor produk decoration lights di Nigeria?", expect: "ND208_Laporan Informasi Pasar_Decoration Lights" },
  { q: "Bagaimana peluang ekspor tekstil kain Ankara ke Nigeria?", expect: "Nigeria_Martel Tekstil Kain Ankara" },
  { q: "Bagaimana cara memprediksi harga komoditas pertanian menggunakan machine learning?", expect: "jurnal ai 1" },
  { q: "Apa yang dimaksud dengan Retrieval-Augmented Generation?", expect: "Retrieval-Augmented Generation for JURNAL" },
  { q: "Bagaimana sistem informasi perdagangan diatur?", expect: "PERMENDAG NOMOR 28 TAHUN 2024" },
  { q: "Berapa jumlah perusahaan game di Jepang?", expect: "Jepang_Data_Game" },
  { q: "Apa proyeksi Jepang pada tahun 2030?", expect: "TEST" },
  { q: "Kode HS untuk produk decoration lights adalah berapa?", expect: "ND208_Laporan Informasi Pasar_Decoration Lights" },
  { q: "Siapa institusi penulis jurnal prediksi harga komoditas pertanian?", expect: "jurnal ai 1" },
  { q: "Bagaimana tahapan mendirikan restoran di Jepang bagi WNA?", expect: "Jepang_Data_Restoran" },
];

for (const c of cases) {
  const res = await searchDocuments(c.q);
  console.log("\n\n########## " + c.q);
  console.log("EXPECT:", c.expect);
  if (!res.documents.length) {
    console.log("  >>> TIDAK ADA HASIL (AI tidak bisa menjawab)");
    continue;
  }
  res.documents.forEach((d, i) => {
    const m = res.metadata[i];
    const hit = m.filename.includes(c.expect) || c.expect.includes(m.filename);
    console.log(`  [${hit ? "OK " : "!!!"}] ${m.filename} | hp ${m.page} | d=${res.distances[i].toFixed(3)}`);
  });
}
