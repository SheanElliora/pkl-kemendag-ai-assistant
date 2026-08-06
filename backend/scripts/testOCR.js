import { extractTextWithOCR } from "./services/ocrService.js";

const text = await extractTextWithOCR(
    "./docs/Nigeria_Martel Tekstil Kain Ankara.pdf"
);


console.log("=================");
console.log(text.substring(0,1000));
console.log("=================");