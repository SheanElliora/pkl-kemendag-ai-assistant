# Konteks Proyek PKL AI Assistant (Kemendag)

Ringkasan ini dimuat otomatis oleh opencode setiap sesi baru. Baca sebelum mengerjakan apa pun.

## Status (terakhir diperbarui 19-08-2026)

- Proyek di C:\dev\pkl-kemendag-ai-assistant (SUDAH dipindah keluar OneDrive - jangan pindahkan lagi).
- Sistem 100% sehat: ChromaDB :8000, Backend :3001, Frontend :5173. Login CMS: admin / AdminKemendag2026! (password lain ada di backend/.env - jangan commit .env).
- Git: branch main, semua commit ter-push. Commit terakhir = UI dikembalikan ke desain semula (gradient header #001845->#00439c + garis emas, logo hero berwarna multiply, aurora kuat, toggle emas/teal, shadow besar) — yang dipertahankan: tombol riwayat icon-only 40px (IconMenu) di kiri-atas area chat, scrollbar seragam .thin-scroll, label "Enter untuk kirim" dihapus dari input box.
- npm audit backend = 0 vuln (overrides protobufjs 7.6.5, js-yaml 4.3.1, sharp@0.32.6->0.35.3). npm install backend WAJIB --legacy-peer-deps.
- Approve dokumen ASINKRON: POST approve -> status "processing" (antrean latar belakang ingestQueue.js, 1 worker FIFO) -> "approved"/"error". Frontend polling 5 dtk saat ada "processing". Jangan harap langsung "approved".
- Embedding ingest memakai BATCH (EMBED_BATCH=16 di ingest.js, createEmbeddingsBatch di embedderService.js — menangani semua bentuk output transform.js). Rerank width = 10 (retrieverService.js).
- CHAT BARU (fase-2): riwayat multi-turn via sessionId (disimpan data/chats.json, owner = user:<id> bila token Bearer, client:<id> bila clientId, else guest). Endpoint: POST /api/chat (body sessionId/clientId), GET /api/chat/history, GET|DELETE /api/chat/history/:sessionId, POST /api/chat/feedback (rating up/down + komentar), GET /api/chat/history/:sessionId/export?format=html|doc. Konteks 6 pesan terakhir dikirim ke LLM.
- RETRIEVAL hybrid: BM25 (bm25Service.js, korpus dari chunks/*.json, cache mtime) di-union dengan kandidat vektor (BM25_WIDTH=60, BM25_BONUS=0.3) sebelum rerank. Perilaku vektor lama tidak berubah.
- Dokumentasi API: GET /api/docs (Swagger UI), GET /api/docs.json (OpenAPI). Statistik: GET /api/stats (publik), GET /api/cms/stats (admin: dokumen/vektor/user/chat+feedback).
- Tes CMS E2E: 28 PASS / 0 FAIL (node scripts/testCmsFullLifecycle.mjs).
- Tes dokumen BARU end-to-end: 11 PASS / 0 FAIL (node scripts/testNewDocE2E.mjs: upload->approve->chunk JSON->vektor Chroma->sitasi chat->hapus->bersih).
- Unit test service inti: 14 PASS / 0 FAIL (npm test = node --test "tests/*.test.mjs"; bm25Service, chatHistoryService, chunkService; TANPA dependency baru).
- Evaluasi RAG: 14 PASS / 0 FAIL (node scripts/evalRag.mjs: recall@7 = 7/7 + sitasi jawaban benar; --no-llm untuk retrieval saja).
- Tes UI browser (Playwright, frontend/): npx playwright test = 5 PASS (chat hero+streaming+cleanup, siklus CMS upload->approve->delete via UI, feedback ke server, export HTML/DOC — self-cleaning, chats.json bersih 0 sesi setelah suite). Instal browser: npx playwright install chromium. Jebakan: GET /api/chat/history TANPA clientId/token HANYA menampilkan sesi owner "guest" — sesi client:*/user:* harus dibersihkan per-id via DELETE /api/chat/history/:id (baca id langsung dari backend/data/chats.json).
- Cek kesehatan cepat: node scripts/healthCheck.mjs (5 PASS: backend, frontend, Chroma v2, 631 vektor, chat RAG end-to-end; flag --no-chat untuk skip LLM).
- Runbook ultra-ringkas: RUNBOOK.md (start, cek, tes, backup, kredensial, jebakan).
- Backup Chroma terverifikasi bisa di-restore (631 vektor, ID collection sama). files.json sempat terhapus insiden BOM PowerShell (18-08-2026) dan BERHASIL di-restore dari backup/2026-08-17_20-58-28/files.json.
- Backup otomatis: `npm run backup` (scripts/backupChroma.mjs) -> backup/<waktu>/ di akar repo (git-ignored), berisi chroma/ + files.json + users.json + manifest; stop-hidupkan Chroma, verifikasi vektor, simpan 5 terbaru. Jalankan tiap kali dokumen baru di-approve (atau via Task Scheduler).
- Rate-limit: login 10x/15mnt/IP, chat 20/mnt/IP -> 429.
- DESAIN UI (halaman chat): header gradient #001845->#00439c + garis emas inset rgba(233,163,25,0.55), logo putih header + hero logo berwarna mixBlend multiply (dua mode tema), aurora kuat (opacity 0.55/0.3, blob biru/sky/emas), toggle tema emas (#e9a319) / teal (#14b8a6, knob #78350f/#0f766e), aksen emas (divider hero, "Sumber Referensi" #c98500, borderRight bubble user), shadow card besar 0 18px 50px rgba(15,40,80,0.14). Tombol riwayat = icon-only 40px (IconMenu) di kiri-atas area chat (zIndex 12, top 116px desktop / 90px mobile). Scrollbar seragam .thin-scroll. Label "Enter untuk kirim" TIDAK ada.
- DESAIN UI (referensi situs resmi kemendag.go.id): biru brand = #004DAF (aksen utama, header solid, tombol), hijau #16a75c (aksen kedua: toggle tema, garis pemisah hero, "Sumber Referensi", border bubble user, status "Terhubung"), emas TIDAK dipakai di halaman chat (tetap dipakai di CMS). Header: logo putih + teks "KEMENTERIAN PERDAGANGAN / Republik Indonesia" (desktop). Hero: logo berwarna (mixBlend multiply) di light, logo putih di dark. Aurora tipis (opacity 0.12-0.22). Shadow flat (card 0 2px 10px). Font: Inter + Sora (heading). Tombol riwayat = icon-only 40px (IconMenu) di kiri-atas area chat (zIndex 12, top 116px desktop / 90px mobile).

## Cara menjalankan (3 terminal)

1. `cd C:\dev\pkl-kemendag-ai-assistant\backend; chroma run --path ./chroma`
2. `cd C:\dev\pkl-kemendag-ai-assistant\backend; npm start`
3. `cd C:\dev\pkl-kemendag-ai-assistant\frontend; npm run dev`

Detail lengkap di DEMO.md dan README.md (seksi Cadangan & Pemulihan).

## Catatan penting

- backend/data/files.json berisi 11 record (8 dokumen approved + artefak tes) - JANGAN dihapus. Folder data: docs/, uploads/, ocr_text/, chunks/ ada di backend/ (chunk file = <nama>_chunks.json di backend/chunks/).
- Cache model lokal backend\node_modules\@xenova\transformers\.cache = 434 MB (ikut terhapus bila node_modules dibersihkan).
- ChromaDB memakai API v2: /api/v2/tenants/default_tenant/databases/default_database/collections/... (root /api/v1 -> 410; /count -> 400; retrieval tetap jalan).
- Backup tersimpan di C:\Users\shean\AppData\Local\Temp\opencode\: KONTEKS_PEMULIHAN.md (lengkap + kredensial), backup_chroma_chunks, users_backup.json. Backup aktif sekarang di C:\dev\pkl-kemendag-ai-assistant\backup\ (lihat npm run backup).
- Installer .exe/.msi di Downloads JANGAN dihapus (kebutuhan UAS kampus).
- Pelajaran: jangan kirim JSON inline di PowerShell+curl (pakai --data "@file"); jangan flood /api/chat (backend macet); hapus folder OneDrive besar = hentikan OneDrive dulu; JANGAN edit files.json dgn PowerShell Set-Content -Encoding UTF8 (menulis BOM -> backend JSON.parse gagal -> baca [] -> data tertimpa; gunakan Node atau editor biasa).
- Folder sisa OneDrive ...PKL-Kemendag\Machine Learning - Copy (0 MB) SUDAH dihapus (18-08-2026, hentikan OneDrive dulu).
- OneDrive hanya berisi dokumentasi PKL (01-Regulasi s/d 09-Backend) - BUKAN proyek.