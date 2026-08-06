# PKL Kemendag AI Assistant

Sistem **Retrieval-Augmented Generation (RAG)** untuk membantu pencarian dan tanya jawab dokumen perdagangan berdasarkan dokumen resmi.

---

Fitur Utama
Upload dan pengelolaan dokumen PDF regulasi perdagangan
OCR dan ekstraksi teks dari dokumen PDF
Chunking dokumen untuk proses retrieval
Penyimpanan embedding pada ChromaDB
Pencarian konteks dokumen menggunakan RAG
Antarmuka chatbot berbasis React + Vite
Backend API menggunakan Node.js + Express

---

## Teknologi yang Digunakan

### Backend

* Node.js
* Express.js
* ChromaDB
* OpenRouter API
* OCR Text Processing
* PDF Parsing

### Frontend

* React.js
* Vite

### Pendekatan AI

* Retrieval-Augmented Generation (RAG)
* Text Chunking
* Embedding Vector
* Semantic Retrieval

---

Struktur Proyek
pkl-kemendag-ai-assistant/
├── backend/
│   ├── docs/
│   ├── chunks/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── utils/
│   ├── index.js
│   ├── ingest.js
│   └── package.json
├── frontend/
├── docs/
├── .gitignore
└── README.md

---

Konfigurasi Environment

Buat file .env di dalam folder backend/ berdasarkan .env.example.

Contoh konfigurasi:

OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=openai/gpt-4o-mini
PORT=3001
CHROMA_URL=http://localhost:8000
DOCS_PATH=./docs

---

## Cara Menjalankan

### 1. Jalankan ChromaDB

Buka terminal pertama:

```bash
cd backend
chroma run --path ./chroma
```

ChromaDB akan berjalan pada:

```
http://localhost:8000
```

---

### 2. Jalankan Backend

Buka terminal kedua:

```bash
cd backend
npm install
npm start
```

Backend berjalan pada:

```
http://localhost:3001
```

---

### 3. Jalankan Frontend

Buka terminal ketiga:

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan pada:

```
http://localhost:5173
```

---

### Urutan Menjalankan Sistem

1. **ChromaDB**
2. **Backend**
3. **Frontend**

Ketiga proses tersebut harus berjalan secara bersamaan agar fitur **Retrieval-Augmented Generation (RAG)** dapat digunakan dengan normal.


## Alur Sistem

1. Dokumen PDF diproses menggunakan OCR.
2. Teks dipecah menjadi beberapa chunk.
3. Chunk diubah menjadi embedding vector.
4. Embedding disimpan di ChromaDB.
5. Pertanyaan pengguna dicocokkan dengan chunk yang paling relevan.
6. Sistem menghasilkan jawaban berdasarkan konteks dokumen.

---

## Status Proyek

Proyek ini dikembangkan sebagai **sistem pencarian dan asisten informasi perdagangan berbasis RAG** dalam kegiatan **Praktik Kerja Lapangan (PKL) Kemendag**.
