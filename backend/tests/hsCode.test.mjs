import { test } from "node:test";
import assert from "node:assert";
import {
    docHasHsCode,
    expandHsTokens,
    extractHsCodes,
    hsMatchForms,
    hsQueryHint
} from "../utils/hsCode.js";

test("extractHsCodes menangkap kode HS tanpa titik", () => {
    const codes = extractHsCodes("kode hs 14012010 boleh ekspor?");
    assert.ok(codes.includes("14012010"));
});

test("extractHsCodes menangkap kode HS bertitik", () => {
    const codes = extractHsCodes("HS 1401.20.10 dan 9018.90");
    assert.ok(codes.includes("14012010"));
    assert.ok(codes.includes("901890"));
});

test("hsMatchForms menghasilkan varian titik", () => {
    const forms = hsMatchForms("14012010");
    assert.ok(forms.includes("1401.20.10"));
    assert.ok(forms.includes("1401.20"));
    assert.ok(forms.includes("14012010"));
});

test("docHasHsCode cocok dengan dokumen bertitik", () => {
    const doc = "1. 1401.20.10 -- utuh rotan";
    assert.ok(docHasHsCode(doc, "14012010"));
    assert.ok(!docHasHsCode(doc, "99999999"));
});

test("expandHsTokens menambah token turunan HS", () => {
    const tokens = expandHsTokens(["kode", "14012010", "ekspor"]);
    assert.ok(tokens.includes("14012010"));
    assert.ok(tokens.includes("1401"));
    assert.ok(tokens.includes("20"));
    assert.ok(tokens.includes("10"));
    assert.ok(tokens.includes("kode"));
});

test("hsQueryHint mengembalikan string kosong tanpa kode HS", () => {
    assert.equal(hsQueryHint("bagaimana pasar jepang?"), "");
});

test("hsQueryHint mengembalikan varian untuk query HS", () => {
    const hint = hsQueryHint("boleh ekspor 14012010?");
    assert.ok(hint.includes("1401.20.10"));
});
