// scripts/testRagFull.mjs — Uji 40 pertanyaan ke sistem RAG
// Jalankan: node scripts/testRagFull.mjs

const BASE = "http://localhost:3001/api/chat";

const questions = [
  // ===== 1. Jepang_Data_Game =====
  { id: 1, doc: "Jepang_Data_Game", diff: "Mudah",
    q: "Berapa jumlah penduduk Jepang menurut data estimasi 2024?",
    expect: "123.201.945 jiwa" },
  { id: 2, doc: "Jepang_Data_Game", diff: "Mudah",
    q: "Siapa publisher game pertama yang meluncurkan Space Invaders dan pada tahun berapa?",
    expect: "Namco, 1978" },
  { id: 3, doc: "Jepang_Data_Game", diff: "Sedang",
    q: "Berapa nilai GDP Jepang per kapita dan berapa angka inflasi tahun 2023?",
    expect: "GDP per kapita USD 33.834, inflasi 3,3%" },
  { id: 4, doc: "Jepang_Data_Game", diff: "Sedang",
    q: "Apa saja kode klasifikasi CPC yang digunakan untuk layanan video game menurut dokumen ini?",
    expect: "CPC 385, 478, 843" },
  { id: 5, doc: "Jepang_Data_Game", diff: "Sulit",
    q: "Bagaimana distribusi usia penduduk Jepang (0-14, 15-64, 65+) dan apa implikasinya terhadap pasar game?",
    expect: "0-14: 12,1%, 15-64: 58,4%, 65+: 29,5%" },
  { id: 6, doc: "Jepang_Data_Game", diff: "Sulit",
    q: "Berapa jumlah bandara di Jepang dan berapa total panjang jaringan jalan raya?",
    expect: "95 bandara, 1.218.772 km jalan" },

  // ===== 2. Jepang_Data_Restoran =====
  { id: 7, doc: "Jepang_Data_Restoran", diff: "Mudah",
    q: "Berapa modal minimum dalam yen yang dibutuhkan untuk mendirikan bisnis restoran di Jepang?",
    expect: "JPY 5.000.000" },
  { id: 8, doc: "Jepang_Data_Restoran", diff: "Mudah",
    q: "Berapa lama waktu yang diperlukan untuk pendaftaran perusahaan di Jepang?",
    expect: "3 bulan" },
  { id: 9, doc: "Jepang_Data_Restoran", diff: "Sedang",
    q: "Bandingkan tiga struktur bisnis KK, GK, dan LLP di Jepang dari segi biaya pendaftaran.",
    expect: "KK min 150.000 yen, GK min 60.000 yen" },
  { id: 10, doc: "Jepang_Data_Restoran", diff: "Sedang",
    q: "Apa saja lisensi yang dibutuhkan untuk membuka restoran di Jepang dan bagaimana ketentuan lisensi pencegahan kebakaran?",
    expect: "Izin Usaha Restoran, Manajer Kesehatan, Pencegahan Kebakaran; <30 org tidak perlu, 30+ <300m2 junior, >300m2 senior" },
  { id: 11, doc: "Jepang_Data_Restoran", diff: "Sulit",
    q: "Urutkan secara kronologis tahapan mendirikan restoran di Jepang dari awal hingga beroperasi, termasuk estimasi waktu dan biaya masing-masing tahap.",
    expect: "Pendaftaran perusahaan 3 bulan, Visa 1-2 bulan, Kesehatan 1 hari, Kebakaran, Izin Restoran 1 bulan" },
  { id: 12, doc: "Jepang_Data_Restoran", diff: "Sulit",
    q: "Bagaimana sistem skor Highly Skilled Professional mempengaruhi lamanya waktu untuk mendapatkan izin tinggal permanen di Jepang?",
    expect: "70+ poin = PR 3 tahun, 80+ = PR 1 tahun, reguler 10 tahun" },

  // ===== 3. Jepang_Instrumen_Peralatan_Medis =====
  { id: 13, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Mudah",
    q: "Berapa nilai pasar perangkat medis Jepang tahun 2024 dan berapa proyeksi CAGR-nya?",
    expect: "USD 32 miliar, CAGR 4,4%" },
  { id: 14, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Mudah",
    q: "Berapa tarif MFN untuk impor instrumen medis HS 901890 ke Jepang?",
    expect: "0% (bebas)" },
  { id: 15, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sedang",
    q: "Apa saja empat kelas risiko dalam regulasi PMD Act di Jepang dan bagaimana sistem QMS yang diterapkan?",
    expect: "Kelas I-IV, QMS = ISO 13485:2016 + Peraturan Menteri No. 169" },
  { id: 16, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sedang",
    q: "Sebutkan tiga sub-kategori terbesar dari HS 901890 beserta pangsa pasarnya masing-masing.",
    expect: "901890021 = 39,12%, 901890023 = 28,04%, 901890022 = 18,04%" },
  { id: 17, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sulit",
    q: "Bagaimana posisi kompetitif Indonesia dibandingkan Vietnam dan Thailand dalam ekspor instrumen medis ke Jepang dari sisi peringkat, pangsa pasar, dan nilai unit?",
    expect: "Indonesia rank 37 <1% $42,29/unit; Vietnam 2-3% $16,15; Thailand 2-3% $13,62" },
  { id: 18, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sulit",
    q: "Mengapa meskipun tarif MFN-nya 0%, Indonesia hanya menguasai kurang dari 1% pasar impor Jepang untuk instrumen medis?",
    expect: "Unit value mahal, kompetitor ASEAN sudah lebih dulu, label bahasa Jepang, sertifikasi GS1" },

  // ===== 4. ND208_Decoration_Lights =====
  { id: 19, doc: "ND208_Decoration_Lights", diff: "Mudah",
    q: "Berapa nilai impor Nigeria untuk dekorasi lampu HS 9405 tahun 2024 dan berapa pertumbuhan year-on-year-nya?",
    expect: "USD 50,1 juta, +64,4% YoY" },
  { id: 20, doc: "ND208_Decoration_Lights", diff: "Mudah",
    q: "Negara mana yang mendominasi ekspor lampu dekorasi ke Nigeria dan berapa persen pangsa pasarnya?",
    expect: "Tiongkok, 82,7%" },
  { id: 21, doc: "ND208_Decoration_Lights", diff: "Sedang",
    q: "Jelaskan perbedaan segmen pasar lampu dekorasi di Nigeria (massal, menengah, premium) beserta kisaran harganya.",
    expect: "Massal NGN 50.000-350.000, premium NGN 600.000-2.400.000+" },
  { id: 22, doc: "ND208_Decoration_Lights", diff: "Sedang",
    q: "Apa saja sertifikasi dan dokumen yang wajib dimiliki oleh eksportir lampu dekorasi ke Nigeria?",
    expect: "SONCAP, Form M, VAT 7,5%" },
  { id: 23, doc: "ND208_Decoration_Lights", diff: "Sulit",
    q: "Di mana lampu dekorasi Indonesia ditemukan dalam survei harga di Lagos dan berapa harganya?",
    expect: "Star Light Ltd di TBS, NGN 95.000 (pendant)" },
  { id: 24, doc: "ND208_Decoration_Lights", diff: "Sulit",
    q: "Jika Indonesia ingin masuk pasar lampu dekorasi Nigeria, strategi distribusi apa yang direkomendasikan berdasarkan struktur saluran distribusi?",
    expect: "80% pasar tradisional, 20% showroom; penetrasi Balogun/Adeniji + showroom Ikoyi/VI" },

  // ===== 5. Nigeria_Tekstil_Ankara =====
  { id: 25, doc: "Nigeria_Tekstil_Ankara", diff: "Mudah",
    q: "Berapa total nilai impor kain Ankara HS 5208-5212 Nigeria tahun 2025?",
    expect: "USD 892.407" },
  { id: 26, doc: "Nigeria_Tekstil_Ankara", diff: "Mudah",
    q: "Berapa nilai ekspor Indonesia kain Ankara ke Nigeria tahun 2025?",
    expect: "USD 2.490" },
  { id: 27, doc: "Nigeria_Tekstil_Ankara", diff: "Sedang",
    q: "Jelaskan empat segmen harga kain Ankara beserta kisaran harga per meternya.",
    expect: "Massal $1-3/m, Menengah $3-6/m, Premium $6-12+/m, Institusional" },
  { id: 28, doc: "Nigeria_Tekstil_Ankara", diff: "Sedang",
    q: "Berapa tarif bea masuk dan PPN yang berlaku untuk impor kain Ankara ke Nigeria?",
    expect: "Bea masuk 20% + PPN 7,5%" },
  { id: 29, doc: "Nigeria_Tekstil_Ankara", diff: "Sulit",
    q: "Analisis margin rantai nilai dari impor kain Ankara di Nigeria dari importir hingga butik/desainer.",
    expect: "Importir 10-25%, Distributor 10-20%, Ritel pasar 20-40%, Butik/desainer 50-200%+" },
  { id: 30, doc: "Nigeria_Tekstil_Ankara", diff: "Sulit",
    q: "Mengapa ekspor Indonesia kain Ankara ke Nigeria hanya USD 2.490 meskipun Nigeria memiliki populasi 241 juta?",
    expect: "Tiongkok dominan, India tumbuh +93%, fokus ekspor Indonesia bukan ke Afrika, tarif 20%" },

  // ===== 6. PERMENDAG 28/2024 =====
  { id: 31, doc: "PERMENDAG_28_2024", diff: "Mudah",
    q: "Peraturan menteri ini membahas implementasi dari PP berapa dan tahun berapa?",
    expect: "PP No. 5 Tahun 2020" },
  { id: 32, doc: "PERMENDAG_28_2024", diff: "Mudah",
    q: "Siapa yang menandatangani Peraturan Menteri Perdagangan No. 28 Tahun 2024 dan kapan?",
    expect: "Menteri Perdagangan Budi Santoso, 30 Oktober 2024" },
  { id: 33, doc: "PERMENDAG_28_2024", diff: "Sedang",
    q: "Sebutkan enam komponen Sistem Informasi Perdagangan (SIP) sebagaimana dimaksud dalam Pasal 3.",
    expect: "Data/Info Perdagangan, SDM, Perangkat Keras, Perangkat Lunak, Keamanan Informasi, Tata Kelola" },
  { id: 34, doc: "PERMENDAG_28_2024", diff: "Sedang",
    q: "Jelaskan mekanisme lima tahapan dalam pengelolaan data perdagangan berdasarkan Pasal 18.",
    expect: "Pengumpulan, Pengolahan, Penyampaian, Pengelolaan, Penyebarluasan" },
  { id: 35, doc: "PERMENDAG_28_2024", diff: "Sulit",
    q: "Bagaimana sistem akses Single Sign-On (SSO) diatur dalam PM 28/2024 untuk pengguna internal dan eksternal?",
    expect: "Internal = intranet Kemendag, Eksternal = akun OSS" },
  { id: 36, doc: "PERMENDAG_28_2024", diff: "Sulit",
    q: "Sebutkan empat kategori besar data perdagangan dalam PM 28/2024 dan jelaskan masing-masing.",
    expect: "Dalam Negeri, Luar Negeri, Berjangka Komoditi, Lainnya; total 29 klasifikasi di Lampiran I" },

  // ===== 7. Jurnal RAG =====
  { id: 37, doc: "Jurnal_RAG", diff: "Mudah",
    q: "Siapa saja penulis utama dari jurnal RAG ini dan dari institusi mana?",
    expect: "Patrick Lewis et al., Facebook AI Research, UCL, NYU" },
  { id: 38, doc: "Jurnal_RAG", diff: "Sedang",
    q: "Jelaskan perbedaan antara RAG-Sequence dan RAG-Token dalam cara mereka mengambil dokumen referensi.",
    expect: "RAG-Sequence: dokumen sama per sequence; RAG-Token: dokumen berbeda per token" },
  { id: 39, doc: "Jurnal_RAG", diff: "Sulit",
    q: "Jurnal ini melakukan eksperimen index hot-swapping. Berapa akurasi saat indeks 2016 dipakai untuk pertanyaan 2016, dan bagaimana saat terjadi ketidakcocokan indeks?",
    expect: "70% (cocok), 68% (2018), 4-12% (tidak cocok)" },

  // ===== 8. Jurnal Prediksi Harga Komoditas =====
  { id: 40, doc: "Jurnal_Komoditas", diff: "Mudah",
    q: "Apa lima algoritma machine learning yang dibandingkan dalam penelitian ini?",
    expect: "ARIMA, SVR, Prophet, XGBoost, LSTM" },
  { id: 41, doc: "Jurnal_Komoditas", diff: "Mudah",
    q: "Algoritma mana yang terpilih sebagai yang terbaik dalam penelitian ini dan berapa nilai MSE rata-ratanya?",
    expect: "LSTM, MSE 0,304" },
  { id: 42, doc: "Jurnal_Komoditas", diff: "Sedang",
    q: "Jelaskan perbedaan antara Series 1 dan Series 2 dalam desain eksperimen penelitian ini dan mengapa hasilnya berbeda.",
    expect: "Series 1 data kecil univariate, Series 2 data besar multivariate; LSTM naik 45,5%, ARIMA turun 74,1%" },
  { id: 43, doc: "Jurnal_Komoditas", diff: "Sulit",
    q: "Mengapa ARIMA turun 74,1% di Series 2 sementara LSTM naik 45,5% saat data lebih besar dan multivariate?",
    expect: "ARIMA linier, tidak menangani multivariate; LSTM recurrent, menangani sekuens temporal dan multiple inputs" },
];

async function ask(question) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, stream: false }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return { ok: true, answer: data.reply || data.answer || data.error || "(no answer)", sources: data.sources || [] };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, answer: err.name === "AbortError" ? "TIMEOUT (60s)" : err.message, sources: [] };
  }
}

function score(answer, expect) {
  const a = answer.toLowerCase().replace(/[,.\s]+/g, " ").trim();
  // Extract meaningful keywords (3+ chars) from expected answer
  const keywords = expect.toLowerCase().replace(/[,.\s]+/g, " ").split(" ").filter(w => w.length >= 2);
  const hits = keywords.filter(k => a.includes(k));
  const ratio = hits.length / keywords.length;
  if (ratio >= 0.5) return "BENAR";
  if (ratio >= 0.25) return "SEBAGIAN";
  return "SALAH";
}

console.log(`Menguji ${questions.length} pertanyaan...\n`);

const results = [];
for (const item of questions) {
  process.stdout.write(`[${item.id}/${questions.length}] ${item.doc} (${item.diff})... `);
  const res = await ask(item.q);
  const status = res.ok ? score(res.answer, item.expect) : "GAGAL";
  results.push({ ...item, status, answer: res.answer, sources: res.sources });
  console.log(status);
  // Delay untuk menghindari rate limit
  await new Promise(r => setTimeout(r, 3000));
}

// Ringkasan
console.log("\n" + "=".repeat(80));
console.log("RINGKASAN HASIL");
console.log("=".repeat(80));

const benar = results.filter(r => r.status === "BENAR").length;
const sebagian = results.filter(r => r.status === "SEBAGIAN").length;
const salah = results.filter(r => r.status === "SALAH").length;
const gagal = results.filter(r => r.status === "GAGAL").length;

console.log(`BENAR   : ${benar}/${results.length}`);
console.log(`SEBAGIAN: ${sebagian}/${results.length}`);
console.log(`SALAH   : ${salah}/${results.length}`);
console.log(`GAGAL   : ${gagal}/${results.length}`);

// Detail yang tidak benar
const issues = results.filter(r => r.status !== "BENAR");
if (issues.length > 0) {
  console.log("\n" + "=".repeat(80));
  console.log("DETAIL PERTANYAAN BERMASALAH");
  console.log("=".repeat(80));
  for (const r of issues) {
    console.log(`\n--- [${r.id}] ${r.doc} (${r.diff}) ---`);
    console.log(`Pertanyaan : ${r.q}`);
    console.log(`Jawaban Benar: ${r.expect}`);
    console.log(`Status     : ${r.status}`);
    console.log(`Jawaban LLM: ${r.answer.substring(0, 500)}`);
    if (r.sources.length > 0) {
      console.log(`Sumber     : ${r.sources.map(s => s.filename || s.title || s.source || "unknown").join(", ")}`);
    }
  }
}

// Simpan hasil lengkap
import { writeFileSync } from "fs";
writeFileSync("scripts/testRagResults.json", JSON.stringify(results, null, 2));
console.log("\nHasil lengkap disimpan ke scripts/testRagResults.json");
