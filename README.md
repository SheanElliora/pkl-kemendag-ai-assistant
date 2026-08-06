# PKL Kemendag AI Assistant

Sistem **Retrieval-Augmented Generation (RAG)** untuk membantu pencarian dan tanya jawab dokumen perdagangan berdasarkan dokumen resmi.

---

## Teknologi yang Digunakan

### Backend

* Node.js
* Express.js
* ChromaDB
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

## Struktur Proyek

```
backend/    → API dan pipeline RAG
frontend/   → antarmuka pengguna React
docs/       → dokumentasi dan aset proyek
```

---

## Cara Menjalankan

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di **http://localhost:5173**.

---

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
