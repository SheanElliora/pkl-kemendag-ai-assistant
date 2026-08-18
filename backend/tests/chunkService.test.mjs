// ============================================================
// Unit test: Chunking (chunkService)
// Fungsi murni — tidak perlu environment apa pun.
// ============================================================

import { test } from "node:test";
import assert from "node:assert";
import { createChunks } from "../services/chunkService.js";

const longText = [
    "Pasal 1 Dalam Peraturan Menteri ini yang dimaksud dengan:",
    "Sistem Informasi Perdagangan adalah tatanan prosedur dan mekanisme untuk pengumpulan data perdagangan.",
    "SIP Nasional dikembangkan oleh menteri perdagangan dengan lingkup nasional.",
    "SIP Daerah dikembangkan oleh pemerintah daerah dan terintegrasi dengan SIP Nasional."
].join(" ");

test("createChunks menghasilkan chunk ber-annotasi halaman", () => {
    const chunks = createChunks([{ page: 3, text: longText }]);
    assert.ok(chunks.length >= 1);
    assert.equal(chunks[0].page, 3);
    assert.ok(typeof chunks[0].printedPage === "number" || chunks[0].printedPage === null);
    assert.ok(chunks[0].text.length > 0);
});

test("createChunks tidak menghasilkan chunk kosong", () => {
    const chunks = createChunks([
        { page: 1, text: "   " },
        { page: 2, text: "Halaman dengan teks sah." }
    ]);
    assert.ok(chunks.every((c) => c.text.trim().length > 0));
});

test("createChunks menggabungkan kalimat dalam satu halaman", () => {
    const chunks = createChunks([{ page: 1, text: longText }]);
    const joined = chunks.map((c) => c.text).join(" ");
    assert.ok(joined.length >= longText.length - 10, "teks tidak hilang");
});