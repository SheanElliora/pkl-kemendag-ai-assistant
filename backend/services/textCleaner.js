export function cleanText(text){

    return text

        .replace(/\r\n?/g,"\n")

        .replace(/[^\S\n]+/g," ")

        .replace(/[ \t]*\n[ \t]*/g,"\n")

        .replace(/\n{2,}/g,"\n")

        .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g," ")

        .trim();

}
