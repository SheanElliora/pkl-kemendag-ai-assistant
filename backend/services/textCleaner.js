export function cleanText(text){

    return text

        // normalisasi CRLF / CR -> LF
        .replace(/\r\n?/g,"\n")

        // rapikan spasi/tab tapi pertahankan newline
        // (paragraf tetap utuh untuk chunking berbasis kalimat)
        .replace(/[^\S\n]+/g," ")

        // bersihkan spasi di sekitar newline
        .replace(/[ \t]*\n[ \t]*/g,"\n")

        // gabungkan newline beruntun menjadi satu
        .replace(/\n{2,}/g,"\n")

        // hilangkan karakter aneh
        .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g," ")

        // rapikan
        .trim();

}