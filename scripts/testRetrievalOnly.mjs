// =====================================================
// Test RETRIEVAL SAJA (tanpa LLM) — 0 token API
// Verifikasi apakah chunk yang tepat masuk context
// setelah perbaikan KEYWORD_BONUS + TERM_EN.
//
// Jalankan dari ROOT: node scripts/testRetrievalOnly.mjs
// =====================================================

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..", "backend");

// Set env BEFORE importing anything from backend
process.env.CHUNKS_PATH = path.join(backendDir, "chunks");
process.env.DOCS_PATH = path.join(backendDir, "docs");
process.env.UPLOADS_PATH = path.join(backendDir, "uploads");
process.env.DATA_PATH = path.join(backendDir, "data");
process.env.OCR_PATH = path.join(backendDir, "ocr_text");
process.env.CHROMA_URL = "http://localhost:8000";

const toFileURL = p => "file:///" + p.replace(/\\/g, "/");

const { searchDocuments } = await import(
  toFileURL(path.join(backendDir, "services", "retrieverService.js"))
);

const QUESTIONS = [
  {
    id: 5, doc: "Jepang_Data_Game",
    q: "Bagaimana distribusi usia penduduk Jepang (0-14, 15-64, 65+) dan apa implikasinya terhadap pasar game?",
    mustContain: ["12,1", "58,4", "29,5"]
  },
  {
    id: 15, doc: "Jepang_Instrumen_Peralatan_Medis",
    q: "Apa saja empat kelas risiko dalam regulasi PMD Act di Jepang dan bagaimana sistem QMS yang diterapkan?",
    mustContain: ["Kelas I", "Kelas IV", "ISO 13485"]
  },
  {
    id: 18, doc: "Jepang_Instrumen_Peralatan_Medis",
    q: "Mengapa meskipun tarif MFN-nya 0%, Indonesia hanya menguasai kurang dari 1% pasar impor Jepang untuk instrumen medis?",
    mustContain: ["peringkat", "0,05"]
  },
  {
    id: 24, doc: "ND208_Decoration_Lights",
    q: "Jika Indonesia ingin masuk pasar lampu dekorasi Nigeria, strategi distribusi apa yang direkomendasikan berdasarkan struktur saluran distribusi?",
    mustContain: ["80%", "20%", "tradisional"]
  },
  {
    id: 26, doc: "Nigeria_Tekstil_Ankara",
    q: "Berapa nilai ekspor Indonesia kain Ankara ke Nigeria tahun 2025?",
    mustContain: ["2.490", "2,490"]
  },
  {
    id: 27, doc: "Nigeria_Tekstil_Ankara",
    q: "Jelaskan empat segmen harga kain Ankara beserta kisaran harga per meternya.",
    mustContain: ["1.0", "3.0", "6.0", "per meter"]
  },
  {
    id: 42, doc: "Jurnal_Komoditas",
    q: "Jelaskan perbedaan antara Series 1 dan Series 2 dalam desain eksperimen penelitian ini dan mengapa hasilnya berbeda.",
    mustContain: ["series", "multivariable"]
  }
];

console.log(`Test retrieval-only: ${QUESTIONS.length} pertanyaan (0 token API)\n`);

let pass = 0, partial = 0, fail = 0;

for (const t of QUESTIONS) {
  process.stdout.write(`[${t.id}] ${t.doc}... `);

  try {
    const result = await searchDocuments(t.q);
    const allText = result.documents.join("\n").toLowerCase();

    const hits = t.mustContain.filter(kw => allText.includes(kw.toLowerCase()));
    const ratio = hits.length / t.mustContain.length;
    const missed = t.mustContain.filter(kw => !allText.includes(kw.toLowerCase()));

    if (ratio >= 0.6) {
      console.log(`PASS (${hits.length}/${t.mustContain.length})`);
      pass++;
    } else if (ratio >= 0.3) {
      console.log(`PARTIAL (${hits.length}/${t.mustContain.length}) — miss: ${missed.join(", ")}`);
      partial++;
    } else {
      console.log(`FAIL (${hits.length}/${t.mustContain.length}) — miss: ${missed.join(", ")}`);
      fail++;
    }

    const files = [...new Set(result.metadata.map(m => m.filename))];
    console.log(`  Chunk: ${result.documents.length} | File: ${files.join(", ")}`);
    console.log();

  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    fail++;
  }
}

console.log("========================================");
console.log(`PASS: ${pass} | PARTIAL: ${partial} | FAIL: ${fail} | TOTAL: ${QUESTIONS.length}`);
console.log("========================================");
