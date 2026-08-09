import fs from "fs";
import path from "path";

import { DATA_FOLDER } from "../config.js";


// =====================================
// Store JSON sederhana
// Data disimpan sebagai file .json per
// "tabel": users.json, login-logs.json,
// files.json. Cocok untuk volume kecil
// dan memudahkan belajar/analisis.
// =====================================


function ensureDataFolder() {

    if (!fs.existsSync(DATA_FOLDER)) {

        fs.mkdirSync(DATA_FOLDER, { recursive: true });

    }

}


function getFilePath(name) {

    return path.join(DATA_FOLDER, name + ".json");

}


export function readJson(name, fallback) {

    ensureDataFolder();

    const filePath = getFilePath(name);

    if (!fs.existsSync(filePath)) {

        return fallback;

    }

    try {

        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

    }
    catch (error) {

        console.log(
            "Gagal membaca data:",
            name,
            error.message
        );

        return fallback;

    }

}


export function writeJson(name, data) {

    ensureDataFolder();

    fs.writeFileSync(
        getFilePath(name),
        JSON.stringify(data, null, 2),
        "utf8"
    );

}