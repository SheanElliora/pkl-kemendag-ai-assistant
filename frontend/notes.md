# RAG Chatbot PKL Kemendag — Memori Konteks

File ini adalah ringkasan konteks obrolan. Baca dulu untuk memahami
status terakhir tanpa membaca ulang kode.

## Status terakhir (Agustus 2026)

Fitur **ekstraksi nomor halaman tercetak** sudah selesai & tervalidasi.
Semua perubahan BELUM di-commit.

## Teknis inti

- Nomor halaman tercetak diekstrak `extractPrintedPage(text, pageIndex)`
  di `backend/services/chunkService.js`. Pola: baris berisi hanya angka,
  romawi (i,ii,...), "- N -" di awal baris, angka di akhir baris footer
  (guarded dengan `|print - pageIndex| <= 10`). `null` bila tidak yakin.
- `printedPage` dihitung tiap halaman di `createChunks`, disimpan di
  `chunks/*_chunks.json` + metadata Chroma. Situsi menampilkan
  `printedPage ?? page` (fallback ke indeks PDF).
- Id vektor Chroma = `${filename}_${page}_${i}`, dibangun di `ingest.js`
  (BUKAN di createChunks) — jadi upload dokumen baru otomatis generik.
- Alur dokumen baru: upload -> approve -> `ingestDocument` ->
  `loadSinglePDF` -> `processPDF` (OCR/teks digital) -> `createChunks`
  -> embed -> simpan. Kedua jalur teks (pdfPageLoader digital, ocrService
  scan) sama-sama 1-based, konsisten dengan guard pageIndex.
- Query expansion berlapis: kamus manual `TERM_EN` di retrieverService
  + LLM (OpenRouter) utk istilah baru, ada cache disk+memori.
- retrieverService dinamis (baca folder docs, filter daftar isi/cover/
  pendek, keyword & filename bonus, rerank cross-encoder, pemotongan
  adaptif). Tidak hardcoded ke dokumen tertentu.

## Perubahan terakhir

1. `chunkService.js` — parameter `pageIndex` + guard ±10 pada pola
   footer (membetulkan false positive: Game idx44 yg terdeteksi "33").
2. `ocrService.js` — folder temp OCR kini UNIK per proses
   (`./temp_ocr/<random>`) supaya 2 dokumen yang diproses bersamaan
   tidak saling menimpa gambar (korupsi teks).
3. `scripts/_benchmark.mjs` — skor halaman dibandingkan dgn nomor
   TERCETAK (bukan indeks), sesuai yang ditampilkan sitasi.
4. `scripts/_updatePrintedPages.mjs` — migrasi one-time: hitung ulang
   printedPage per halaman, update `chunks/*_chunks.json` + metadata
   Chroma (631 vektor) TANPA re-embedding. Sudah dijalankan.

## Hasil benchmark (82 soal)

- Dokumen top-1 benar: 98.8% (81/82)
- Dokumen di top-5: 100%
- Frasa di konteks top-7: 96.3%
- Halaman top-1 tepat: 56.1% (±1: 62.2%)
- Kegagalan halaman = kualitas ranking top-1 retriever (bukan ekstraksi).

## Lingkungan

- Chroma: `chroma run --path chroma --port 8000` (jalankan dari
  `backend/`). Collection: `sip_documents`.
- Backend: `npm run dev` (port 3000). Frontend: `npm run dev` (vite).
- Docs aktif ada di `backend/docs/`; OCR di `backend/ocr_text/`.
- Skrip debug/benching ada di `backend/scripts/` (prefix `_`).

## Kemungkinan lanjutan

- Menaikkan akurasi halaman: tingkatkan ranking retriever (tuning
  `MAX_CANDIDATES`/`SEARCH_WIDTH`/`RERANK_WEIGHT` di retrieverService),
  atau tambah soal benchmark utk dokumen baru bertopik lain.
- Pastikan OPENROUTER_API_KEY terisi di `backend/.env` agar ekspansi
  query LLM aktif (fallback aman ke kamus lokal bila tidak ada).