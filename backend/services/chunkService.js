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

export function extractPrintedPage(text) {

    if (!text) return null;

    const lines =
    text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

    if (lines.length === 0) return null;

    // Lokasi favorit nomor halaman: baris paling
    // atas (header) dan paling bawah (footer).
    const heads = lines.slice(0, 1);
    const tails = lines.slice(-2);
    const pool = [...tails, ...heads];

    const candidates = [];

    for (const line of pool) {

        // 1) Baris BERISI HANYA nomor, boleh dihias
        //    tanda baca pemisah: "12", "- 12 -",
        //    ". 7 .", "| 8 |", "23 ", "– 45 –".
        let m =
        line.match(
            /^[\s.\-–—|:]*(\d{1,4})[\s.\-–—|:]*$/
        );

        if (m) candidates.push(Number(m[1]));

        // 2) Eksplisit "Halaman/Page/hal./hlm. 12"
        m =
        line.match(
            /(?:halaman|page|hal\.?|hlm\.?|p\.?)\s*[:.]?\s*(\d{1,4})/i
        );

        if (m) candidates.push(Number(m[1]));

    }

    // Pilih kandidat paling masuk akal: angka positif
    // yang bukan tahun. Prefer angka relevan kecil.
    for (const c of candidates) {

        if (c >= 1 && c <= 9999 && !looksLikeYear(c)) {

            return c;

        }

    }

    // Cadangan: bila hanya berupa tahun pun (mis.
    // dokumen yang mencetak tahun di footer), jangan
    // mengganti — kembalikan null agar tidak salah.
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
    chunkSize = 1500,
    overlap = 300
){

    const chunks = [];

    for(const page of pages) {

        // Nomor halaman tercetak (dari footer/header
        // teks). null bila tidak terdeteksi -> tampilan
        // memakai indeks page.
        const printedPage =
        extractPrintedPage(page.text);

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