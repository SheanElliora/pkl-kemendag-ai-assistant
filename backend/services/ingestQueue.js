// =====================================
// Antrean ingest background
// -------------------------------------
// Approve tidak lagi memblokir request:
// route langsung balas dengan status
// "processing", lalu dokumen diproses
// (OCR -> chunk -> embed -> Chroma)
// DI LATAR BELAKANG secara berurutan.
//
// Keuntungan:
// - Banyak dokumen baru bisa diantrekan
//   sekaligus tanpa menggantung admin.
// - Request tidak terputus oleh timeout.
// - Satu proses ingest per waktu (tidak
//   ada tabrakan tulis files.json/Chroma).
// - Restart server tidak kehilangan
//   antrean: job "processing" dipulihkan
//   otomatis saat startup.
// =====================================

import fs from "fs";
import path from "path";

import { DOCS_FOLDER } from "../config.js";
import { readJson, writeJson } from "./storeService.js";
import { ingestDocument } from "../ingest.js";
import { deleteVectorsByFilename } from "./vectorStorage.js";


let queue = [];

let busy = false;


function loadFiles() {

    return readJson("files", []);

}


function saveFiles(files) {

    writeJson("files", files);

}


// =====================================
// Ambil & jalankan job berikutnya
// =====================================

async function worker() {

    if (busy) return;

    if (queue.length === 0) return;

    busy = true;

    const job = queue.shift();

    try {

        await processJob(job);

    }
    catch (jobError) {

        // Jaring pengaman terakhir: kegagalan di luar
        // ingestDocument (mis. files.json bermasalah).
        markError(job.recordId, jobError.message);

        console.log("Job gagal:", job.filename, jobError.message);

    }
    finally {

        busy = false;

        // Lanjut ke job berikutnya (bila ada)
        worker();

    }

}


async function processJob(job) {

    console.log("\n======================================");
    console.log("INGEST (background):", job.filename);
    console.log("======================================");

    // Pastikan dokumen masih ada sebelum diproses
    // (bisa saja file dihapus saat antrean menunggu).
    if (!fs.existsSync(path.join(DOCS_FOLDER, job.filename))) {

        markError(job.recordId, "File tidak ditemukan saat diproses (mungkin dihapus)");
        return;

    }

    await ingestDocument(job.filename);

    // Perbarui status record — TAPI hanya jika record
    // masih berstatus "processing". Kalau di antara
    // waktu itu sudah dihapus (deleted), vektor yang
    // baru saja tersimpan dibuang dulu.
    const files = loadFiles();

    const record = files.find((f) => f.id === job.recordId);

    if (!record) {

        await deleteVectorsByFilename(job.filename);
        return;

    }

    if (record.status === "deleted") {

        await deleteVectorsByFilename(job.filename);
        return;

    }

    if (record.status !== "processing") {

        return;

    }

    record.status = "approved";
    record.approvedBy = job.approvedBy;
    record.approvedAt = new Date().toISOString();
    record.error = undefined;

    saveFiles(files);

    console.log("INGEST SELESAI:", job.filename, "-> approved");

}


function markError(recordId, message) {

    const files = loadFiles();

    const record = files.find((f) => f.id === recordId);

    if (!record || record.status !== "processing") return;

    record.status = "error";
    record.error = String(message).slice(0, 500);

    saveFiles(files);

}


// =====================================
// API publik
// =====================================

export function enqueueIngest({ recordId, filename, approvedBy }) {

    queue.push({ recordId, filename, approvedBy });

    worker();

    return queue.length;

}


export function pendingJobs() {

    return queue.length;

}


// =====================================
// Pemulihan setelah restart server:
// record yang tertinggal "processing"
// diantrekan lagi (atau ditandai error
// bila file fisiknya sudah tidak ada).
// =====================================

export function recoverProcessingJobs() {

    const files = loadFiles();

    let recovered = 0;

    files.forEach((f) => {

        if (f.status !== "processing") return;

        if (fs.existsSync(path.join(DOCS_FOLDER, f.filename))) {

            enqueueIngest({
                recordId: f.id,
                filename: f.filename,
                approvedBy: f.approvedBy
            });

            recovered++;

        }
        else {

            f.status = "error";
            f.error = "Proses terputus saat server restart dan file sudah tidak ada.";

            saveFiles(files);

        }

    });

    if (recovered > 0) {

        console.log(`[ingestQueue] Memulihkan ${recovered} dokumen yang tertinggal "processing".`);

    }

}