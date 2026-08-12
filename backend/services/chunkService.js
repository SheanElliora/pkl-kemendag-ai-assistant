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