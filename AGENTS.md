# Konteks Proyek PKL AI Assistant (Kemendag)

Ringkasan ini dimuat otomatis oleh opencode setiap sesi baru. Baca sebelum mengerjakan apa pun.

## Status (terakhir diperbarui 18-08-2026)

- Proyek di C:\dev\pkl-kemendag-ai-assistant (SUDAH dipindah keluar OneDrive - jangan pindahkan lagi).
- Sistem 100% sehat: ChromaDB :8000, Backend :3001, Frontend :5173. Login CMS: admin / AdminKemendag2026! (password lain ada di backend/.env - jangan commit .env).
- Git: branch main, semua commit ter-push. Commit terakhir = 5454666 (E2E Playwright + backup otomatis + runbook).
- npm audit backend = 0 vuln (overrides protobufjs 7.6.5, js-yaml 4.3.1, sharp@0.32.6->0.35.3). npm install backend WAJIB --legacy-peer-deps.
- Tes CMS E2E: 27 PASS / 0 FAIL (node scripts/testCmsFullLifecycle.mjs).
- Tes UI browser (Playwright, frontend/): npx playwright test = 3 PASS (chat streaming + siklus CMS upload->approve->delete via UI, self-cleaning). Instal browser: npx playwright install chromium.
- Cek kesehatan cepat: node scripts/healthCheck.mjs (5 PASS: backend, frontend, Chroma v2, 631 vektor, chat RAG end-to-end; flag --no-chat untuk skip LLM).
- Runbook ultra-ringkas: RUNBOOK.md (start, cek, tes, backup, kredensial, jebakan).
- Backup Chroma terverifikasi bisa di-restore (631 vektor, ID collection sama). files.json sempat terhapus insiden BOM PowerShell (18-08-2026) dan BERHASIL di-restore dari backup/2026-08-17_20-58-28/files.json.
- Backup otomatis: `npm run backup` (scripts/backupChroma.mjs) -> backup/<waktu>/ di akar repo (git-ignored), berisi chroma/ + files.json + users.json + manifest; stop-hidupkan Chroma, verifikasi vektor, simpan 5 terbaru. Jalankan tiap kali dokumen baru di-approve (atau via Task Scheduler).
- Rate-limit: login 10x/15mnt/IP, chat 20/mnt/IP -> 429.

## Cara menjalankan (3 terminal)

1. `cd C:\dev\pkl-kemendag-ai-assistant\backend; chroma run --path ./chroma`
2. `cd C:\dev\pkl-kemendag-ai-assistant\backend; npm start`
3. `cd C:\dev\pkl-kemendag-ai-assistant\frontend; npm run dev`

Detail lengkap di DEMO.md dan README.md (seksi Cadangan & Pemulihan).

## Catatan penting

- backend/data/files.json berisi 11 record (8 dokumen approved + artefak tes) - JANGAN dihapus.
- Cache model lokal backend\node_modules\@xenova\transformers\.cache = 434 MB (ikut terhapus bila node_modules dibersihkan).
- ChromaDB memakai API v2: /api/v2/tenants/default_tenant/databases/default_database/collections/... (root /api/v1 -> 410; /count -> 400; retrieval tetap jalan).
- Backup tersimpan di C:\Users\shean\AppData\Local\Temp\opencode\: KONTEKS_PEMULIHAN.md (lengkap + kredensial), backup_chroma_chunks, users_backup.json. Backup aktif sekarang di C:\dev\pkl-kemendag-ai-assistant\backup\ (lihat npm run backup).
- Installer .exe/.msi di Downloads JANGAN dihapus (kebutuhan UAS kampus).
- Pelajaran: jangan kirim JSON inline di PowerShell+curl (pakai --data "@file"); jangan flood /api/chat (backend macet); hapus folder OneDrive besar = hentikan OneDrive dulu; JANGAN edit files.json dgn PowerShell Set-Content -Encoding UTF8 (menulis BOM -> backend JSON.parse gagal -> baca [] -> data tertimpa; gunakan Node atau editor biasa).
- Folder sisa OneDrive ...PKL-Kemendag\Machine Learning - Copy (0 MB) SUDAH dihapus (18-08-2026, hentikan OneDrive dulu).
- OneDrive hanya berisi dokumentasi PKL (01-Regulasi s/d 09-Backend) - BUKAN proyek.