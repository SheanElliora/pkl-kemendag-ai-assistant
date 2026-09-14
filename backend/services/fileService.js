import fs from "fs";
import path from "path";

import {
    DOCS_FOLDER,
    UPLOADS_FOLDER,
    OCR_FOLDER,
    CHUNK_FOLDER
} from "../config.js";
import { readJson, writeJson } from "./storeService.js";
import { enqueueIngest } from "./ingestQueue.js";
import { deleteVectorsByFilename } from "./vectorStorage.js";

function getFiles() {

    return readJson("files", []);

}

function saveFiles(files) {

    writeJson("files", files);

}

function nextId(items) {

    return items.reduce(
        (max, item) =>
        Math.max(max, Number(item.id) || 0),
        0
    ) + 1;

}

function ensureFolder(folder) {

    if (!fs.existsSync(folder)) {

        fs.mkdirSync(folder, { recursive: true });

    }

}

export function ensureFolders() {

    ensureFolder(UPLOADS_FOLDER);
    ensureFolder(DOCS_FOLDER);

}

export function createFileRecord({ filename, size, uploadedBy }) {

    const files = getFiles();

    const record = {
        id: nextId(files),
        filename,
        originalName: filename,
        size,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        status: "pending",
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectReason: null
    };

    files.push(record);
    saveFiles(files);

    return record;

}

export function findByOriginalName(filename) {

    return getFiles().find(
        file => file.originalName === filename
    );

}

export function getFileById(id) {

    return getFiles().find(
        file => file.id === Number(id)
    );

}

export function listFiles(user) {

    const all = getFiles()
        .slice()
        .sort(
            (a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
        );

    if (user.role === "admin") {

        return all;

    }

    return all.filter(
        file => file.uploadedBy === user.username
    );

}

export async function approveFile(id, approvedBy) {

    const files = getFiles();

    const record = files.find(
        file => file.id === Number(id)
    );

    if (!record) {

        return { error: "File tidak ditemukan" };

    }

    if (record.status !== "pending") {

        return { error: "Status file bukan pending" };

    }

    const sourcePath =
    path.join(UPLOADS_FOLDER, record.filename);

    const destPath =
    path.join(DOCS_FOLDER, record.filename);

    if (!fs.existsSync(sourcePath)) {

        return { error: "File fisik tidak ditemukan di folder upload" };

    }

    if (fs.existsSync(destPath)) {

        const oldRecord = getFiles().find(
            f =>
            f.filename === record.filename &&
            ["approved", "error"].includes(f.status)
        );

        if (oldRecord) {

            try {

                await deleteFile(
                    oldRecord.id,
                    approvedBy
                );

            }
            catch (updateError) {

                return { error: "Gagal mengganti dokumen lama: " + updateError.message };

            }

        }

    }

    fs.renameSync(sourcePath, destPath);

    record.status = "processing";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date().toISOString();
    record.error = undefined;

    saveFiles(files);

    enqueueIngest({
        recordId: record.id,
        filename: record.filename,
        approvedBy
    });

    return { file: record };

}

export function rejectFile(id, rejectedBy, reason) {

    const files = getFiles();

    const record = files.find(
        file => file.id === Number(id)
    );

    if (!record) {

        return { error: "File tidak ditemukan" };

    }

    if (record.status !== "pending") {

        return { error: "Status file bukan pending" };

    }

    const sourcePath =
    path.join(UPLOADS_FOLDER, record.filename);

    if (fs.existsSync(sourcePath)) {

        fs.unlinkSync(sourcePath);

    }

    record.status = "rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date().toISOString();
    record.rejectReason = reason || "";

    saveFiles(files);

    return { file: record };

}

export async function deleteFile(id, deletedBy) {

    const files = getFiles();

    const record = files.find(
        file => file.id === Number(id)
    );

    if (!record) {

        return { error: "File tidak ditemukan" };

    }

    if (!["approved", "error"].includes(record.status)) {

        return { error: "Hanya dokumen yang sudah disetujui yang dapat dihapus" };

    }

    const destPath =
    path.join(DOCS_FOLDER, record.filename);

    if (fs.existsSync(destPath)) {

        fs.unlinkSync(destPath);

    }

    const stem =
    path.basename(record.filename, ".pdf");

    const ocrPath =
    path.join(OCR_FOLDER, stem + ".txt");

    const chunkPath =
    path.join(CHUNK_FOLDER, stem + "_chunks.json");

    [ocrPath, chunkPath].forEach(p => {

        if (fs.existsSync(p)) {

            fs.unlinkSync(p);

        }

    });

    try {

        await deleteVectorsByFilename(record.filename);

    }
    catch (error) {

        return { error: "Gagal menghapus data vektor: " + error.message };

    }

    record.status = "deleted";
    record.deletedBy = deletedBy;
    record.deletedAt = new Date().toISOString();

    saveFiles(files);

    return { file: record };

}
