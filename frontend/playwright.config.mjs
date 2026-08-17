import { defineConfig } from "@playwright/test";

// =====================================
// Konfigurasi Playwright E2E (frontend)
// -------------------------------------
// Prasyarat: ChromaDB :8000 + Backend
// :3001 + Vite :5173 harus berjalan
// (lihat README "Cara menjalankan").
// Vite yang sudah hidup akan dipakai
// ulang (reuseExistingServer).
//
// Cara pakai (dari folder frontend/):
//   npx playwright test
//   npx playwright test --headed
//   npx playwright test e2e/chat.spec.mjs
// =====================================

export default defineConfig({
    testDir: "./e2e",
    timeout: 150000,
    expect: { timeout: 15000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: "http://localhost:5173",
        headless: true,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 30000,
    },
});