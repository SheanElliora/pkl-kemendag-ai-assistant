# RUNBOOK - PKL Kemendag AI Assistant

Lengkap: `DEMO.md` | Recovery: `README.md` (Cadangan & Pemulihan)

## 1. Start (3 terminal, urutan wajib)

```powershell
# Terminal 1
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; chroma run --path ./chroma

# Terminal 2
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; npm start

# Terminal 3
cd "C:\dev\pkl-kemendag-ai-assistant\frontend"; npm run dev
```

Tunggu: Chroma "Running on http://localhost:8000" -> backend warmup model selesai -> Vite ready.

Backend tanpa watch: restart manual tiap ubah `llmService.js`/`.env`.

## 2. Cek kesehatan

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; node scripts/healthCheck.mjs
# --no-chat untuk skip LLM
```

## 3. Tes (self-cleaning, aman diulang)

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend";  node scripts/testCmsFullLifecycle.mjs   # 28 tes API CMS
cd "C:\dev\pkl-kemendag-ai-assistant\backend";  node scripts/testNewDocE2E.mjs          # 11 tes dokumen baru
cd "C:\dev\pkl-kemendag-ai-assistant\backend";  npm test                                # 14 unit test
cd "C:\dev\pkl-kemendag-ai-assistant\backend";  node scripts/evalRag.mjs --no-llm       # retrieval, recall 7/7
cd "C:\dev\pkl-kemendag-ai-assistant\frontend"; npx playwright test                     # 5 tes browser UI
```

Approve dokumen asinkron: status langsung `processing`, lalu poll sampai `approved` (script tes sudah menunggu otomatis).

Fase-2:

* Riwayat multi-turn: `POST /api/chat` (body `sessionId`/`clientId`), simpan di `data/chats.json`; `GET|DELETE /api/chat/history/:sessionId`.
* Feedback: `POST /api/chat/feedback`. Export: `GET /api/chat/history/:sessionId/export?format=html|doc`.
* API docs: `GET /api/docs`, `GET /api/docs.json`. Statistik: `GET /api/stats`, `GET /api/cms/stats`.
* Retrieval hybrid: vektor + BM25 (`chunks/*.json`) + rerank.

## 4. Backup (tiap selesai approve dokumen)

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; npm run backup   # -> backup/<waktu>/, simpan 5 terbaru
```

## 5. Kredensial

* CMS: `admin` / `AdminKemendag2026!`
* Password lain & JWT_SECRET: `backend/.env` (JANGAN commit)

## 6. Jebakan

| Gejala | Solusi |
|---|---|
| `npm install` backend error peer deps | Wajib `--legacy-peer-deps` |
| Chroma API `/api/v1` -> 410, `/count` -> 400 | Pakai API v2 |
| Bind `[::1]` (IPv6), `127.0.0.1:8000` gagal | Pakai `localhost:8000` |
| JSON inline di PowerShell+curl -> 400 | `--data "@file"` |
| Flood `/api/chat` -> macet/429 | Chat 20/mnt/IP, login 10x/15mnt/IP |
| Edit `files.json` via PowerShell `Set-Content` | Menulis BOM -> data rusak. Pakai Node/editor biasa |
| Dua proses di port 3001/8000 | `EADDRINUSE` -> matikan proses lama dulu |
| `node_modules` dihapus | Cache embedding 434 MB ikut hilang, unduh ulang otomatis |
| Satu backend dobel jalan | Semua `/api/chat` hang -> kill duplikat via `Stop-Process` |

## 7. Status harapan

* `GET /api/health` -> 200 OK
* Collection `sip_documents`, 9 dokumen korpus (`backend/docs/`)
* `npm audit` backend: 0 vuln
