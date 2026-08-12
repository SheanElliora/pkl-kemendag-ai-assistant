import fs from "fs";
import path from "path";
import { ChromaClient } from "chromadb";
import { createEmbedding } from "../services/embedderService.js";

const client = new ChromaClient();
const COLLECTION = "sip_documents";

// Hapus & buat ulang collection agar bersih
try {
  await client.deleteCollection({ name: COLLECTION });
  console.log("Collection lama dihapus");
} catch (e) {
  console.log("Collection belum ada / dihapus:", e?.message || "");
}

const collection = await client.createCollection({
  name: COLLECTION,
  embeddingFunction: null,
});
console.log("Collection baru dibuat");

const dir = path.resolve("chunks");
const files = fs.readdirSync(dir).filter((f) => f.endsWith("_chunks.json"));

let total = 0;
for (const f of files) {
  const filename = f.replace(/_chunks\.json$/, "") + ".pdf";
  const chunks = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log(`\n=== ${filename} (${chunks.length} chunk) ===`);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const id = `${filename}_${c.page}_${i}`;
    const vector = await createEmbedding(c.text);
    await collection.add({
      ids: [id],
      embeddings: [vector],
      documents: [c.text],
      metadatas: [{ filename, title: "", page: c.page }],
    });
    total++;
    if (total % 100 === 0) console.log(`  ... ${total} chunk`);
  }
}
console.log("\nREINDEX SELESAI, total chunk:", total);
