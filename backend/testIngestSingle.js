import { ingestSinglePDF } from "./services/ingestService.js";


const filename = "TEST.pdf";


await ingestSinglePDF(filename);


console.log("TEST INGEST SELESAI");