import { test, expect } from "@playwright/test";
import fs from "fs";

const CHATS = "C:/dev/pkl-kemendag-ai-assistant/backend/data/chats.json";

function latestSession() {
  // Backend menulis chats.json dengan writeFileSync (bukan atomik) —
  // baca ulang sebentar bila file sedang parsial/kosong saat ditulis.
  for (let i = 0; i < 6; i++) {
    try {
      const chats = JSON.parse(fs.readFileSync(CHATS, "utf8"));
      return Array.isArray(chats) ? chats[0] || null : null;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  return null;
}

async function downloadVia(page, format) {
  const dlBtn = page.locator('button[title="Unduh percakapan ini"]');
  await dlBtn.click();
  const item = page.getByRole("button", { name: new RegExp(format === "html" ? "cetak ke PDF" : "buka di Word") });
  await expect(item).toBeVisible({ timeout: 5000 });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    item.dispatchEvent("click")
  ]);
  return dl;
}

test("TAHAP 3: tombol Unduh mengunduh percakapan (HTML & DOC)", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("input.hero-input");
  await expect(hero).toBeVisible({ timeout: 15000 });
  await hero.fill("Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024? Jawab singkat.");
  await hero.press("Enter");

  const answer = page.locator(".markdown-body");
  await expect(answer.first()).toContainText(/SIP|Perdagangan|Permendag/i, { timeout: 90000 });

  const dlBtn = page.locator('button[title="Unduh percakapan ini"]');
  await expect(dlBtn).toBeVisible({ timeout: 120000 });

  const htmlDownload = await downloadVia(page, "html");
  const htmlPath = await htmlDownload.path();
  const htmlContent = fs.readFileSync(htmlPath, "utf8");
  expect(htmlContent).toContain("PERMENDAG Nomor 28 Tahun 2024");
  expect(htmlContent).toContain("Sumber:");

  const docDownload = await downloadVia(page, "doc");
  const docPath = await docDownload.path();
  const docContent = fs.readFileSync(docPath, "utf8");
  expect(docContent).toContain("PERMENDAG Nomor 28 Tahun 2024");

  const s = latestSession();
  if (s) {
    const res = await page.request.delete("http://localhost:3001/api/chat/history/" + s.id);
    expect(res.status()).toBe(200);
  }
});