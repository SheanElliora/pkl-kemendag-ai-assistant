# PKL Kemendag AI Assistant

Sistem tanya-jawab dokumen perdagangan Kementerian Perdagangan (Kemendag) berbasis Retrieval-Augmented Generation (RAG), dilengkapi CMS untuk mengelola dokumen dan pengguna.

## Fitur

* Chatbot tanya-jawab berbasis dokumen resmi (regulasi, data pasar, komoditas) — korpus saat ini 10 dokumen approved.
* Jawaban disertai sitasi nomor halaman tercetak dari dokumen sumber.
* Streaming jawaban (SSE).
* Pilihan model AI di antarmuka chat: Gemini Flash gratis (Google AI Studio, bila `GEMINI_API_KEY` diisi) + model gratis OpenRouter, satu API key masing-masing, rantai fallback berurutan.
* Sapaan dan pertanyaan umum dijawab langsung tanpa retrieval dan tanpa sitasi.
* CMS dengan autentikasi JWT dan dua peran:
  * **Admin** — menyetujui/menolak dokumen, mengelola pengguna, melihat log login.
  * **Pengelola (Maintainer)** — mengunggah dokumen dan melihat statusnya.
* Alur dokumen: pending → processing → approved/ditolak. OCR, chunking, dan embedding berjalan otomatis setelah admin menyetujui.
* Riwayat percakapan multi-turn, feedback (up/down + komentar), dan export riwayat (HTML/DOC).
* Dokumentasi API (Swagger UI) dan endpoint statistik.

## Teknologi

Backend:

* Node.js + Express.js
* ChromaDB (penyimpanan vektor)
* OpenAI-compatible API: Google AI Studio (Gemini Flash, opsional) + OpenRouter (multi-model, rantai fallback)
* OCR sistem (`pdftoppm` + CLI `tesseract`) bila PDF scan, parsing PDF digital (pdfjs-dist)
* JWT + bcryptjs + rate-limit login, upload via multer (maks 5 file/upload, 20 MB)

Frontend:

* React.js + Vite, React Router (HashRouter), react-markdown

Model AI:

* Chat: `gemini-3.6-flash` → `gemini-3.5-flash-lite` (Google AI Studio, gratis, **hanya bila `GEMINI_API_KEY` diisi**; maks 3 model per percobaan) → `cohere/north-mini-code:free` → `dots-studio/dots-3-note-preview:free` → `nvidia/nemotron-3-super-120b-a12b:free` → `nex-agi/nex-n2.5-pro:free` → `nex-agi/nex-n2.5-mini:free` (OpenRouter gratis, 50 req/hari). Default = Gemini bila key ada, selain itu cohere. Model Gemini 2.5/2.0 sudah ditolak Google untuk user baru. Timeout LLM 15–18 detik; retry kualitas maks 2 call. Rincian di `backend/services/modelCatalog.js` + `backend/services/llmService.js`.
* Embedding lokal (`Xenova/multilingual-e5-small`), prefix `query:`/`passage:` untuk retrieval Indonesia ↔ Inggris.
* Reranker lokal (`Xenova/bge-reranker-base`), cross-encoder multibahasa.

Pendekatan retrieval:

* Hybrid: pencarian vektor + BM25, lalu rerank cross-encoder.
* Chunking adaptif berbasis kalimat (ukuran menyesuaikan jenis dokumen).
* Pemetaan istilah Indonesia ↔ Inggris (`localTerms`) + gate konteks untuk pertanyaan lanjutan ("gamenya", "berapa modalnya").
* Conversational gate: sapaan/pronomina kosong substansi dijawab langsung tanpa retrieval.

## Struktur Proyek

```
pkl-kemendag-ai-assistant/
├── backend/
│   ├── docs/                  # dokumen PDF approved (korpus RAG)
│   ├── uploads/               # file pending hasil upload CMS
│   ├── data/                  # users.json, files.json, chats.json,
│   │                          # login-logs.json, analytics_stats.json
│   ├── ocr_text/              # hasil ekstraksi teks per dokumen (<nama>.txt)
│   ├── chunks/                # hasil chunking (<nama>_chunks.json)
│   ├── chroma/                # data ChromaDB (vektor)
│   ├── routes/                # auth.js, cms.js, chat.js, docs.js
│   ├── services/              # 24 modul: rag, retriever, bm25, llm,
│   │                          # modelCatalog, chunk, embedder, reranker,
│   │                          # contextGate, conversationalGate, ocr,
│   │                          # ingestQueue, file, user, auth, dll.
│   ├── scripts/               # healthCheck.mjs, backupChroma.mjs
│   ├── tests/                 # 14 unit test (bm25, chatHistory, chunk)
│   ├── utils/                 # authMiddleware.js (JWT + role)
│   ├── config.js              # konfigurasi folder & batas upload
│   ├── ingest.js              # alur OCR → chunking → embedding
│   ├── index.js               # entrypoint server API
│   ├── .env / .env.example    # konfigurasi (jangan commit .env)
│   └── package.json           # install backend WAJIB --legacy-peer-deps
├── frontend/
│   ├── public/                # logo Kemendag (normal + putih)
│   ├── src/
│   │   ├── pages/             # ChatPage.jsx, LoginPage.jsx, CmsPage.jsx
│   │   ├── api.js             # klien API
│   │   ├── theme.js           # token warna/font (sumber tunggal)
│   │   ├── App.jsx            # routing HashRouter + lazy load CMS/Login
│   │   ├── App.css            # gaya global
│   │   └── main.jsx           # entrypoint React
│   ├── index.html             # muat Google Fonts (Sora + Source Sans 3)
│   ├── vite.config.js         # proxy /api → backend :3001
│   ├── .env.example           # VITE_API_TARGET
│   └── package.json
├── AGENTS.md                  # konteks proyek (dibaca tool AI)
├── DEMO.md                    # panduan demo + lampiran golden question
├── MATERI_PRESENTASI.md       # catatan materi presentasi (juga .docx/.pdf)
└── README.md                  # dokumentasi ini
```

Catatan: `backend/temp_ocr/` dibuat sementara saat OCR lalu dihapus; folder data (`chroma/`, `chunks/`, `data/`, `docs/`, `ocr_text/`, `uploads/`) masuk `.gitignore`.

## Konfigurasi Environment

Backend — buat `backend/.env` dari `.env.example`:

```bash
# OpenRouter (model gratis, fallback)
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=cohere/north-mini-code:free

# Google AI Studio (Gemini Flash gratis, opsional — utama bila diisi)
# Ambil key di https://aistudio.google.com/apikey
GEMINI_API_KEY=

# Server
PORT=3001

# ChromaDB
CHROMA_URL=http://localhost:8000

# Auth JWT (wajib string acak panjang, server menolak start bila kosong)
JWT_SECRET=ganti-dengan-secret-acak-panjang

# Password admin default pertama (min. 6 karakter)
DEFAULT_ADMIN_PASSWORD=ganti-password-admin

# Origin yang boleh akses API (dipisah koma)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Folder data (opsional)
DOCS_PATH=./docs
UPLOADS_PATH=./uploads
DATA_PATH=./data
OCR_PATH=./ocr_text
CHUNKS_PATH=./chunks
```

Saat `data/users.json` masih kosong, server membuat user `admin` otomatis dengan password dari `DEFAULT_ADMIN_PASSWORD` pada start pertama.

Frontend — `frontend/.env` (opsional):

```bash
# Target backend untuk proxy dev (default: http://localhost:3001)
VITE_API_TARGET=http://localhost:3001
```

## Cara Menjalankan

Urutan wajib: ChromaDB → Backend → Frontend. Ketiganya harus hidup bersamaan.

Terminal 1 — ChromaDB (`http://localhost:8000`):

```bash
cd backend
chroma run --path ./chroma
```

Terminal 2 — Backend (`http://localhost:3001`):

```bash
cd backend
npm install --legacy-peer-deps
npm start
```

Flag `--legacy-peer-deps` wajib (tanpa itu instalasi gagal karena konflik peer dependency). Tiap mengubah `llmService.js`/`.env`, restart manual (`npm start` tanpa watch).

Terminal 3 — Frontend (`http://localhost:5173`):

```bash
cd frontend
npm install
npm run dev
```

Request `/api` diteruskan ke backend lewat proxy Vite.

## Menggunakan CMS

1. Buka `http://localhost:5173/#/cms/login`, login (user `admin` dibuat otomatis saat start pertama).
2. Pengelola mengunggah PDF (maks. 20 MB) — status pending.
3. Admin menyetujui/menolak di tab Persetujuan. Approve bersifat asinkron: status `processing` (antrean latar, 1 worker) lalu `approved`/`error`.
4. File yang disetujui pindah ke `docs/` dan diproses (OCR → chunking → embedding), lalu bisa ditanya lewat chat.

## Alur Sistem

1. PDF diunggah dan disetujui admin.
2. Teks diekstrak (digital langsung, OCR bila hasil scan).
3. Teks dipecah menjadi chunk berbasis kalimat.
4. Chunk diubah menjadi embedding, disimpan di ChromaDB.
5. Pertanyaan pengguna di-embedding, dicari chunk paling relevan (vektor + BM25 + rerank).
6. Model AI menyusun jawaban dari konteks chunk beserta sitasi halaman.

## Endpoint API

| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| `POST` | `/api/auth/login` | Login (10x/15 mnt/IP) |
| `GET`  | `/api/auth/me` | Cek sesi token |
| `POST` | `/api/chat` | Tanya-jawab RAG, (`stream: true` untuk SSE) |
| `GET`  | `/api/chat/history` | Daftar sesi (per owner) |
| `GET/DELETE` | `/api/chat/history/:sessionId` | Isi/hapus sesi |
| `POST` | `/api/chat/feedback` | Rating up/down + komentar |
| `GET`  | `/api/chat/history/:sessionId/export?format=html\|doc` | Export riwayat |
| `GET`  | `/api/docs`, `/api/docs.json` | Swagger UI / OpenAPI |
| `GET`  | `/api/stats` | Statistik publik |
| `GET`  | `/api/models` | Daftar model AI yang tersedia |
| `GET`  | `/api/documents` | Daftar dokumen approved |
| `GET`  | `/api/documents/:filename` | Preview PDF dokumen approved |
| `POST` | `/api/cms/upload` | Upload PDF, maks 5 file (login) |
| `GET`  | `/api/cms/files` | Daftar file (login) |
| `GET`  | `/api/cms/files/:id/download` | Unduh file (login) |
| `POST` | `/api/cms/files/:id/approve` | Setujui dokumen (admin) |
| `POST` | `/api/cms/files/:id/reject` | Tolak dokumen (admin) |
| `DELETE` | `/api/cms/files/:id` | Hapus file (admin) |
| `GET/POST/PUT/DELETE` | `/api/cms/users` | Kelola user (admin) |
| `GET`  | `/api/cms/login-logs` | Log login (admin) |
| `GET`  | `/api/cms/stats` | Statistik admin |
| `GET`  | `/api/health` | Status server |

Chat dibatasi 20 request/menit/IP.

## Pengujian

Dari folder `backend/` (ChromaDB + backend hidup):

```
npm test                                # 14 unit test (bm25, chatHistory, chunk)
node scripts/healthCheck.mjs            # cek backend, ChromaDB, vektor (--no-chat = skip LLM)
npm run backup                          # backup chroma + files.json + users.json ke backup/<waktu>/
npm run ingest                          # ingest ulang korpus (berat, RAM 4 GB)
```

Panduan demo ada di `DEMO.md`.

## Cadangan & Pemulihan

Yang perlu dicadangkan:

| Item | Lokasi |
| ---- | ------ |
| Data ChromaDB (vektor) | `backend/chroma/` |
| Hasil chunking | `backend/chunks/` |
| Akun, status file, riwayat, log, analitik | `backend/data/` |
| Dokumen disetujui | `backend/docs/` |
| File pending | `backend/uploads/` |
| Konfigurasi rahasia | `backend/.env` (**jangan di-commit**) |
| Cache model lokal | `backend/node_modules/@xenova/transformers/.cache` (±434 MB, ikut hilang bila `node_modules` dihapus) |

Backup otomatis: `cd backend` lalu `npm run backup` (menghentikan Chroma sementara, menyalin data + manifest, verifikasi jumlah vektor, menyimpan 5 terbaru). Jalankan tiap selesai menyetujui dokumen baru.

Pemulihan dari nol: clone repo → `npm install --legacy-peer-deps` di `backend/` dan `frontend/` → kembalikan folder data + `.env` → jalankan ChromaDB → Backend → Frontend.

Catatan:

* `npm audit` backend = 0 kerentanan (`overrides` protobufjs/js-yaml/sharp + multer ≥2.4.0 + audit fix express/qs). Install ulang bila override tidak terpasang: hapus `package-lock.json` + `node_modules`, lalu `npm install --legacy-peer-deps`.
* Bila model embedding diganti, vektor lama tidak kompatibel — ingest ulang seluruh dokumen.
* Jalankan proyek di luar folder OneDrive (sinkronisasi OneDrive pernah merusak repo dengan file duplikat).

## Status Proyek

Sistem pencarian dan asisten informasi perdagangan berbasis RAG dengan CMS pengelolaan dokumen dan pengguna, dikembangkan dalam kegiatan Praktik Kerja Lapangan (PKL) Kemendag.
