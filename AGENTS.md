# Konteks Proyek PKL AI Assistant (Kemendag)

Ringkasan ini dimuat otomatis oleh opencode setiap sesi baru. Baca sebelum mengerjakan apa pun.

## Status (terakhir diperbarui 20-08-2026)

- Proyek di C:\dev\pkl-kemendag-ai-assistant (SUDAH dipindah keluar OneDrive - jangan pindahkan lagi).
- Sistem 100% sehat: ChromaDB :8000, Backend :3001, Frontend :5173. Login CMS: admin / AdminKemendag2026! (password lain ada di backend/.env - jangan commit .env).
- Git: branch main, semua commit ter-push. Riwayat UI terkini (urutan):
  - `1e86f9a` Sora->Inter + biru #004DAF
  - `d4e9c96` login selaras + toggle tema + pill saran pertanyaan berputar
  - `4b3ffe5` login garis emas + hero 26px
  - `2fc29df`/`0e8745a` garis emas kartu login -> inset shadow (ikuti kurva)
  - `67b0507` Inter dimuat beneran (Google Fonts + body base font)
  - `de5db82` DESIGN SYSTEM: theme.js + font Plus Jakarta Sans/Source Sans 3
  - `c79e6e4` tombol aksi utama biru solid #004DAF radius 12
  - `0fc8954` logo login: hover samakan dengan chat (scale 1.08 via .logo-hover), shadow biru tipis kedua mode
  - `21d15d5` kontras bg vs kartu di chat = login: padding luar 28px + maxWidth 1000px
  - `9d13fd6` bg light dipertajam #e2e9f3->#eef2f7 (supaya kartu putih kontras)
  - `ce3771e` aurora & typewriter DIHAPUS (kesan non-AI), bg light #dce4f0->#e9eef6, bg dark #070b14, kartu login #f2f4f9/#263956
  - `3d3a505` kartu login digelapkan lagi: light #e8ebf3, dark #22304e
  - `fe9060d` SEMUA emoticon/glyph -> icon SVG inline (jam, cpu, check, chevron-down, dot, external-link, bintang); CMS font dasar FONT_BODY + sidebar gradient #001845->#004DAF
- npm audit backend = 0 vuln (overrides protobufjs 7.6.5, js-yaml 4.3.1, sharp@0.32.6->0.35.3). npm install backend WAJIB --legacy-peer-deps.
- Approve dokumen ASINKRON: POST approve -> status "processing" (antrean latar belakang ingestQueue.js, 1 worker FIFO) -> "approved"/"error". Frontend polling 5 dtk saat ada "processing". Jangan harap langsung "approved".
- Embedding ingest memakai BATCH (EMBED_BATCH=16 di ingest.js, createEmbeddingsBatch di embedderService.js — menangani semua bentuk output transform.js). Rerank width = 10 (retrieverService.js).
- CHAT BARU (fase-2): riwayat multi-turn via sessionId (disimpan data/chats.json, owner = user:<id> bila token Bearer, client:<id> bila clientId, else guest). Endpoint: POST /api/chat (body sessionId/clientId), GET /api/chat/history, GET|DELETE /api/chat/history/:sessionId, POST /api/chat/feedback (rating up/down + komentar), GET /api/chat/history/:sessionId/export?format=html|doc. Konteks 6 pesan terakhir dikirim ke LLM. Field sesi = `id` (bukan sessionId); cleanup via DELETE per id.
- RETRIEVAL hybrid: BM25 (bm25Service.js, korpus dari chunks/*.json, cache mtime) di-union dengan kandidat vektor (BM25_WIDTH=60, BM25_BONUS=0.3) sebelum rerank. Perilaku vektor lama tidak berubah.
- Dokumentasi API: GET /api/docs (Swagger UI), GET /api/docs.json (OpenAPI). Statistik: GET /api/stats (publik), GET /api/cms/stats (admin).
- Tes CMS E2E: 28 PASS / 0 FAIL (node scripts/testCmsFullLifecycle.mjs).
- Tes dokumen BARU end-to-end: 11 PASS / 0 FAIL (node scripts/testNewDocE2E.mjs).
- Unit test service inti: 14 PASS / 0 FAIL (npm test = node --test "tests/*.test.mjs").
- Evaluasi RAG: 14 PASS / 0 FAIL (node scripts/evalRag.mjs: recall@7 = 7/7; --no-llm utk retrieval saja).
- Tes UI browser (Playwright, frontend/): npx playwright test = 5 PASS (chat hero+streaming, CMS upload->approve->delete, feedback, export HTML/DOC — self-cleaning). Jalankan background: Start-Process cmd /c "npx playwright test --reporter=line --timeout=300000 > log 2>&1", poll ~130 dtk. Jebakan: GET /api/chat/history TANPA clientId/token hanya menampilkan owner "guest".
- Cek kesehatan cepat: node scripts/healthCheck.mjs (5 PASS; --no-chat untuk skip LLM).
- Runbook ultra-ringkas: RUNBOOK.md.
- Backup: npm run backup -> backup/<waktu>/ (git-ignored, chroma/ + files.json + users.json + manifest); simpan 5 terbaru. Jalankan tiap dokumen baru di-approve.
- Rate-limit: login 10x/15mnt/IP, chat 20/mnt/IP -> 429.

## DESAIN UI (FINAL — pakai ini, JANGAN kembali ke desain lama)

**Satu-satunya sumber warna & font = `frontend/src/theme.js`** (`createTheme(dark)` + `COLORS` + `FONT_HEADING` + `FONT_BODY`). Ketiga halaman (ChatPage, LoginPage, CmsPage) memakai `const t = createTheme(dark)`. Kalau mau ubah warna, ubah theme.js saja. Tambahan token: `dark` (dipakai CmsPage sbg t.dark), `accentText`/`accent`/`cardBorder` alias.

### PALET WARNA (final)
- Biru resmi #004DAF (aksen utama, tombol aksi, border fokus input); hover #003d94 (COLORS.blueDark)
- Biru muda dark-mode #7fb1e8 (accentText/accent, border fokus input dark, border item sidebar aktif)
- Hijau resmi #16a75c — HANYA untuk status (Terhubung, badge Tersimpan, feedback up, badge approved CMS)
- Navy #13182B (referensi) — praktis: header/teks; bg dark #0a101e
- Emas #e9a319 / #f6c453 — identitas + INTERAKSI FOKUS: garis header inset rgba(233,163,25,0.55), divider hero, toggle tema (knob #78350f), chip Panel Admin (teks #0b1e3a), avatar bubble user, borderRight bubble user 4px solid #e9a319, garis atas kartu login (inset shadow), tombol KIRIM & tombol aksi emas, ring fokus input & kotak cari `0 0 0 3px rgba(233,163,25,0.15)` (border fokus tetap biru #004DAF/#7fb1e8 seperti login), hover pill saran pertanyaan emas
- Background light: linear-gradient(180deg,#d9e2f0,#edf2f8); dark: #0a101e
- Kartu: #f6f8fd / #2a3d63; cardSoft #f8fafc / #304266; border #c9d4e3 / #26324d; borderSoft #e4eaf2 / #2b3a58; inputBg #eef3f9 / #0f1a2f
- Teks: #1e293b / #e5edf7; textSoft #475569 / #c3cede; textMute #5b6b82 / #8b98ad
- Bubble bot #e6ebf2 / #223254; bubble user #a5c9f2 / #0e5c9e; chatBg = t.card (#f6f8fd / #2a3d63)
- Sidebar #eef2f7 / #0f182c; bar #ffffff / #1b2944; bgSoft #eaf0f7 / #3a4b6b
  - REVISI (sesi 20-08-2026): kartu riwayat = putih + border #c9d4e3 + shadow 0 2px 6px (dark: #223254 + border #3a4b6b), hover #f8fafc (light) / #3a4b6b (dark), aktif #eef6fd + border #004DAF + glow (dark #2a3d63 + border #7fb1e8); HEADER SIDEBAR ikut header utama (bukan gradient navy); item dropdown model/role = #f8fafc idle (dark #1b2740) + hover #f1f5f9 (dark #24345a), aktif #eef6fd; kotak cari = .textbox-pill emas

### TEMPLATE FONT (final — BUKAN Inter/PJS lagi)
- Heading/judul (hero h2, judul sidebar, h2 login "Panel Admin", h3 CMS, statistik): **Sora** weight 700 (600 utk yg lebih kecil) — `FONT_HEADING`
- Isi/deskripsi/input/tombol: **Source Sans 3** weight 400/500/600 — `FONT_BODY`
- Dimuat via Google Fonts di index.html (Sora 600;700;800 + Source Sans 3 400;500;600) + `body { font-family: "Source Sans 3"... }` di App.css
- PELAJARAN: urutannya Sora->Inter->PJS+SS3->sans-serif generik->Sora heading + SS3 body. User memutuskan Sora HANYA utk judul besar (≥15px); dipakai di ukuran kecil terlihat janggal. Judul "Panel Admin" login ikut t.accentText (putih dark / biru light) biar konsisten dgn hero chat. Ketebalan heading 700 (bukan 800 — terlalu tebal).

### TOMBOL (seragam, commit c79e6e4)
- Tombol aksi utama (teks): **biru solid #004DAF, radius 12px**, teks putih, hover #003d94, shadow rgba(0,77,175,0.35). Berlaku: Login, kirim chat, Unduh, Upload CMS, primaryBtn, smallBtn CMS, modal Batal/confirm
- Tombol ikon-only (kirim di pill, stop): bulat (radius 50%/999)
- Ghost/outline (Kembali ke Chat, Mulai ulang, Percakapan Baru): radius 12, outline biru/putus-putus
- TIDAK ada gradient navy pada tombol lagi. Header/sidebar/topbar gradient #001845->#004DAF TETAP (bukan tombol). Emas (Panel Admin, toggle) & hijau (Terima) = warna fungsi, tetap.
- BOX INPUT MENYALA BIRU (commit 175ee44): hero pill & input chat bawah = border #004DAF (dark #3f6db8) + glow ring rgba(0,77,175,0.12) 4px + shadow biru (dark rgba(79,127,212,0.16)); fokus makin kuat. Input CMS: ring fokus biru via kelas `.cms-input:focus-visible` (dark border #7fb1e8).

### ELEMEN LAIN (final)
- Header chat: gradient + inset garis emas; logo putih; toggle tema emas; chip Panel Admin emas; status badge hijau. Tombol riwayat = icon-only 40px (IconMenu) kiri-atas area chat (zIndex 12, top 116px desktop / 90px mobile). Scrollbar seragam .thin-scroll. Label "Enter untuk kirim" TIDAK ada.
- Hero: logo berwarna mixBlend multiply (light) / putih (dark) + drop-shadow rgba(0,77,175,0.18); judul Inter->PJS 26px (mobile 21px) weight 800; tanggal 12.5px 600 textSoft; divider emas 56x3; subtitle STATIS "Asisten informasi perdagangan — jawaban bersumber dari dokumen resmi Kementerian Perdagangan." (typewriter DIHAPUS); divider tipis #c7d2fe; TANPA aurora blob (dihapus, kesan non-AI); shadow kartu 0 18px 50px rgba(15,40,80,0.14) (dark: 0 20px 60px rgba(0,0,0,0.5))
- PILL SARAN PERTANYAAN (TAMBAHAN): 1 pill di ATAS kotak input hero (bukan 3 chip statis di bawah!), berisi 1 pertanyaan contoh yang berotasi tiap 2.6 dtk (key=suggestionIdx + animasi rise), ikon IconSearchModule, click langsung sendMessage(q), disabled saat loading, tersembunyi saat modelOpen. Pertanyaan = dari isi dokumen (tidak boleh mengarang): "Bagaimana tahapan mendirikan restoran di Jepang?" (Jepang_Data_Restoran), "Siapa pemasok terbesar kain Ankara ke Nigeria?" (Nigeria_Martel, jawab: Tiongkok), "Apa saja persyaratan impor decoration lights ke Nigeria?" (ND208)
- Login: bg/palet SAMA dgn chat; kartu radius 20 + garis emas = inset shadow 0 3px 0 rgba(233,163,25,0.55) (JANGAN pakai div overlay — tidak sinkron dgn kurva); kartu login: light #e8ebf3 / dark #22304e (override lokal di LoginPage, bukan token); toggle tema bulat kanan-atas (set localStorage cms_theme); logo drop-shadow; input font FONT_BODY (form field TIDAK inherit font browser)
- CMS: sidebar gradient #001845->#004DAF, topbar mobile gradient; root CMS fontFamily = FONT_BODY (isi Source Sans 3, heading PJS via kelas); tab/statistik emas; approved hijau; animasi sama (rise/pop-in/shake/spin/auroraDrift/pulseDot di App.css)
- Footer kartu chat (desktop): disclaimer "Jawaban bersumber dari dokumen..." + nama app — SUDAH ADA, jangan tambah footer kredit duplikat.
- TIDAK ADA EMOTICON/GLYPH di UI (commit fe9060d): semua karakter simbol (⏰ ⌬ ✓ ▼ ● ↗ ✦ dll) diganti icon SVG inline (lucide): jam login = clock, badge model = cpu, Aktif = check, dropdown = chevron-down, mengetik = dot CSS (span bulat), Buka tab = external-link, bintang hero = path bintang 4-sudut. Verifikasi: scan code units 1f000+, 2600-27bf, 2190-21ff, 2300-23ff, 25a0-25ff, 2b00-2bff.

### KEPUTUSAN USER YANG SUDAH DIKONFIRMASI (JANGAN ulang/diubah tanpa diminta)
- TOLAK restyle "resmi kemendag" solid (header flat #004DAF, hijau ganti emas, teks identitas, aurora tipis, shadow flat). TETAP: gradient + emas + shadow besar. Aurora DIHAPUS sama sekali (kesan non-AI) — lihat keputusan terbaru di bawah.
- Emas dipilih (bukan teal/hijau) utk toggle, chip, bubble user, borderRight bubble user.
- Kontras bg light = gradient #dce4f0->#e9eef6; dark = #070b14 (bg gelap gelapkan, kartu agak gelap) — nilai final, jangan balik ke #e9edf4/#0b1120.
- Aurora & typewriter DIHAPUS (19-08-2026): user minta UI tidak terlihat buatan AI; subtitle hero jadi teks statis. Indikator "mengetik" (dot + teks) & streaming chat DIPERTAHANKAN (standar UX, bukan kesan AI).
- Font: user minta BUKAN Inter; keputusan: PJS + SS3 (dokumentasikan di sini).
- Tombol: biru solid radius 12 (opsi 1 yang disarankan, disetujui).
- Pill saran: bentuknya pill berputar di ATAS input (bukan chip di bawah) — revisi user.
- Hero 26px + tanggal tegas: disetujui. Footer kredit: sudah ada.
- Model opencode = big-pickle (deepseek-v4-flash-free SUDAH DIHAPUS dari daftar model Zen per 22-08-2026; default di-set permanen di ~/.config/opencode/opencode.jsonc): TIDAK BISA membaca gambar (screenshot). Kalau user minta evaluasi visual, minta user lihat sendiri atau pakai verifikasi DOM/computed style.

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