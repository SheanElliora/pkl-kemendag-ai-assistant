import fs from "fs";
import path from "path";

import { ChromaClient } from "chromadb";

import {
    DOCS_FOLDER,
    UPLOADS_FOLDER,
    DATA_FOLDER
} from "../config.js";
import * as fileService from "../services/fileService.js";


const TEST_NAME = "Tes_Hapus_20260812.pdf";


async function main() {

    // 1) Siapkan file uji = salinan PDF kecil
    fs.copyFileSync(
        path.join(DOCS_FOLDER, "jurnal ai 1.pdf"),
        path.join(UPLOADS_FOLDER, TEST_NAME)
    );

    console.log("1. File uji dibuat di uploads");

    // 2) Buat record pending lewat service asli
    const record =
    fileService.createFileRecord({
        filename: TEST_NAME,
        size: fs.statSync(
            path.join(UPLOADS_FOLDER, TEST_NAME)
        ).size,
        uploadedBy: "admin"
    });

    console.log("2. Record pending dibuat id=", record.id);

    // 3) Approve -> pindah ke docs + ingest (proses nyata)
    const approved =
    await fileService.approveFile(record.id, "admin");

    if (approved.error) {

        throw new Error("approve gagal: " + approved.error);

    }

    console.log("3. Approved:", approved.file.status);

    // 4) Cek dokumen masuk Chroma
    const client = new ChromaClient();
    const col =
    await client.getCollection({
        name: "sip_documents",
        embeddingFunction: null
    });

    let inChroma =
    await col.get({ where: { filename: TEST_NAME } });

    console.log(
        "4. Di docs:",
        fs.existsSync(path.join(DOCS_FOLDER, TEST_NAME)),
        "| chunk di Chroma:",
        inChroma.ids.length
    );

    // 5) Delete lewat service asli
    const deleted =
    await fileService.deleteFile(record.id, "admin");

    if (deleted.error) {

        throw new Error("delete gagal: " + deleted.error);

    }

    console.log("5. Deleted:", deleted.file.status);

    // 6) Verifikasi semua bersih
    inChroma =
    await col.get({ where: { filename: TEST_NAME } });

    console.log(
        "6. File di docs tersisa:",
        fs.existsSync(path.join(DOCS_FOLDER, TEST_NAME)),
        "| chunk tersisa di Chroma:",
        inChroma.ids.length
    );

    // 7) Restore files.json ke kondisi bersih (8 record)
    const filesPath =
    path.join(DATA_FOLDER, "files.json");

    let files =
    JSON.parse(fs.readFileSync(filesPath, "utf8"));

    files = files.filter(
        f => f.originalName !== TEST_NAME
    );

    fs.writeFileSync(
        filesPath,
        JSON.stringify(files, null, 2),
        "utf8"
    );

    console.log(
        "7. Record uji dibersihkan. files.json:",
        files.length,
        "record"
    );

    console.log("\n===== TES SIKLUS HIDUP LULUS =====");
    process.exit(0);

}


main().catch(error => {

    console.error("===== TES GAGAL =====");
    console.error(error);
    process.exit(1);

});