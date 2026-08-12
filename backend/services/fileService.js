import fs from "fs";
import path from "path";

import {
    DOCS_FOLDER,
    UPLOADS_FOLDER,
    OCR_FOLDER,
    CHUNK_FOLDER
} from "../config.js";
import { readJson, writeJson } from "./storeService.js";
import { ingestDocument } from "../ingest.js";
import { deleteVectorsByFilename } from "./vectorStorage.js";


// =====================================
// File service
// Mengelola siklus hidup file dokumen:
// pending (di folder uploads) ->
// approved (dipindah ke docs + di-ingest)
// atau rejected (dihapus).
// Data: data/files.json
// =====================================


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


// Maintainer hanya melihat file miliknya sendiri,
// admin melihat semua file.
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


// =====================================
// Approve: pindah file ke docs lalu ingest
// =====================================

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

        // Dokumen dengan nama sama sudah ada di docs.
        // Perlakukan sebagai PEMBARUAN (update): hapus
        // versi lama (PDF + vektor + cache) lalu simpan
        // versi baru. Jadi meng-upload ulang dokumen
        // dengan nama yang sama otomatis menggantikan
        // versi lama, tanpa perlu menghapus manual.
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

    try {

        await ingestDocument(record.filename);

        record.status = "approved";
        record.approvedBy = approvedBy;
        record.approvedAt = new Date().toISOString();
        record.error = undefined;

        saveFiles(files);

        return { file: record };

    }
    catch (error) {

        record.status = "error";
        record.approvedBy = approvedBy;
        record.approvedAt = new Date().toISOString();
        record.error = error.message;

        saveFiles(files);

        return { error: "Proses dokumen gagal: " + error.message };

    }

}


// =====================================
// Reject: hapus file pending
// =====================================

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


// =====================================
// Delete: hapus dokumen yang sudah
// disetujui/diproses.
// Menghapus file fisik di docs +
// vector-nya di Chroma, lalu menandai
// record sebagai "deleted" (audit).
// =====================================

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

    // 1. Hapus file fisik dari folder docs
    const destPath =
    path.join(DOCS_FOLDER, record.filename);

    if (fs.existsSync(destPath)) {

        fs.unlinkSync(destPath);

    }

    // 1b. Hapus artifact hasil proses (teks OCR + chunk json)
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

    // 2. Hapus vector/chunk-nya dari Chroma
    try {

        await deleteVectorsByFilename(record.filename);

    }
    catch (error) {

        return { error: "Gagal menghapus data vektor: " + error.message };

    }

    // 3. Tandai record sebagai deleted (audit trail)
    record.status = "deleted";
    record.deletedBy = deletedBy;
    record.deletedAt = new Date().toISOString();

    saveFiles(files);

    return { file: record };

}