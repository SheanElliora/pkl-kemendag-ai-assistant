// =====================================
// Chunking berbasis kalimat
//
// Alih-alih memotong teks mentah per X karakter
// (yang sering memotong kalimat di tengah dan
// merusak semantik embedding), kita:
//   1. Bagi halaman menjadi kalimat (titik, tanda
//      tanya, seru, atau akhir baris paragraf).
//   2. Gabungkan kalimat berturut-turut hingga
//      mendekati chunkSize, dengan overlap berupa
//      kalimat yang diulang dari chunk sebelumnya.
//
// Hasil: chunk selalu berawal/berakhir pada batas
// kalimat sehingga setiap vektor mewakili makna
// yang utuh dan retrieval lebih akurat.
// =====================================

// =====================================
// Ekstraksi nomor halaman tercetak
//
// `page` di pipeline adalah INDEKS PDF (1..N),
// tetapi dokumen cetak sering memberi nomor
// halaman sendiri (offset akibat cover, kata
// pengantar, halaman romawi, dst). Nomor
// tercetak biasanya muncul di footer/header
// halaman, sehingga kita coba deteksi dari
// teks baris teratas / terbawah.
//
// Konservatif: hanya dipakai bila deteksi
// yakin; bila ragu kembalikan null (maka
// tampilan memakai indeks seperti biasa).
// =====================================

function looksLikeYear(n) {

    return n >= 1900 && n <= 2099;

}

// Angka romawi kecil lazim dipakai halaman pembuka
// (i, ii, iii, ..., xx) dokumen resmi/laporan.
const ROMAN_TO_INT = {

    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8,
    ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15,
    xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20

};

function isValidPageNumber(n) {

    return (
        Number.isInteger(n) &&
        n >= 1 &&
        n <= 9999 &&
        !looksLikeYear(n)
    );

}

export function extractPrintedPage(text, pageIndex) {

    if (!text) return null;

    const lines =
    text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

    if (lines.length === 0) return null;

    // Lokasi favorit nomor halaman: baris paling
    // bawah (footer) dan paling atas (header).
    const heads = lines.slice(0, 1);
    const tails = lines.slice(-2);
    const lastLine = lines[lines.length - 1];
    const pool = [...tails, ...heads];

    for (const line of pool) {

        // 1) Baris BERISI HANYA nomor, boleh dihias
        //    tanda baca pemisah: "12", "- 12 -",
        //    ". 7 .", "| 8 |", "23 ", "– 45 –".
        let m =
        line.match(
            /^[\s.\-–—|:]*(\d{1,4})[\s.\-–—|:]*$/
        );

        if (m) {

            const n = Number(m[1]);

            if (isValidPageNumber(n)) return n;

        }

        // 2) Angka romawi kecil saja pada satu baris
        //    (halaman pembuka: "vi", "iii", dst.).
        m =
        line.match(
            /^[\s.\-–—|:]*([ivxlcdm]{1,7})[\s.\-–—|:]*$/i
        );

        if (m) {

            const rn = m[1].toLowerCase();

            if (ROMAN_TO_INT[rn]) return ROMAN_TO_INT[rn];

        }

        // 3) Pola "- N -" di AWAL baris, umum pada
        //    dokumen hukum/peraturan: "- 2 -  5. ...",
        //    "- 10 - Pasal 21 ...".
        m =
        line.match(
            /^[\s.\-–—|:]*[-–—]\s*(\d{1,4})\s*[-–—]/
        );

        if (m) {

            const n = Number(m[1]);

            if (isValidPageNumber(n)) return n;

        }

        // 4) Nomor di AKHIR baris TERAKHIR halaman
        //    (footer), dipisah spasi/pipa/en-dash dari
        //    teks isi:
        //      "...VOL. 1/2020 | 4"
        //      "...trainable 18"
        //      "...JMPITA) 43"
        //    Hanya baris terakhir yang diperiksa — baris
        //    konten (tabel "Populasi 123", dst.) boleh
        //    diakhiri angka tapi itu BUKAN nomor halaman.
        //    Harus benar-benar token terakhir (bukan
        //    desimal "3.5" atau ribuan "2,400").
        //
        // Kandidat ini adalah yang PALING TIDAK ANDAL,
        // karena teks paparan juga bisa berakhir dengan
        // angka ("...permainan tersebut. 33"). Bila indeks
        // halaman diketahui, hanya terima bila nilainya
        // dekat dengan indeks (offset halaman pembuka
        // kecil): nomor halaman nyata hampir selalu
        // berjarak 0-10 halaman dari indeks PDF.
        if (line === lastLine) {

            m =
            line.match(
                /(?:^|\s|\||-|–|—)\s*(\d{1,4})\s*$/
            );

            if (m) {

                const n = Number(m[1]);

                if (
                    isValidPageNumber(n) &&
                    (
                        pageIndex == null ||
                        Math.abs(n - pageIndex) <= 10
                    )
                ) return n;

            }

        }

    }

    // Tidak ada pola yang bisa diandalkan: kembalikan
    // null agar tampilan memakai indeks PDF biasa.
    return null;

}

// Pecah teks halaman menjadi daftar "segmen":
// paragraf (baris kosong) dan kalimat.
function splitIntoSentences(text) {

    const paragraphs =
    text
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

    const sentences = [];

    for(const paragraph of paragraphs) {

        // Pertahankan singkatan umum (hlm., No., dsb.)
        // dengan membatasi titik yang memisahkan kalimat
        // hanya jika diikuti spasi + huruf besar/angka.
        const parts =
        paragraph
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
        .map(s => s.trim())
        .filter(Boolean);

        for(const part of parts) {
            sentences.push(part);
        }

    }

    return sentences;

}

// Potong kalimat yang masih terlalu panjang menjadi
// potongan aman (kasus tabel/OCR tanpa tanda baca).
function hardSplit(sentence, chunkSize) {

    const pieces = [];

    let rest = sentence;

    while(rest.length > chunkSize) {

        pieces.push(rest.slice(0, chunkSize));

        rest = rest.slice(chunkSize);

    }

    if(rest.length > 0) {
        pieces.push(rest);
    }

    return pieces;

}

export function createChunks(
    pages,
    chunkSize = 2000,
    overlap = 500
){

    const chunks = [];

    for(const page of pages) {

        // Nomor halaman tercetak (dari footer/header
        // teks). null bila tidak terdeteksi -> tampilan
        // memakai indeks page.
        const printedPage =
        extractPrintedPage(
            page.text,
            page.page
        );

        const sentences =
        splitIntoSentences(page.text);

        let current = [];
        let currentLen = 0;

        const flush = () => {

            if(current.length === 0) {
                return;
            }

            const text =
            current.join(" ").trim();

            if(text.length > 0) {

                chunks.push({
                    page: page.page,
                    printedPage,
                    text
                });

            }

        };

        for(const sentence of sentences) {

            const pieces =
            sentence.length > chunkSize
                ? hardSplit(sentence, chunkSize)
                : [sentence];

            for(const piece of pieces) {

                // Kalimat tunggal lebih panjang dari ukuran
                // chunk: simpan sendiri-sendiri.
                if(
                    piece.length >= chunkSize &&
                    current.length === 0
                ){

                    chunks.push({
                        page: page.page,
                        printedPage,
                        text: piece
                    });

                    continue;

                }

                // Cukup? simpan chunk sekarang lalu mulai
                // chunk baru dengan overlap berupa beberapa
                // kalimat terakhir yang masih muat.
                if(
                    currentLen + piece.length > chunkSize &&
                    current.length > 0
                ){

                    flush();

                    // Overlap: ulangi kalimat-kalimat terakhir
                    // dari chunk sebelumnya agar konteks tetap
                    // tersambung antar chunk.
                    let overlapLen = 0;

                    const overlapSentences = [];

                    for(
                        let i = current.length - 1;
                        i >= 0 && overlapLen < overlap;
                        i--
                    ){

                        const s = current[i];

                        if(overlapLen + s.length + 1 > overlap) {
                            break;
                        }

                        overlapSentences.unshift(s);

                        overlapLen += s.length + 1;

                    }

                    current = [...overlapSentences];

                    currentLen =
                    overlapSentences.reduce(
                        (sum, s) => sum + s.length + 1,
                        0
                    );

                }

                current.push(piece);

                currentLen += piece.length + 1;

            }

        }

        flush();

    }

    return chunks;
}

// End of chunkService.js