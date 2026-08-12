import "dotenv/config";
import fs from "fs";
import path from "path";

import { ChromaClient } from "chromadb";

import {
    DOCS_FOLDER,
    DATA_FOLDER
} from "../config.js";


const COLLECTION_NAME = "sip_documents";


async function main() {

    const client = new ChromaClient();

    const collection =
    await client.getCollection({
        name: COLLECTION_NAME,
        embeddingFunction: null
    });

    console.log("Terhubung ke Chroma, koleksi:", COLLECTION_NAME);


    // ======================================
    // 1) Ambil SEMUA chunk (dipaginasi) untuk
    //    mengetahui filename yang tersimpan.
    // ======================================

    const limit = 500;

    const allIds = [];
    const allMetas = [];

    let offset = 0;

    while (true) {

        const page =
        await collection.get({
            include: ["metadatas"],
            limit,
            offset
        });

        if (!page.ids || page.ids.length === 0) {

            break;

        }

        for (let i = 0; i < page.ids.length; i++) {

            allIds.push(page.ids[i]);
            allMetas.push(page.metadatas?.[i] ?? null);

        }

        offset += page.ids.length;

        if (page.ids.length < limit) {

            break;

        }

    }

    console.log(`Total chunk di Chroma: ${allIds.length}`);


    // ======================================
    // 2) Dokumen aktif = file yang benar-benar
    //    ada di folder docs (sumber kebenaran).
    // ======================================

    let activeFiles = new Set();

    try {

        activeFiles = new Set(
            fs.readdirSync(DOCS_FOLDER)
              .map(name => name.toLowerCase())
        );

    }
    catch (error) {

        console.log("Perhatian: folder docs tidak terbaca:", error.message);

    }


    // ======================================
    // 3) Kelompokkan id chunk per filename,
    //    lalu tandai orphan (file tidak ada
    //    di docs).
    // ======================================

    const idsByFilename = new Map();

    for (let i = 0; i < allIds.length; i++) {

        const filename = allMetas[i]?.filename;

        if (!filename) {

            continue;

        }

        if (!idsByFilename.has(filename)) {

            idsByFilename.set(filename, []);

        }

        idsByFilename.get(filename).push(allIds[i]);

    }

    const orphanIds = [];

    for (const [filename, ids] of idsByFilename.entries()) {

        if (!activeFiles.has(filename.toLowerCase())) {

            orphanIds.push(...ids);

        }

    }

    if (orphanIds.length > 0) {

        for (let i = 0; i < orphanIds.length; i += limit) {

            await collection.delete({
                ids: orphanIds.slice(i, i + limit)
            });

        }

        console.log(`Dihapus ${orphanIds.length} chunk orphan dari Chroma`);

    }
    else {

        console.log("Tidak ada chunk orphan di Chroma");

    }


    // ======================================
    // 4) Sinkronisasi data/files.json dengan
    //    isi folder docs: setiap PDF aktif
    //    mendapat record "approved", record
    //    approved yang filenya sudah tidak
    //    ada ditandai "deleted".
    // ======================================

    const filesPath =
    path.join(DATA_FOLDER, "files.json");

    let files = [];

    try {

        files = JSON.parse(
            fs.readFileSync(filesPath, "utf8")
        );

    }
    catch {

        files = [];

    }

    let maxId = files.reduce(
        (max, file) =>
        Math.max(max, Number(file.id) || 0),
        0
    );

    const docs = fs
        .readdirSync(DOCS_FOLDER)
        .filter(name => name.toLowerCase().endsWith(".pdf"))
        .sort();

    for (const doc of docs) {

        const existing =
        files.find(
            file =>
            file.originalName === doc &&
            file.status === "approved"
        );

        if (existing) {

            continue;

        }

        const stat =
        fs.statSync(path.join(DOCS_FOLDER, doc));

        maxId += 1;

        files.push({
            id: maxId,
            filename: doc,
            originalName: doc,
            size: stat.size,
            uploadedBy: "sistem",
            uploadedAt: stat.mtime.toISOString(),
            status: "approved",
            approvedBy: "sistem",
            approvedAt: stat.mtime.toISOString(),
            rejectedBy: null,
            rejectedAt: null,
            rejectReason: null,
            deletedBy: null,
            deletedAt: null,
            error: undefined
        });

    }

    // Record approved yang filenya sudah tidak ada
    for (const file of files) {

        if (file.status === "approved") {

            if (!fs.existsSync(
                path.join(DOCS_FOLDER, file.filename)
            )) {

                file.status = "deleted";
                file.deletedBy = file.deletedBy || "sistem";
                file.deletedAt =
                    file.deletedAt ||
                    new Date().toISOString();

            }

        }

    }

    fs.writeFileSync(
        filesPath,
        JSON.stringify(files, null, 2),
        "utf8"
    );

    console.log(
        `files.json: ${files.length} record total, ${docs.length} dokumen aktif di docs`
    );

    process.exit(0);

}


main()
.then(() => {})
.catch(error => {

    console.error("GAGAL:", error);
    process.exit(1);

});