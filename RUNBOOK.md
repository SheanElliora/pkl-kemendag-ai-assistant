# RUNBOOK - PKL Kemendag AI Assistant (versi ultra-ringkas)

Lengkap: `DEMO.md` | Recovery: `README.md > Cadangan & Pemulihan`

## 1. Start (3 terminal, urutan wajib)

```powershell
# Terminal 1
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; chroma run --path ./chroma

# Terminal 2
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; npm start

# Terminal 3
cd "C:\dev\pkl-kemendag-ai-assistant\frontend"; npm run dev
```

Tunggu: Chroma "Running on http://localhost:8000" -> backend "listening" -> Vite.

## 2. Cek kesehatan (5 PASS)

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; node scripts/healthCheck.mjs
# --no-chat untuk skip LLM. 631 vektor = 8 dokumen approved.
```

## 3. Tes E2E (semua aman dijalankan ulang, self-cleaning)

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend";  node scripts/testCmsFullLifecycle.mjs   # 27 tes API CMS
cd "C:\dev\pkl-kemendag-ai-assistant\frontend"; npx playwright test                     # 3 tes browser UI
```

## 4. Backup (tiap selesai approve dokumen baru)

```powershell
cd "C:\dev\pkl-kemendag-ai-assistant\backend"; npm run backup   # -> backup/<waktu>/, simpan 5 terbaru
```

## 5. Kredensial

- CMS: `admin` / `AdminKemendag2026!`
- Password lain & JWT_SECRET: `backend/.env` (JANGAN commit)

## 6. Jebakan (jangan diulang)

| Jebakan | Solusi |
|---|---|
| `npm install` backend error peer deps | WAJIB `npm install --legacy-peer-deps` |
| Chroma API `/api/v1` -> 410, `/count` -> 400 | Pakai API v2 `/api/v2/tenants/default_tenant/databases/default_database/collections` |
| Chroma bind `[::1]` (IPv6) -> `127.0.0.1:8000` gagal | Pakai `localhost:8000` (healthCheck sudah benar) |
| `curl` JSON inline di PowerShell -> 400 | `--data "@file"` |
| Flood `/api/chat` -> backend macet / 429 | Limit: 20/mnt/IP (login 10x/15mnt/IP) |
| Edit `files.json` dari PowerShell | JANGAN pakai `Set-Content -Encoding UTF8` (tulis BOM -> backend baca `[]` -> data tertimpa). Pakai Node/notepad biasa |
| Backup di `%TEMP%` bisa hilang | Backup permanen: `npm run backup` |
| Dua instance Chroma folder sama | 1 proses per `--path` (risiko korup SQLite) |
| `node_modules` dihapus | Cache embedding 434 MB ikut hilang (unduh ulang otomatis) |
| Dua proses di port 3001/8000 | `EADDRINUSE` -> matikan proses lama dulu |

## 7. Status harapan

- `GET /api/health` -> 200 OK
- `GET /api/documents` -> 8 file approved
- Chroma: collection `sip_documents` (id `0b182325-...`), 631 vektor
- `npm audit` backend: 0 vuln