// ============================================================
// Unit test: BM25 Service
// Menjalankan: node --test tests/  (dari backend/)
// Korpus dibuat sementara di %TEMP% agar tidak menyentuh
// chunk asli proyek.
// ============================================================

import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bm25-test-"));

process.env.CHUNKS_PATH = tmp;

fs.writeFileSync(
    path.join(tmp, "regulasi_chunks.json"),
    JSON.stringify([
        {
            page: 1,
            printedPage: 1,
            text: "Peraturan Menteri Perdagangan Nomor 28 Tahun 2024 mengatur Sistem Informasi Perdagangan dan interoperabilitas data perdagangan nasional."
        },
        {
            page: 2,
            printedPage: 2,
            text: "Perdagangan luar negeri meliputi ekspor dan impor barang serta jasa antarnegara."
        }
    ])
);

fs.writeFileSync(
    path.join(tmp, "game_chunks.json"),
    JSON.stringify([
        {
            page: 1,
            printedPage: 1,
            text: "Pendapatan industri game Jepang diperkirakan tumbuh signifikan didorong pasar konsol dan jumlah gamer."
        }
    ])
);

let searchBM25;

before(async () => {
    const mod = await import("../services/bm25Service.js");
    searchBM25 = mod.searchBM25;
});

test("BM25: istilah eksak ditemukan di dokumen yang benar", () => {
    const res = searchBM25("berapa pendapatan industri game jepang?", 10);
    assert.ok(res.length > 0, "harus ada hasil");
    assert.ok(
        res[0].meta.filename.includes("game.pdf"),
        "hasil terbaik = dokumen game"
    );
});

test("BM25: nomor peraturan ditemukan", () => {
    const res = searchBM25("peraturan menteri perdagangan nomor 28 tahun 2024", 10);
    assert.ok(
        res.some((r) => r.meta.filename.includes("regulasi.pdf")),
        "dokumen regulasi muncul"
    );
});

test("BM25: pertanyaan tanpa kecocokan kosong", () => {
    const res = searchBM25("xyzzy qqqqq zzzzz", 10);
    assert.ok(res.length === 0, "tidak boleh ada hasil");
});

test("BM25: hasil terurut menurun menurut skor", () => {
    const res = searchBM25("perdagangan impor ekspor jepang", 10);
    for (let i = 1; i < res.length; i++) {
        assert.ok(res[i - 1].bm25Score >= res[i].bm25Score);
    }
});