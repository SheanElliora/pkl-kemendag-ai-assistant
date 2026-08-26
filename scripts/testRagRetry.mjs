// =====================================================
// Re-test HANYA pertanyaan yang sebelumnya GAGAL
// untuk verifikasi perbaikan — hemat token API.
// =====================================================

const BASE = "http://localhost:3001";

const RETRY = [
  {
    id: 5, doc: "Jepang_Data_Game", diff: "Sulit",
    q: "Bagaimana distribusi usia penduduk Jepang (0-14, 15-64, 65+) dan apa implikasinya terhadap pasar game?",
    expect: "0-14: 12,1%, 15-64: 58,4%, 65+: 29,5%"
  },
  {
    id: 15, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sedang",
    q: "Apa saja empat kelas risiko dalam regulasi PMD Act di Jepang dan bagaimana sistem QMS yang diterapkan?",
    expect: "Kelas I-IV, QMS = ISO 13485:2016 + Peraturan Menteri No. 169"
  },
  {
    id: 18, doc: "Jepang_Instrumen_Peralatan_Medis", diff: "Sulit",
    q: "Mengapa meskipun tarif MFN-nya 0%, Indonesia hanya menguasai kurang dari 1% pasar impor Jepang untuk instrumen medis?",
    expect: "Unit value mahal, kompetitor ASEAN sudah lebih dulu, label bahasa Jepang, sertifikasi GS1"
  },
  {
    id: 24, doc: "ND208_Decoration_Lights", diff: "Sulit",
    q: "Jika Indonesia ingin masuk pasar lampu dekorasi Nigeria, strategi distribusi apa yang direkomendasikan berdasarkan struktur saluran distribusi?",
    expect: "80% pasar tradisional, 20% showroom; penetrasi Balogun/Adeniji + showroom Ikoyi/VI"
  },
  {
    id: 26, doc: "Nigeria_Tekstil_Ankara", diff: "Mudah",
    q: "Berapa nilai ekspor Indonesia kain Ankara ke Nigeria tahun 2025?",
    expect: "USD 2.490"
  },
  {
    id: 27, doc: "Nigeria_Tekstil_Ankara", diff: "Sedang",
    q: "Jelaskan empat segmen harga kain Ankara beserta kisaran harga per meternya.",
    expect: "Massal $1-3/m, Menengah $3-6/m, Premium $6-12+/m, Institusional"
  },
  {
    id: 42, doc: "Jurnal_Komoditas", diff: "Sedang",
    q: "Jelaskan perbedaan antara Series 1 dan Series 2 dalam desain eksperimen penelitian ini dan mengapa hasilnya berbeda.",
    expect: "Series 1 data kecil univariate, Series 2 data besar multivariate; LSTM naik 45,5%, ARIMA turun 74,1%"
  }
];

function score(answer, expect) {
  const a = answer.toLowerCase().replace(/[,.\s]+/g, " ").trim();
  const keywords = expect.toLowerCase().replace(/[,.\s]+/g, " ").split(" ").filter(w => w.length >= 2);
  const hits = keywords.filter(k => a.includes(k));
  const ratio = hits.length / keywords.length;
  if (ratio >= 0.5) return "BENAR";
  if (ratio >= 0.25) return "SEBAGIAN";
  return "SALAH";
}

async function ask(q) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: q,
      sessionId: "retry-test",
      clientId: "retry-client"
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { ok: true, answer: data.reply || data.answer || data.error || "(no answer)", sources: data.sources || [] };
}

console.log(`Re-test ${RETRY.length} pertanyaan yang sebelumnya gagal...\n`);

let benar = 0, sebagian = 0, salah = 0;

for (const t of RETRY) {
  process.stdout.write(`[${t.id}] ${t.doc} (${t.diff})... `);
  try {
    const r = await ask(t.q);
    const s = score(r.answer, t.expect);
    console.log(s);
    console.log(`  Jawaban: ${r.answer.substring(0, 250)}`);
    console.log(`  Sumber: ${(r.sources || []).map(s => s.filename || s).join(", ")}`);
    console.log();
    if (s === "BENAR") benar++;
    else if (s === "SEBAGIAN") sebagian++;
    else salah++;
  } catch (e) {
    console.log("ERROR:", e.message);
    salah++;
  }
  await new Promise(r => setTimeout(r, 3000));
}

console.log("========================================");
console.log(`BENAR: ${benar} | SEBAGIAN: ${sebagian} | SALAH: ${salah} | TOTAL: ${RETRY.length}`);
console.log("========================================");
