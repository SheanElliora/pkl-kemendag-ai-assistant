import { extractPrintedPage } from "../services/chunkService.js";
const samples = [
  "Ringkasan Eksekutif ...\nbeberapa baris isi\n12",
  "Headline subtitle\nisi paragraf panjang\n- 7 -",
  "isi tanpa nomor\nterus berlanjut",
  "Kata Pengantar\n- 2024 -",
  "Pengantar Dokumen\n3 . ",
  "Marketing report\nN/1,400-2,400\n18",
];
for (const s of samples) console.log(JSON.stringify(s.split("\n").pop()), "->", extractPrintedPage(s));
