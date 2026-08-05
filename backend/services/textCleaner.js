export function cleanText(text){

    return text

        // hapus enter berlebihan
        .replace(/\n+/g," ")

        // hapus spasi ganda
        .replace(/\s+/g," ")

        // hilangkan karakter aneh
        .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g," ")

        // rapikan
        .trim();

}