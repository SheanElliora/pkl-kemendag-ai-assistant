// =====================================
// E2E CMS UI (login -> upload -> approve
// -> delete) via browser sungguhan
// -------------------------------------
// Mengikuti siklus hidup dokumen persis
// seperti yang dilakukan pengguna UI:
//
//   1. Buat user maintainer (API)
//   2. Login lewat form CMS
//   3. Upload PDF (tab Unggah Dokumen)
//   4. Cek dokumen muncul di "Dokumen Saya"
//   5. Login admin -> approve (Terima)
//   6. Cek status Disetujui
//   7. Hapus dokumen (bersih vektor)
//   8. Hapus user tes + bersihkan files.json
//
// SCRIPT INI MEMBERSIHKAN DIRI: user &
// record tes dibuang di akhir, aman
// dijalankan berulang.
// =====================================

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BACKEND = "http://localhost:3001";
const ADMIN_USER = "admin";
const ADMIN_PASS = "process.env diisi di bawah";
const ADMIN_PASS_SOURCE = process.env.ADMIN_PASSWORD || "AdminKemendag2026!";

const TS = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace("T", "_");
const TES_PREFIX = `Tes_UI_${TS}`;
const TES_PDF_NAME = `${TES_PREFIX}.pdf`;
const TES_USERNAME = `${TES_PREFIX}_maintainer`;

const FIXTURE_SRC = path.join("..", "backend", "docs", "jurnal ai 1.pdf");
const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".tmp");
const FIXTURE_PATH = path.join(FIXTURE_DIR, TES_PDF_NAME);
const FILES_JSON = path.join("..", "backend", "data", "files.json");

async function apiLogin(request, username, password) {
    const res = await request.post(`${BACKEND}/api/auth/login`, { data: { username, password } });
    expect(res.status()).toBe(200);
    return (await res.json()).token;
}

async function apiCreateUser(request, token, username, password) {
    const res = await request.post(`${BACKEND}/api/cms/users`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { username, password, role: "maintainer" },
    });
    expect(res.status()).toBe(200);
}

async function apiDeleteUser(request, token, username) {
    const res = await request.get(`${BACKEND}/api/cms/users`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const users = await res.json();
    const user = (users.users || users).find((u) => u.username === username);
    if (!user) return;
    const del = await request.delete(`${BACKEND}/api/cms/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status()).toBe(200);
}

test.describe.configure({ mode: "serial" });

test("siklus hidup dokumen via UI: upload -> approve -> delete", async ({ page, request }) => {
    test.setTimeout(300000);

    // ---------- 0. Persiapan fixture & user ----------
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.copyFileSync(FIXTURE_SRC, FIXTURE_PATH);

    const adminToken = await apiLogin(request, ADMIN_USER, ADMIN_PASS_SOURCE);
    await apiCreateUser(request, adminToken, TES_USERNAME, "tespass123");

    // ---------- 1. Login maintainer lewat form ----------
    await page.goto("/#/cms/login");
    await page.locator('input[placeholder="Username"]').fill(TES_USERNAME);
    await page.locator('input[placeholder="Password"]').fill("tespass123");
    await page.getByRole("button", { name: "Login", exact: true }).click();

    // Maintainer default ke tab "Unggah Dokumen"
    await expect(page).toHaveURL(/#\/cms$/, { timeout: 15000 });
    await expect(page.getByText("Unggah Dokumen Baru").first()).toBeVisible({ timeout: 15000 });

    // ---------- 2. Upload PDF ----------
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);
    await page.getByRole("button", { name: "Upload", exact: true }).click();

    // Upload selesai -> dokumen muncul di "Dokumen Saya" dengan status Menunggu
    await page.getByText("Dokumen Saya").first().click();
    const myRow = page.locator("tr.hover-row", { hasText: TES_PDF_NAME });
    await expect(myRow.first()).toBeVisible({ timeout: 30000 });

    // ---------- 3. Login admin & approve ----------
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#/cms/login");
    await page.locator('input[placeholder="Username"]').fill(ADMIN_USER);
    await page.locator('input[placeholder="Password"]').fill(ADMIN_PASS_SOURCE);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(/#\/cms$/, { timeout: 15000 });

    // Admin default ke tab "Kelola Dokumen" -> cari baris pending
    const pendingRow = page.locator("tr.hover-row", { hasText: TES_PDF_NAME });
    await expect(pendingRow.first()).toBeVisible({ timeout: 30000 });
    await pendingRow.first().getByRole("button", { name: "Terima", exact: true }).click();

    // Ingest selesai -> pindah ke filter "Disetujui"
    await page.getByText("Disetujui", { exact: true }).first().click();
    const approvedRow = page.locator("tr.hover-row", { hasText: TES_PDF_NAME });
    await expect(approvedRow.first()).toBeVisible({ timeout: 120000 });

    // ---------- 4. Hapus dokumen (bersih vektor) ----------
    await approvedRow.first().locator('button[title^="Hapus dokumen"]').click();
    await expect(page.getByText(`Hapus dokumen "${TES_PDF_NAME}"?`).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Ya, Hapus", exact: true }).click();

    await page.getByText("Dihapus", { exact: true }).first().click();
    const deletedRow = page.locator("tr.hover-row", { hasText: TES_PDF_NAME });
    await expect(deletedRow.first()).toBeVisible({ timeout: 30000 });

    // ---------- 5. Pembersihan ----------
    await apiDeleteUser(request, adminToken, TES_USERNAME);

    const files = JSON.parse(fs.readFileSync(FILES_JSON, "utf8"));
    const clean = files.filter((f) => !String(f.originalName || "").startsWith(TES_PREFIX));
    fs.writeFileSync(FILES_JSON, JSON.stringify(clean, null, 2), "utf8");
    fs.rmSync(FIXTURE_PATH, { force: true });
});