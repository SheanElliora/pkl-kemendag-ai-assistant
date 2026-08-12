# Progress RAG Chatbot PKL Kemendag

## Tahap selesai

- [x] Perbaiki re-upload dokumen
- [x] Hapus vector lama dan cache chunk lama
- [x] Jadikan ekspansi query universal (LLM-based)

## Sedang dikerjakan

- [ ] Ekstraksi nomor halaman tercetak (bukan index chunk) untuk sitasi akurat

## Catatan penting

- File utama: `services/retrieverService.js`
- Fungsi yang sedang diperbaiki: `searchDocuments()`
- Target: sitasi menampilkan halaman PDF asli, bukan nomor chunk retrieval.