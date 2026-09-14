import { test, expect } from "@playwright/test";

test("halaman chat memuat & hero input tersedia", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("input.hero-input");
    await expect(hero).toBeVisible({ timeout: 15000 });
    await expect(hero).toHaveAttribute("placeholder", /Tanyakan informasi perdagangan/);
});

test("chat RAG menjawab dengan streaming + sumber referensi", async ({ page }) => {
    test.setTimeout(300000);
    await page.goto("/");

    const hero = page.locator("input.hero-input");
    await expect(hero).toBeVisible({ timeout: 15000 });
    await hero.fill("Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024? Jawab singkat.");
    await hero.press("Enter");

    const answer = page.locator(".markdown-body");
    await expect(answer.first()).toContainText(/SIP|Perdagangan|Permendag/i, { timeout: 240000 });

    const sources = page.locator("text=Sumber Referensi");
    await expect(sources.first()).toBeVisible({ timeout: 120000 });
    await expect(page.locator("text=PERMENDAG NOMOR 28 TAHUN 2024.pdf").first()).toBeVisible({ timeout: 10000 });

    const clientId = await page.evaluate(() => localStorage.getItem("cms_client_id"));
    if (clientId) {
        const res = await page.request.get("http://localhost:3001/api/chat/history?clientId=" + encodeURIComponent(clientId));
        const data = await res.json();
        for (const s of data.sessions || []) {
            await page.request.delete("http://localhost:3001/api/chat/history/" + s.id);
        }
    }
});
