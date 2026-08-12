import { searchDocuments } from "../services/retrieverService.js";
import fs from "fs";
import path from "path";

// Peta halaman yang benar per file (dari ekstraksi fakta)
// TIDAK dipakai; kami pakai t.file & t.page yang sudah ada.

// Normalisasi + cek frasa ada di dokumen sumber (validasi soal)
const OCR_DIR = path.resolve("ocr_text");
const docCache = {};
function getDocText(file) {
    if (!docCache[file]) {
        try {
            const txt = file.replace(/\.pdf$/i, ".txt");
            docCache[file] = fs.readFileSync(path.join(OCR_DIR, txt), "utf8").toLowerCase().replace(/[^a-z0-9]/g, "");
        } catch { docCache[file] = ""; }
    }
    return docCache[file];
}

// Format tiap soal:
//   q: pertanyaan
//   file: dokumen yang seharusnya menang
//   page: halaman yang memuat fakta
//   phrase: frasa/angka yang seharusnya muncul di jawaban (untuk cek recall)
const TESTS = [
    // ===== Jepang_Data_Game.pdf =====
    { q: "Apa game yang dirilis Taito pada tahun 1978?", file: "Jepang_Data_Game.pdf", page: 7, phrase: "Space Invaders" },
    { q: "Berapa jumlah penduduk Jepang perkiraan tahun 2024?", file: "Jepang_Data_Game.pdf", page: 11, phrase: "123.201.945" },
    { q: "Berapa tingkat inflasi Jepang tahun 2023?", file: "Jepang_Data_Game.pdf", page: 12, phrase: "3,3%" },
    { q: "Berapa peringkat pasar game Jepang di dunia?", file: "Jepang_Data_Game.pdf", page: 15, phrase: "ketiga" },
    { q: "Berapa pendapatan pasar game Jepang pada 2024?", file: "Jepang_Data_Game.pdf", page: 16, phrase: "44,41" },
    { q: "Apa ARPU pasar game Jepang tahun 2024?", file: "Jepang_Data_Game.pdf", page: 17, phrase: "1.673" },
    { q: "Game konsol apa yang paling laris di Jepang tahun 2023?", file: "Jepang_Data_Game.pdf", page: 22, phrase: "Tears of the Kingdom" },
    { q: "Siapa penerbit video game terlaris di Jepang tahun 2021?", file: "Jepang_Data_Game.pdf", page: 25, phrase: "Nintendo" },
    { q: "Berapa pasar cloud gaming Jepang tahun 2024?", file: "Jepang_Data_Game.pdf", page: 30, phrase: "13,8 miliar" },
    { q: "Berapa jumlah perusahaan game di Jepang dan lokasinya?", file: "Jepang_Data_Game.pdf", page: 34, phrase: "238" },
    { q: "Kapan sistem rating CERO mulai berlaku di Jepang?", file: "Jepang_Data_Game.pdf", page: 57, phrase: "2002" },
    { q: "Berapa harga unit game konsol di Jepang tahun 2024?", file: "Jepang_Data_Game.pdf", page: 64, phrase: "400" },
    { q: "Kapan Tokyo Game Show 2024 diselenggarakan?", file: "Jepang_Data_Game.pdf", page: 70, phrase: "26-29" },

    // ===== Jepang_Data_Restoran.pdf =====
    { q: "Berapa penjualan industri jasa makanan Jepang pada 2018?", file: "Jepang_Data_Restoran.pdf", page: 4, phrase: "274,6" },
    { q: "Berapa besar sub sektor restoran Jepang pada 2018?", file: "Jepang_Data_Restoran.pdf", page: 4, phrase: "139,8" },
    { q: "Berapa jumlah pengunjung wisatawan asing ke Jepang pada 2018?", file: "Jepang_Data_Restoran.pdf", page: 4, phrase: "31,2" },
    { q: "Berapa jumlah gerai Gyomu Super milik Kobe Bussan?", file: "Jepang_Data_Restoran.pdf", page: 6, phrase: "777" },
    { q: "Berapa proyeksi pertumbuhan pasar jasa makanan Jepang 2020-2025?", file: "Jepang_Data_Restoran.pdf", page: 7, phrase: "2,90" },
    { q: "Berapa minimum modal yang harus tersedia di bank untuk membuka restoran di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 10, phrase: "5.000.000" },
    { q: "Berapa biaya pendaftaran perusahaan KK di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 13, phrase: "150.000" },
    { q: "Berapa biaya pelatihan sanitasi makanan di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 18, phrase: "10.000" },
    { q: "Berapa lama jangka waktu lisensi restoran di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 20, phrase: "5 dan 8" },
    { q: "Berapa gaji rata-rata pelayan restoran di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 26, phrase: "166.000" },
    { q: "Berapa kisaran harga sushi-ya di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 35, phrase: "1.000 hingga 20.000" },
    { q: "Berapa kisaran harga restoran India di Jepang?", file: "Jepang_Data_Restoran.pdf", page: 44, phrase: "700" },
    { q: "Berapa jumlah warga negara Indonesia yang tinggal di Jepang hingga 2019?", file: "Jepang_Data_Restoran.pdf", page: 46, phrase: "56.346" },

    // ===== Jepang_Instrumen_Peralatan_Medis.pdf =====
    { q: "Berapa nilai pasar peralatan medis Jepang pada 2024?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 2, phrase: "32,0" },
    { q: "Berapa peringkat Jepang sebagai importir HS 901890 di dunia tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 2, phrase: "keenam" },
    { q: "Apa produk impor terbesar Jepang untuk peralatan medis?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 2, phrase: "901890021" },
    { q: "Berapa peringkat Indonesia sebagai pemasok alat medis ke Jepang tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 2, phrase: "ke-37" },
    { q: "Siapa saja pemasok utama alat medis ke Jepang?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 2, phrase: "Meksiko" },
    { q: "Berapa unit value impor alat medis dari Vietnam tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 3, phrase: "16,15" },
    { q: "Berapa peringkat sistem kesehatan Jepang di dunia tahun 2023?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 5, phrase: "kedua" },
    { q: "Berapa nilai impor HS 901890 Jepang Januari-Maret 2026?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 6, phrase: "737,4" },
    { q: "Berapa perkiraan pasar perangkat bedah minim invasif Jepang 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 10, phrase: "3,48" },
    { q: "Berapa pangsa pasar AS sebagai pemasok alat medis Jepang tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 17, phrase: "34,0" },
    { q: "Berapa nilai impor Jepang dari Indonesia untuk alat medis tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 18, phrase: "1,47" },
    { q: "Berapa nilai ekspor Indonesia HS 901890 tahun 2025?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 19, phrase: "116,78" },
    { q: "Berapa bea masuk MFN untuk HS 901890 di Jepang?", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 34, phrase: "0%" },
    { q: "Sebutkan perusahaan alat kesehatan Jepang yang dikenal secara global.", file: "Jepang_Instrumen_Peralatan_Medis.pdf", page: 39, phrase: "Terumo" },

    // ===== jurnal ai 1.pdf =====
    { q: "Apa judul jurnal yang membahas prediksi harga komoditas pertanian?", file: "jurnal ai 1.pdf", page: 1, phrase: "Agriculture Commodity Price Prediction" },
    { q: "Berapa nilai MSE yang dicapai LSTM dalam jurnal prediksi harga?", file: "jurnal ai 1.pdf", page: 1, phrase: "0.304" },
    { q: "Algoritma mana yang unggul dibanding ARIMA dalam prediksi harga komoditas?", file: "jurnal ai 1.pdf", page: 2, phrase: "LSTM" },
    { q: "Framework apa yang digunakan untuk membangun sistem prediksi harga?", file: "jurnal ai 1.pdf", page: 4, phrase: "Django" },
    { q: "Dari mana dataset prediksi harga komoditas diperoleh?", file: "jurnal ai 1.pdf", page: 5, phrase: "FAMA" },
    { q: "Komoditas apa saja yang diprediksi dalam jurnal tersebut?", file: "jurnal ai 1.pdf", page: 5, phrase: "Chicken" },
    { q: "Kernel apa yang digunakan model SVR dalam jurnal prediksi harga?", file: "jurnal ai 1.pdf", page: 6, phrase: "Radial Basis" },

    // ===== ND208 lampu dekorasi =====
    { q: "Berapa nilai impor lampu dekorasi tahun 2024?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 1, phrase: "50,1" },
    { q: "Siapa saja pemasok utama lampu dekorasi?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 1, phrase: "Turki" },
    { q: "Berapa persen volume pasar lampu dekorasi terserap pasar tradisional?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 1, phrase: "80%" },
    { q: "Berapa rentang harga eceran lampu dekorasi di Nigeria?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 2, phrase: "50.000" },
    { q: "Berapa nilai impor lampu dari Tiongkok tahun 2024?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 4, phrase: "41,4" },
    { q: "Sertifikat apa yang wajib untuk impor lampu dekorasi ke Nigeria?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 6, phrase: "SONCAP" },
    { q: "Berapa tarif VAT yang berlaku di Nigeria?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 7, phrase: "7,5" },
    { q: "Berapa kurs konversi USD ke naira yang dipakai laporan ini?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 11, phrase: "1.500" },
    { q: "Produk apa dari Indonesia yang ditemukan dijual di Star Light Ltd?", file: "ND208_Laporan Informasi Pasar_Decoration Lights_Signed_Lampiran.pdf", page: 12, phrase: "Pendant" },

    // ===== Nigeria_Martel Tekstil Kain Ankara.pdf =====
    { q: "Berapa total impor kain Ankara katun Nigeria tahun 2025?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 1, phrase: "892.407" },
    { q: "Berapa tarif impor tekstil HS 5208-5212 di Nigeria?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 6, phrase: "20%" },
    { q: "Berapa harga segmen massal kain Ankara per meter?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 7, phrase: "1,0-3,0" },
    { q: "Berapa margin importir besar untuk kain tekstil di Nigeria?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 8, phrase: "10-25%" },
    { q: "Berapa populasi Nigeria menurut estimasi PBB Januari 2025?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 17, phrase: "241.000.000" },
    { q: "Berapa inflasi headline Nigeria pada Maret 2026?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 20, phrase: "15,38" },
    { q: "Berapa nilai ekspor tekstil HS 5208-5212 Indonesia ke dunia tahun 2025?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 22, phrase: "110.265.524" },
    { q: "Berapa nilai ekspor tekstil Indonesia ke Nigeria tahun 2025?", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 23, phrase: "2.490" },
    { q: "Sebutkan syarat ekspor tekstil ke Nigeria.", file: "Nigeria_Martel Tekstil Kain Ankara.pdf", page: 23, phrase: "SONCAP" },

    // ===== PERMENDAG NOMOR 28 TAHUN 2024.pdf =====
    { q: "Apa yang diatur oleh PERMENDAG nomor 28 tahun 2024?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 1, phrase: "Sistem Informasi Perdagangan" },
    { q: "Berapa jenis personel SDM yang wajib dalam Sistem Informasi Perdagangan?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 5, phrase: "enam" },
    { q: "Berapa kategori Data Perdagangan yang diklasifikasikan?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 7, phrase: "empat" },
    { q: "Apa saja yang dimuat dalam data perdagangan luar negeri?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 8, phrase: "akses pasar" },
    { q: "Melalui apa Data disampaikan ke Kementerian Perdagangan?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 10, phrase: "Portal Satu Data" },
    { q: "Siapa yang berwenang menolak data yang tidak sesuai mekanisme?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 11, phrase: "Pusat Data" },
    { q: "Kapan PERMENDAG nomor 28 tahun 2024 ditetapkan?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 13, phrase: "30 Oktober 2024" },
    { q: "Apa arsitektur API yang diwajibkan untuk integrasi SIP?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 22, phrase: "REST API" },
    { q: "Bagaimana mekanisme hak akses masuk Sistem Informasi Perdagangan?", file: "PERMENDAG NOMOR 28 TAHUN 2024.pdf", page: 23, phrase: "Single Sign On" },

    // ===== Retrieval-Augmented Generation for JURNAL.pdf =====
    { q: "Memori apa saja yang digabungkan dalam arsitektur RAG?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 1, phrase: "parametric" },
    { q: "Pada task apa RAG menetapkan state-of-the-art?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 1, phrase: "open-domain QA" },
    { q: "Apa perbedaan antara RAG-Sequence dan RAG-Token?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 3, phrase: "Token" },
    { q: "Generator pada RAG menggunakan model apa?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 3, phrase: "BART" },
    { q: "Berapa jumlah dokumen Wikipedia yang dipakai sebagai memori non-parametrik?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 4, phrase: "21M" },
    { q: "Berapa hasil akurasi RAG pada NQ saat jawaban tidak ada di dokumen?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 6, phrase: "11.8" },
    { q: "Berapa akurasi hot-swapping index RAG untuk pemimpin dunia?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 7, phrase: "70%" },
    { q: "Berapa skor EM RAG-Sequence pada NQ?", file: "Retrieval-Augmented Generation for JURNAL.pdf", page: 19, phrase: "44.5" },
];

// ----- utilitas -----
// Normalisasi tegas: huruf kecil + buang semua tanda baca/spasi
// agar "3,3 %" == "3,3%", "1.673" == "1673", "26-29" == "2629".
function norm(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function containsPhrase(texts, phrase) {
    const target = norm(phrase);
    if (!target) return true;
    return texts.some(t => norm(t).includes(target));
}

let docHit = 0, docTop5 = 0, pageHit = 0, pageHitTol = 0, phraseInTop7 = 0;

// Untuk debugging cepat: TESTS_LIMIT=N hanya menjalankan
// N soal pertama (hemat waktu, tanpa mengedit daftar).
const TEST_LIMIT =
Number(process.env.TESTS_LIMIT) || TESTS.length;

for (const t of TESTS.slice(0, TEST_LIMIT)) {
    const result = await searchDocuments(t.q);
    const files = result.metadata.map(m => m.filename);
    // Nomor halaman yang ditampilkan = printedPage
    // (nomor tercetak) bila tersedia, kalau tidak indeks.
    const pages = result.metadata.map(m => m.printedPage ?? m.page);

    const topIsCorrect = files[0]?.toLowerCase() === t.file.toLowerCase();
    const inTop5 = files.slice(0, 5).some(f => f.toLowerCase() === t.file.toLowerCase());
    const pageIsCorrect = files[0]?.toLowerCase() === t.file.toLowerCase() && pages[0] === t.page;
    const pageIsCorrectTol = files[0]?.toLowerCase() === t.file.toLowerCase() && Math.abs(pages[0] - t.page) <= 1;
    const phraseFound = containsPhrase(result.documents, t.phrase);

    if (topIsCorrect) docHit++;
    if (inTop5) docTop5++;
    if (pageIsCorrect) pageHit++;
    if (pageIsCorrectTol) pageHitTol++;
    if (phraseFound) phraseInTop7++;

    if (!topIsCorrect || !pageIsCorrect || !phraseFound) {
        console.log(`\n[${topIsCorrect ? "OK" : "XX"}] ${t.q}`);
        console.log(`   harus: ${t.file} (hal ${t.page}) | frasa: "${t.phrase}"`);
        console.log(`   top1 : ${files[0]} (hal ${pages[0]})`);
        console.log(`   top5: ${files.slice(0, 5).join(" | ")}`);
        if (!phraseFound) {
            console.log(`   FRASA TIDAK ditemukan di 7 chunk teratas`);
        }
    }
}

const total = TESTS.slice(0, TEST_LIMIT).length;
console.log("\n" + "=".repeat(60));
console.log(`TOTAL SOAL             : ${total}`);
console.log(`DOKUMEN TOP-1 benar    : ${docHit}/${total} (${(docHit/total*100).toFixed(1)}%)`);
console.log(`DOKUMEN di top-5       : ${docTop5}/${total} (${(docTop5/total*100).toFixed(1)}%)`);
console.log(`HALAMAN TOP-1 tepat    : ${pageHit}/${total} (${(pageHit/total*100).toFixed(1)}%)`);
console.log(`HALAMAN TOP-1 (+/- 1)  : ${pageHitTol}/${total} (${(pageHitTol/total*100).toFixed(1)}%)`);
console.log(`FRASA di top-7 konteks : ${phraseInTop7}/${total} (${(phraseInTop7/total*100).toFixed(1)}%)`);
