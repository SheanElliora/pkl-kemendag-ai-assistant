function looksLikeYear(n) {

    return n >= 1900 && n <= 2099;

}

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

    const heads = lines.slice(0, 1);
    const tails = lines.slice(-2);
    const lastLine = lines[lines.length - 1];
    const pool = [...tails, ...heads];

    for (const line of pool) {

        let m =
        line.match(
            /^[\s.\-–—|:]*(\d{1,4})[\s.\-–—|:]*$/
        );

        if (m) {

            const n = Number(m[1]);

            if (isValidPageNumber(n)) return n;

        }

        m =
        line.match(
            /^[\s.\-–—|:]*([ivxlcdm]{1,7})[\s.\-–—|:]*$/i
        );

        if (m) {

            const rn = m[1].toLowerCase();

            if (ROMAN_TO_INT[rn]) return ROMAN_TO_INT[rn];

        }

        m =
        line.match(
            /^[\s.\-–—|:]*[-–—]\s*(\d{1,4})\s*[-–—]/
        );

        if (m) {

            const n = Number(m[1]);

            if (isValidPageNumber(n)) return n;

        }

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

    return null;

}

export function detectDocType(pages, filename = "") {
    const name = (filename || "").toLowerCase();
    const sample = pages
        .slice(0, 3)
        .map((p) => p.text || "")
        .join(" ")
        .toLowerCase()
        .slice(0, 4000);

    if (
        /permendag|permen|peraturan|undang-undang|\buu\b|pp\s*nomor|pasal\s+\d+/.test(
            name
        ) ||
        /pasal\s+\d+|ayat\s*\(|peraturan menteri|bab\s+[ivx]+|lembaran negara/.test(
            sample
        )
    ) {
        return "peraturan";
    }

    if (
        /jurnal|journal|artikel|skripsi|thesis|penelitian|riset|e-journal/.test(
            name
        ) ||
        /abstrak|abstract|metodologi|methodology|daftar pustaka|references|rumusan masalah|tujuan penelitian|tinjauan pustaka/.test(
            sample
        )
    ) {
        return "akademik";
    }

    if (
        /market intelligence|laporan.*pasar|nigeria|jepang|japan|ekspor|impor|kain|tekstil|restoran|game|decoration|ankara|medis/.test(
            name
        ) ||
        /market intelligence|peluang.*pasar|strategi.*distribusi|informasi pasar|hs\s*code|beia\s*cukai/.test(
            sample
        )
    ) {
        return "praktis";
    }

    return "general";
}

export function getChunkConfig(docType) {
    switch (docType) {
        case "peraturan":

            return { chunkSize: 1600, overlap: 400 };
        case "akademik":

            return { chunkSize: 2000, overlap: 600 };
        case "praktis":

            return { chunkSize: 2000, overlap: 500 };
        default:
            return { chunkSize: 2000, overlap: 500 };
    }
}

function splitIntoSentences(text) {

    const paragraphs =
    text
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean);

    const sentences = [];

    for(const paragraph of paragraphs) {

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

                if(
                    currentLen + piece.length > chunkSize &&
                    current.length > 0
                ){

                    flush();

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

