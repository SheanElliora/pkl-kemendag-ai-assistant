import { loadPDFWithPages } from "./services/pdfPageLoader.js";


const pages =
await loadPDFWithPages(
    "Nigeria_Martel Tekstil Kain Ankara.pdf"
);



console.log(
    "Jumlah halaman:",
    pages.length
);


console.log(
    pages[0]
);