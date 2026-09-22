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

async function worker() {

    if (busy) return;

    if (queue.length === 0) return;

    busy = true;

    const job = queue.shift();

    try {

        await processJob(job);

    }
    catch (jobError) {

        markError(job.recordId, jobError.message);

        console.log("Job gagal:", job.filename, jobError.message);

    }
    finally {

        busy = false;

        worker();

    }

}

async function processJob(job) {

    console.log("[ingest] background:", job.filename);

    if (!fs.existsSync(path.join(DOCS_FOLDER, job.filename))) {

        markError(job.recordId, "File tidak ditemukan saat diproses (mungkin dihapus)");
        return;

    }

    await ingestDocument(job.filename);

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

export function enqueueIngest({ recordId, filename, approvedBy }) {

    queue.push({ recordId, filename, approvedBy });

    worker();

    return queue.length;

}

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

        console.log(`[ingestQueue] Pulihkan ${recovered} dokumen processing.`);

    }

}
