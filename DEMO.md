# Panduan Demo — PKL Kemendag AI Assistant

Langkah terurut untuk menjalankan dan mendemokan sistem RAG + CMS.

## A. Persiapan

Buka VS Code lalu buat **3 terminal terpisah** (menu Terminal > New Terminal, atau `Ctrl + `` lalu ikon +).

Lokasi proyek:

```
C:\dev\pkl-kemendag-ai-assistant
```

## B. Terminal 1 — ChromaDB

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"
chroma run --path ./chroma
```

Tunggu sampai muncul *Running on http://localhost:8000*. **Jangan tutup terminal ini.**

## C. Terminal 2 — Backend

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"
npm start
```

Tunggu sampai warmup model selesai:

```
Backend berjalan di http://localhost:3001
```

Cek cepat di browser: `http://localhost:3001/api/health` — harus `{"status":"OK"}`.

**Jangan tutup terminal ini.**

## D. Terminal 3 — Frontend

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\frontend"
npm run dev
```

Tunggu sampai muncul *ready in ... ms* dan alamat `http://localhost:5173`.

**Jangan tutup terminal ini.**

## E. Uji Chat RAG (di browser)

1. Buka `http://localhost:5173`
2. Ketik pertanyaan yang jawabannya ada di dokumen, contoh:
   - *"Siapa pemasok terbesar kain Ankara ke Nigeria?"*
   - *"Bagaimana tahapan mendirikan restoran di Jepang?"*
3. Klik kirim — tunggu jawaban + **Sumber Referensi** di bawahnya.
4. Coba sapaan (`halo`, `siapa kamu`) — dijawab langsung tanpa sumber.
5. Uji ganti model di dropdown, kirim pertanyaan yang sama.

## F. Uji CMS (login + persetujuan dokumen)

1. Buka `http://localhost:5173/#/cms/login`
2. Login dengan Username `admin`, Password = nilai `DEFAULT_ADMIN_PASSWORD` di `backend/.env`
3. Tunjukkan tab **Kelola User** dan **Riwayat Aktivitas**.

### Alur lengkap (opsional)

1. Di tab **Kelola User**, buat user peran Pengelola.
2. Keluar, login sebagai pengelola, buka tab upload, unggah **PDF valid** (maks. 20 MB).
3. Keluar, login lagi sebagai `admin`.
4. Buka tab **Persetujuan** — file tampil di antrian, klik **Terima**.
5. Status jadi `processing` lalu `approved`; dokumen otomatis diproses (OCR → chunking → embedding) dan bisa ditanya lewat chat.

## G. Aturan Demo

1. Urutan start wajib: ChromaDB → Backend → Frontend.
2. Jangan tutup 3 terminal selama demo.
3. Jangan tampilkan `backend/.env` di layar (API key & password).
4. Bila CMS menampilkan *"Token tidak valid"* setelah server restart — logout dan login ulang.
5. Siapkan 2–3 pertanyaan yang jawabannya ada di dokumen agar sitasi tampil jelas.
6. Upload hanya PDF valid. PDF rusak bisa berstatus `error` di CMS.

## H. Troubleshooting

| Gejala | Solusi |
| ------ | ------ |
| `http://localhost:8000` tidak terbuka | ChromaDB belum start / port dipakai — jalankan ulang Terminal 1 |
| `Backend berjalan` tidak muncul | Cek `.env` (JWT_SECRET wajib terisi) — jalankan `npm start` ulang |
| Halaman 5173 tidak terbuka | Pastikan Terminal 2 dan 3 hidup, urutan start benar |
| Login tetap gagal | Password salah — samakan `DEFAULT_ADMIN_PASSWORD` di `.env`, hapus `backend/data/users.json`, restart backend |
| Upload berstatus `error` | PDF tidak valid — coba PDF lain |
