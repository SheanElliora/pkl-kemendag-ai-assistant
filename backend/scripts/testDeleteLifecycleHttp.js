import fs from "fs";
import path from "path";

import { ChromaClient } from "chromadb";

import {
    DOCS_FOLDER
} from "../config.js";


const BASE = "http://127.0.0.1:3001";
const TEST_NAME = "Tes_Hapus_20260812.pdf";
const SRC_PDF = "jurnal ai 1.pdf";


function readEnv(key) {

    const env = fs.readFileSync(".env", "utf8");
    const m = env.match(new RegExp(key + "=(.+)"));

    return m ? m[1].trim() : null;

}


async function api(pathname, { method = "GET", token, body, headers = {} } = {}) {

    if (token) {

        headers.Authorization = `Bearer ${token}`;

    }

    const opts = { method, headers };

    if (body) {

        opts.body = body;

    }

    const res = await fetch(BASE + pathname, opts);

    let json = null;

    try {

        json = await res.json();

    }
    catch {}

    return { status: res.status, json };

}


async function main() {

    // 1) Login
    const login =
    await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            username: "admin",
            password: readEnv("DEFAULT_ADMIN_PASSWORD")
        }),
        headers: { "Content-Type": "application/json" }
    });

    if (login.status !== 200) {

        throw new Error("Login gagal: " + JSON.stringify(login.json));

    }

    const token = login.json.token;

    console.log("1. Login admin OK");


    // 2) Siapkan file uji di uploads lalu upload via API
    const uploadsDir =
    path.join(path.dirname("."), "uploads");

    const localPath =
    path.join(uploadsDir, TEST_NAME);

    fs.copyFileSync(
        path.join(DOCS_FOLDER, SRC_PDF),
        localPath
    );

    const blob = new Blob(
        [ fs.readFileSync(localPath) ],
        { type: "application/pdf" }
    );

    const fd = new FormData();
    fd.append("file", blob, TEST_NAME);

    const up =
    await api("/api/cms/upload", {
        method: "POST",
        token,
        body: fd
    });

    if (up.status !== 200) {

        throw new Error("Upload gagal: " + JSON.stringify(up.json));

    }

    const fileId = up.json.fileId;

    console.log(
        "2. Upload OK -> fileId",
        fileId,
        "| status",
        up.json.status
    );


    // 3) Approve (server menjalankan ingest di prosesnya sendiri)
    const appr =
    await api(`/api/cms/files/${fileId}/approve`, {
        method: "POST",
        token
    });

    if (appr.status !== 200) {

        throw new Error("Approve gagal: " + JSON.stringify(appr.json));

    }

    console.log("3. Approve OK -> status", appr.json.file.status);


    // 4) Verifikasi dokumen ada di docs & Chroma
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


    // 5) Delete via API
    const del =
    await api(`/api/cms/files/${fileId}`, {
        method: "DELETE",
        token
    });

    if (del.status !== 200) {

        throw new Error("Delete gagal: " + JSON.stringify(del.json));

    }

    console.log("5. Delete OK -> status", del.json.file.status);


    // 6) Verifikasi bersih
    inChroma =
    await col.get({ where: { filename: TEST_NAME } });

    console.log(
        "6. File di docs tersisa:",
        fs.existsSync(path.join(DOCS_FOLDER, TEST_NAME)),
        "| chunk tersisa di Chroma:",
        inChroma.ids.length
    );


    // 7) Restore files.json (buang record uji berstatus deleted)
    const filesPath = path.join(
        path.dirname("."),
        "data",
        "files.json"
    );

    let files =
    JSON.parse(fs.readFileSync(filesPath, "utf8"));

    const before = files.length;

    files = files.filter(
        f => f.originalName !== TEST_NAME
    );

    fs.writeFileSync(
        filesPath,
        JSON.stringify(files, null, 2),
        "utf8"
    );

    console.log(
        "7. files.json:",
        before,
        "->",
        files.length,
        "record (record uji dibuang)"
    );


    console.log("\n===== TES SIKLUS HIDUP LULUS =====");
    process.exit(0);

}


main().catch(error => {

    console.error("\n===== TES GAGAL =====");
    console.error(error);
    process.exit(1);

});