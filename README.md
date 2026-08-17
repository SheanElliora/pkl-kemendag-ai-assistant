# PKL Kemendag AI Assistant

Sistem **Retrieval-Augmented Generation (RAG)** untuk membantu pencarian dan tanya jawab dokumen perdagangan bagian Kementerian Perdagangan (Kemendag), dilengkapi **CMS (Content Management System)** untuk mengelola dokumen dan pengguna.

---

## Fitur Utama

* Chatbot tanya-jawab berbasis RAG atas dokumen regulasi/perdagangan resmi.
* **Pilihan model AI** di antarmuka chat (Gemini, GPT-4o, Llama, Claude) — satu API key OpenRouter.
* **CMS Knowledge Management** dengan autentikasi **JWT** dan dua peran:
  * **Admin** — menyetujui/menolak dokumen, mengelola pengguna, melihat log login.
  * **Maintainer** — mengunggah dokumen dan melihat status dokumennya.
* Alur upload dokumen: **pending → approved/ditolak**. Dokumen baru baru diproses (OCR → chunking → embedding) setelah disetujui admin.
* OCR, chunking, dan embedding otomatis saat dokumen disetujui.
* Penyimpanan embedding pada ChromaDB.
* **Sitasi nomor halaman tercetak**: jawaban disertai nomor halaman yang benar-benar tercetak pada dokumen (bukan nomor chunk retrieval). Bila tidak terdeteksi, memakai indeks PDF sebagai cadangan.

---

## Teknologi yang Digunakan

### Backend

* Node.js + Express.js
* ChromaDB
* OpenRouter API (multi-model)
* OCR (Tesseract CLI via `pdftoppm`)
* PDF Parsing (pdf-parse, pdf-poppler)
* Autentikasi JWT + bcrypt + rate-limit login (express-rate-limit)
* Upload file (multer)

### Frontend

* React.js + Vite
* React Router (HashRouter)
* react-markdown

### Model AI

* **Chat (OpenRouter, multi-model)**: Gemini 2.5 Flash/Pro, GPT-4o/mini, Llama 3.1, Claude 3.5 Sonnet (satu API key).
* **Embedding lokal** (`Xenova/multilingual-e5-small`): retrieval lintas bahasa (Indonesia ↔ Inggris) dengan prefix `query:`/`passage:`.
* **Reranker lokal** (`Xenova/bge-reranker-base`): cross-encoder multibahasa yang menilai ulang kandidat (query, chunk) secara bersamaan setelah pencarian awal. (Percobaan awal memakai `ms-marco-MiniLM-L-6-v2`, tetapi memberi skor ~0 untuk query Indonesia sehingga tidak membedakan dokumen.)

### Pendekatan AI

* Retrieval-Augmented Generation (RAG)
* Text Chunking berbasis kalimat (chunk selalu berawal/berakhir di batas kalimat)
* Embedding Vector
* Semantic Retrieval + Hybrid Ranking (embedding + kata kunci + rerank cross-encoder)

---

## Struktur Proyek

```
pkl-kemendag-ai-assistant/
├── backend/
│   ├── docs/               # dokumen sumber (diproses saat ingest)
│   ├── uploads/            # file pending hasil upload CMS (belum disetujui)
│   ├── data/               # data JSON akun & riwayat (users.json, files.json)
│   ├── ocr_text/           # hasil OCR sementara
│   ├── chunks/             # hasil chunking sementara
│   ├── chroma/             # data penyimpanan ChromaDB
│   ├── routes/             # auth.js, cms.js, chat.js
│   ├── services/           # rag, retriever, ocr, user, file, auth, dll.
│   ├── scripts/            # alat bantu (resetChroma, checkChroma, dll.)
│   ├── utils/              # authMiddleware (acak-token)
│   ├── config.js           # satu sumber konfigurasi folder & batas upload
│   ├── ingest.js           # OCR → chunking → embedding
│   ├── index.js            # entrypoint server API
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/          # ChatPage, LoginPage, CmsPage
│   │   ├── api.js          # klien API + penyimpanan sesi
│   │   ├── App.jsx         # routing (HashRouter)
│   │   └── vite.config.js  # proxy /api → backend
│   └── package.json
├── .gitignore
└── README.md
```

---

## Konfigurasi Environment

### Backend

Buat file `.env` di dalam folder `backend/` berdasarkan `.env.example`:

```bash
# OpenRouter
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=google/gemini-2.5-flash

# Server
PORT=3001

# ChromaDB
CHROMA_URL=http://localhost:8000

# Auth JWT (WAJIB string acak panjang — server menolak start bila kosong)
JWT_SECRET=ganti-dengan-secret-acak-panjang

# Password admin default pertama (min. 6 karakter)
DEFAULT_ADMIN_PASSWORD=ganti-password-admin

# Origin yang boleh akses API (dipisah koma)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Folder data (opsional, sudah sesuai struktur proyek)
DOCS_PATH=./docs
UPLOADS_PATH=./uploads
DATA_PATH=./data
OCR_PATH=./ocr_text
CHUNKS_PATH=./chunks
```

> **Admin default:** saat `data/users.json` masih kosong, server membuat user `admin` otomatis dengan password dari `DEFAULT_ADMIN_PASSWORD` saat pertama kali dijalankan.

### Frontend

Buat file `.env` di folder `frontend/` berdasarkan `.env.example` (opsional):

```bash
# Target backend untuk proxy dev (default: http://localhost:3001)
VITE_API_TARGET=http://localhost:3001
```

---

## Cara Menjalankan

### 1. Jalankan ChromaDB

Buka terminal pertama:

```bash
cd backend
chroma run --path ./chroma
```

ChromaDB berjalan pada `http://localhost:8000`.

### 2. Jalankan Backend

Buka terminal kedua:

```bash
cd backend
npm install --legacy-peer-deps
npm start
```

> **Catatan:** flag `--legacy-peer-deps` wajib — ada konflik peer antara `@langchain/community` → `stagehand` (pustaka browser otomasi yang tidak terpakai) dengan `dotenv@^17`. Tanpa flag, instalasi gagal.

Backend berjalan pada `http://localhost:3001`.

### 3. Jalankan Frontend

Buka terminal ketiga:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev berjalan pada `http://localhost:5173` dan meneruskan request `/api` ke backend melalui Vite proxy.

### Urutan Menjalankan Sistem

1. **ChromaDB**
2. **Backend**
3. **Frontend**

Ketiga proses harus berjalan bersamaan agar fitur RAG dapat digunakan.

---

## Menggunakan CMS

1. Buka `http://localhost:5173/#/cms/login` lalu login dengan akun (user `admin` dibuat otomatis saat pertama start server).
2. **Maintainer** mengunggah dokumen PDF (maks. 20 MB) — masuk status *pending*.
3. **Admin** menyetujui atau menolak dokumen melalui tab *Persetujuan*.
   * Disetujui → file dipindah ke `docs/` dan langsung diproses (OCR, chunking, embedding).
   * Ditolak → file dihapus (bisa dengan alasan penolakan).
4. Admin juga dapat mengelola akun user dan memantau *log aktivitas login*.

---

## Alur Sistem

1. Dokumen PDF diunggah dan disetujui admin.
2. Teks diekstrak menggunakan OCR.
3. Teks dipecah menjadi beberapa chunk.
4. Chunk diubah menjadi embedding vector.
5. Embedding disimpan di ChromaDB.
6. Pertanyaan pengguna dicocokkan dengan chunk paling relevan.
7. Model AI menghasilkan jawaban berdasarkan konteks dokumen (RAG).

---

## Endpoint API

| Method | Endpoint | Keterangan |
| ------ | -------- | ---------- |
| `POST` | `/api/auth/login` | Login (dibatasi 10 percobaan/15 menit per IP) |
| `GET`  | `/api/auth/me` | Cek sesi token |
| `POST` | `/api/chat` | Tanya-jawab RAG (publik) |
| `GET`  | `/api/models` | Daftar model yang tersedia |
| `GET`  | `/api/health` | Status server |
| `POST` | `/api/cms/upload` | Upload PDF (login) |
| `GET`  | `/api/cms/files` | Daftar file (login) |
| `POST` | `/api/cms/files/:id/approve` | Setujui dokumen (admin) |
| `POST` | `/api/cms/files/:id/reject` | Tolak dokumen (admin) |
| `GET/POST/PUT/DELETE` | `/api/cms/users` | Kelola user (admin) |
| `GET`  | `/api/cms/login-logs` | Log aktivitas login (admin) |

---

## Alat Bantu (backend/scripts)

```
node scripts/resetChroma.js   # hapus isi database ChromaDB
node scripts/checkChroma.js    # cek jumlah data di ChromaDB
node scripts/listModels.js     # tampilkan daftar model OpenRouter
node scripts/healthCheck.mjs   # cek kesehatan: backend, frontend, ChromaDB, vektor, chat RAG (--no-chat untuk skip LLM)
node scripts/testCmsFullLifecycle.mjs  # tes E2E CMS: login, CRUD dokumen, log, dll. (27 tes, self-cleaning)
node scripts/_reindex.mjs      # bangun ulang semua vektor dari chunks (setelah ganti embedding model)
node scripts/_benchmark.mjs    # evaluasi retrieval terhadap 82 soal (dokumen/halaman/frasa)
node scripts/_updatePrintedPages.mjs  # hitung ulang nomor halaman tercetak di chunks + metadata Chroma
```

> **Penting**: bila model embedding diganti, jalankan `npm run ingest` (atau `node scripts/_reindex.mjs`) agar seluruh vektor di ChromaDB dihitung ulang dengan model baru. Vektor lama dari model lain tidak kompatibel.

---


---

## Cadangan & Pemulihan (Backup & Restore)

### Yang wajib dicadangkan

| Item | Lokasi | Keterangan |
| ---- | ------ | ---------- |
| Data ChromaDB | `backend/chroma/` | Seluruh vektor retrieval (ratusan chunk) |
| Hasil chunking | `backend/chunks/` | Teks chunk + metadata — sumber untuk re-index |
| Akun & riwayat | `backend/data/` (`users.json`, `files.json`) | User CMS + status dokumen |
| Dokumen disetujui | `backend/docs/` | Dokumen sumber yang sudah diproses |
| File pending | `backend/uploads/` | Dokumen yang belum disetujui |
| Konfigurasi rahasia | `backend/.env` | API key, JWT secret — **jangan pernah di-commit** |
| Cache model lokal | `backend/node_modules/@xenova/transformers/.cache` | ±434 MB; **ikut terhapus bila `node_modules` dihapus** → unduh ulang |

### Prosedur backup (manual)

1. Pastikan backend tidak sedang memproses dokumen (atau hentikan dulu).
2. Salin folder di tabel ke lokasi aman **di luar folder proyek** (mis. `C:\Users\<user>\Documents\backup\...`).
3. Simpan salinan `.env` secara terpisah dan rahasia.

### Prosedur pemulihan dari nol

1. `git clone` repo, lalu `npm install --legacy-peer-deps` di `backend/` dan `frontend/`.
2. Kembalikan folder `chroma`, `chunks`, `data`, `docs`, `uploads` dari backup ke posisinya.
3. Salin `.env` (nilai `JWT_SECRET` dan `DEFAULT_ADMIN_PASSWORD` **harus sama** dengan sebelumnya, dan `users.json` lama ikut dikembalikan — jika tidak, token lama hangus dan password admin kembali ke default).
4. Jalankan berurutan: ChromaDB → Backend → Frontend.

### Catatan pemeliharaan npm

* `npm audit` backend dipertahankan **0 kerentanan** lewat `overrides` di `package.json`: `protobufjs` 7.6.5, `js-yaml` 4.3.1, dan `sharp@0.32.6 → 0.35.3`.
* Bila suatu saat override tidak diterapkan (versi lama masih terpasang di `package-lock.json`), **hapus `package-lock.json` + `node_modules`** lalu install ulang dengan `--legacy-peer-deps` — `npm install`/`--force` biasa tidak menengahi.
* `sharp` di bawah `@xenova/transformers` tidak pernah di-import oleh kode (kerentanan inert), tetapi tetap di-override agar audit bersih.

### Pelajaran dari insiden

* Sinkronisasi OneDrive pernah menghasilkan file duplikat `*-DESKTOP-*` yang merusak repo; solusi: restore dari git + pola `*-DESKTOP-*` di `.gitignore`. **Disarankan menjalankan proyek di luar folder OneDrive.**

---

## Status Proyek

Dikembangkan sebagai **sistem pencarian dan asisten informasi perdagangan berbasis RAG** dengan **CMS pengelolaan dokumen dan pengguna** dalam kegiatan **Praktik Kerja Lapangan (PKL) Kemendag**.