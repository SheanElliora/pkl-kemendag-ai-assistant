# Demo Cheatsheet — 6 Golden Question (hindari 2 Jurnal yang flaky)

> Jalankan 5 menit sebelum demo:
> `cd backend; node scripts/healthCheck.mjs --no-chat` (harus 4 PASS)
> `node scripts/primeDemo.mjs` (8 query, cache 10 menit aktif, hit kedua <100ms)
> Jika perlu bersih: `node scripts/resetDemo.mjs` (backup otomatis ke backup/pre-reset-*)
> Urutan start: Chroma :8000 -> Backend :3001 (tunggu warmup) -> Frontend :5173

## 1) Sapaan — tanpa retrieval, tanpa sitasi
**Q:** `halo`
**Ekspektasi:** `conversational:true`, `sources:0`, sapaan hangat + perkenalan AI Assistant Kemendag. Banner "tidak ditemukan" tidak muncul (`ChatPage.jsx` cek `m.conversational`).

## 2) Identitas
**Q:** `kamu siapa?`
**Ekspektasi:** `conversational:true`, `sources:0`, "AI Assistant Sistem Informasi Perdagangan Kemendag... regulasi, ekspor-impor, komoditas..."

## 3) Ankara Nigeria — angka wajib
**Q:** `Siapa pemasok terbesar kain Ankara ke Nigeria?`
**Ekspektasi:** `Tiongkok ... [1]` + 1 sumber (`Nigeria_Martel Tekstil Kain Ankara.pdf`). Jika ditanya nilai: `USD 2.490 [1]` (contoh prompt `llmService.js:99`).

## 4) Restoran Jepang — tahapan
**Q:** `Bagaimana tahapan mendirikan restoran di Jepang?`
**Ekspektasi:** 3-5 poin ringkas + sitasi `[n]`, sumber `Jepang_Data_Restoran.pdf`.

## 5) Decoration lights Nigeria — persyaratan impor
**Q:** `Apa saja persyaratan impor decoration lights ke Nigeria?`
**Ekspektasi:** daftar persyaratan + sitasi, sumber `ND208_Laporan Informasi Pasar_Decoration Lights...pdf`.

## 6) Game Jepang — proyeksi
**Q:** `Bagaimana proyeksi pendapatan industri game di Jepang?`
**Ekspektasi:** angka proyeksi + sitasi, sumber `Jepang_Data_Game.pdf`.

## Cadangan (aman)
- `Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024?` → `PERMENDAG NOMOR 28 TAHUN 2024.pdf`
- `Apa saja persyaratan impor instrumen dan peralatan medis ke Jepang?` → `Jepang_Instrumen_Peralatan_Medis.pdf`

## Follow-up konteks (demo context gate)
Setelah Q4, coba langsung: `berapa modalnya?` → harus inject `jepang restoran` → jawab JPY 5jt [1] (tanpa LLM, `contextGateService.js:25`).
Setelah Q6, coba: `gamenya disana gimana?` → inject `jepang` saja → tetap `Jepang_Data_Game.pdf` benar.

## Yang dihindari saat demo
- `JURNAL.pdf` Q15-Q16 (instabilitas model gratis, 12.5% gagal) — recall OK tapi LLM kadang terpotong.
- Flood `/api/chat` (>20/menit/IP → 429) — beri jeda 800ms antar query (primeDemo sudah).
- Tampilkan `backend/.env` di layar (API key + `DEFAULT_ADMIN_PASSWORD`).

## Jika model free 429/404 di tengah demo
Ganti 1 baris di `backend/.env`: `OPENROUTER_MODEL=openai/gpt-4o-mini` (paid fallback terakhir di `modelCatalog.js:11` + `llmService.js:16`), lalu `npm start` ulang (±30 detik warmup). Fallback chain otomatis `nex-pro → nex-mini → ling-fin → gpt-4o-mini`.

## Checklist 60 detik
- [ ] `GET /api/health` → `{"status":"OK"}`
- [ ] `GET /api/docs` (Swagger) tampil
- [ ] CMS login `admin / AdminKemendag2026!` → tab Evaluasi RAG `7/7 PASS`
- [ ] Chat kirim `halo` → 0 sumber (bukan "tidak ditemukan")
- [ ] Chat kirim `Siapa pemasok terbesar kain Ankara ke Nigeria?` → `Tiongkok [1]`
