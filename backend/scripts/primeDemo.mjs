const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:3001";

const GOLDEN = [
  { label: "sapaan", q: "halo" },
  { label: "identitas", q: "kamu siapa?" },
  { label: "Ankara Nigeria", q: "Siapa pemasok terbesar kain Ankara ke Nigeria?" },
  { label: "restoran Jepang", q: "Bagaimana tahapan mendirikan restoran di Jepang?" },
  { label: "decoration lights Nigeria", q: "Apa saja persyaratan impor decoration lights ke Nigeria?" },
  { label: "game Jepang", q: "Bagaimana proyeksi pendapatan industri game di Jepang?" },
  { label: "SIP 28/2024", q: "Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024?" },
  { label: "instrumen medis Jepang", q: "Apa saja persyaratan impor instrumen dan peralatan medis ke Jepang?" },
];

async function hit(q) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  const t0 = Date.now();
  try {
    const res = await fetch(`${BACKEND}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, stream: false }),
      signal: ctrl.signal,
    });
    const j = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    const ok = res.status === 200 && (j.reply || "").length > 10;
    const tag = ok ? "PASS" : "FAIL";
    const conv = j.conversational ? "conv" : "rag";
    const src = Array.isArray(j.sources) ? j.sources.length : 0;
    const preview = String(j.reply || j.error || "").slice(0, 110).replace(/\s+/g, " ");
    console.log(`[${tag}] ${ms}ms [${conv} src=${src}] ${preview}`);
    return ok;
  } catch (e) {
    console.log(`[FAIL] ${q.slice(0, 40)} -> ${e.message}`);
    return false;
  } finally {
    clearTimeout(t);
  }
}

console.log(`Prime demo -> ${BACKEND} (${GOLDEN.length} query)`);
let pass = 0;
for (const g of GOLDEN) {
  process.stdout.write(`- ${g.label}: "${g.q}" ... `);
  const ok = await hit(g.q);
  if (ok) pass++;
  await new Promise((r) => setTimeout(r, 800));
}
console.log(`\nHasil: ${pass}/${GOLDEN.length} PASS`);
console.log("Cache 10 menit aktif; query kedua akan <100ms bila history kosong.");
process.exitCode = pass === GOLDEN.length ? 0 : 1;
