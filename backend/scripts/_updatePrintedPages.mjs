import fs from "fs";
import path from "path";
import { ChromaClient } from "chromadb";
import { extractPrintedPage } from "../services/chunkService.js";
import { cleanText } from "../services/textCleaner.js";

const CHUNKS_DIR = path.resolve("chunks");
const OCR_DIR = path.resolve("ocr_text");
const COLLECTION = "sip_documents";

const client = new ChromaClient();
const collection = await client.getCollection({ name: COLLECTION, embeddingFunction: null });

function printedPerPageFor(filename) {
  const txtPath = path.join(OCR_DIR, filename.replace(/\.pdf$/i, ".txt"));
  if (!fs.existsSync(txtPath)) return null;
  const text = fs.readFileSync(txtPath, "utf8");
  const pages = text
    .split(/--- HALAMAN \d+ ---/)
    .filter((p) => p.trim())
    .map((p, i) => ({ page: i + 1, text: cleanText(p) }));
  const map = {};
  for (const pg of pages) map[pg.page] = extractPrintedPage(pg.text, pg.page);
  return map;
}

const files = fs.readdirSync(CHUNKS_DIR).filter((f) => f.endsWith("_chunks.json"));

for (const f of files) {
  const filename = f.replace(/_chunks\.json$/, "") + ".pdf";
  const printed = printedPerPageFor(filename);
  if (!printed) {
    console.log(`SKIP ${filename}: tidak ada TXT OCR`);
    continue;
  }

  // 1) Perbarui file chunk JSON (untuk ingest mendatang)
  const filePath = path.join(CHUNKS_DIR, f);
  const chunks = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let changed = 0;
  for (const c of chunks) {
    const pp = printed[c.page] ?? null;
    if (c.printedPage !== pp) {
      c.printedPage = pp;
      changed++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(chunks, null, 2), "utf8");
  console.log(`[JSON] ${filename}: ${changed}/${chunks.length} chunk diperbarui`);

  // 2) Perbarui metadata vektor Chroma dengan id sebenarnya
  const r = await collection.get({ where: { filename }, include: ["metadatas"] });
  const ids = r.ids;
  const metadatas = r.metadatas.map((m) => ({
    filename,
    title: m.title ?? "",
    page: m.page,
    printedPage: printed[m.page] ?? m.page,
  }));
  let ok = 0;
  for (let i = 0; i < ids.length; i += 200) {
    await collection.update({ ids: ids.slice(i, i + 200), metadatas: metadatas.slice(i, i + 200) });
    ok += Math.min(200, ids.length - i);
  }
  console.log(`[CHROMA] ${filename}: metadata diperbarui untuk ${ok} vektor`);
}

const totalVectors = await collection.count();
console.log("\nTotal vektor di collection:", totalVectors);