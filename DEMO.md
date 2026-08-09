# Panduan Demo — PKL Kemendag AI Assistant

Panduan terurut untuk menjalankan dan mendemokan sistem RAG + CMS.

---

## A. Persiapan (setelah PC di-restart)

Buka VS Code lalu buat **3 terminal terpisah**:
Menu **Terminal → New Terminal** (atau `Ctrl + \`` lalu ikon **+**).

Lokasi proyek:

```
C:\Users\shean\OneDrive\Documents\PKL-Kemendag\Machine Learning - Copy\Machine Learning
```

---

## B. Terminal 1 — Jalankan ChromaDB

```powershell
cd "C:\Users\shean\OneDrive\Documents\PKL-Kemendag\Machine Learning - Copy\Machine Learning\backend"
chroma run --path ./chroma
```

Tunggu sampai muncul *Running on http://localhost:8000*.

**Jangan tutup terminal ini.**

---

## C. Terminal 2 — Jalankan Backend

```powershell
cd "C:\Users\shean\OneDrive\Documents\PKL-Kemendag\Machine Learning - Copy\Machine Learning\backend"
npm start
```

Tunggu sampai muncul:

```
Backend berjalan di http://localhost:3001
```

Cek cepat di browser: `http://localhost:3001/api/health`
Harus muncul: `{"status":"OK"}`

**Jangan tutup terminal ini.**

---

## D. Terminal 3 — Jalankan Frontend

```powershell
cd "C:\Users\shean\OneDrive\Documents\PKL-Kemendag\Machine Learning - Copy\Machine Learning\frontend"
npm run dev
```

Tunggu sampai muncul *ready in ... ms* dan alamat `http://localhost:5173`.

**Jangan tutup terminal ini.**

---

## E. Uji Chat RAG (buka di browser)

1. Buka `http://localhost:5173`
2. Ketik pertanyaan, contoh:
   - *"Apa saja persyaratan ekspor tekstil ke Nigeria?"*
   - *"Aturan apa saja yang berlaku untuk impor dari Jepang?"*
3. Klik kirim → tunggu jawaban + label **sumber dokumen** di bawahnya.
4. **Uji ganti model**: pilih model lain di dropdown (mis. GPT-4o mini), kirim pertanyaan yang sama.

---

## F. Uji CMS (login + persetujuan dokumen)

1. Buka `http://localhost:5173/#/cms/login`
2. Login dengan:
   - Username: `admin`
   - Password: nilai `DEFAULT_ADMIN_PASSWORD` di `backend/.env`
3. Setelah masuk, tunjukkan tab **👥 Kelola User** dan **📜 Log Aktivitas** (bukti fitur admin).

### Demo alur lengkap (opsional, paling meyakinkan)

1. Di tab **👥 Kelola User**, buat user dengan role **Maintainer**.
2. Klik **Keluar** di pojok kanan atas.
3. Login sebagai maintainer tadi, buka tab **📤 Upload Dokumen**, unggah **PDF valid** (maks. 20 MB).
4. Klik **Keluar**, login kembali sebagai `admin`.
5. Buka tab **✅ Persetujuan** → file yang Anda upload tampil di *Menunggu Persetujuan* → klik **✔ Terima**.
6. Dokumen diproses otomatis (OCR → chunking → embedding) dan bisa digunakan chatbot.

---

## G. Aturan Penting

1. **Urutan start wajib**: ChromaDB → Backend → Frontend.
2. **Jangan tutup 3 terminal** selama demo.
3. **Jangan tampilkan `backend/.env` di layar** — berisi rahasia (API key & password admin).
4. Bila CMS menampilkan *"Token tidak valid"* setelah server restart → logout & login ulang.
5. Siapkan 2–3 pertanyaan yang jawabannya ada di dokumen agar RAG menunjuk sumber dengan jelas.
6. Gunakan **PDF valid** saat demo upload. PDF rusak/uji bisa memicu status `error` di CMS.

---

## H. Troubleshooting Singkat

| Gejala | Solusi |
| ------ | ------ |
| `http://localhost:8000` tidak terbuka | ChromaDB belum start / port dipakai → jalankan ulang Terminal 1 |
| `Backend berjalan` tidak muncul | Cek `.env` (JWT_SECRET harus terisi) → jalankan `npm start` ulang |
| Halaman 5173 tidak terbuka | Pastikan Terminal 2 & 3 hidup, urutan start benar |
| Login tetap gagal | Password salah → ganti `DEFAULT_ADMIN_PASSWORD` di `.env`, hapus `backend/data/users.json`, restart backend |
| Upload muncul status `error` | PDF tidak valid → upload PDF lain yang benar |