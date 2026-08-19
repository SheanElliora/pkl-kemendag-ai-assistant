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

test("TAHAP 2: feedback up + komentar tersimpan ke server", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("input.hero-input");
  await expect(hero).toBeVisible({ timeout: 15000 });
  await hero.fill("Apa yang diatur dalam PERMENDAG Nomor 28 Tahun 2024? Jawab singkat.");
  await hero.press("Enter");

  const answer = page.locator(".markdown-body");
  await expect(answer.first()).toContainText(/SIP|Perdagangan|Permendag/i, { timeout: 90000 });

  // Klik tombol 👍 pada jawaban pertama
  const upBtn = page.locator('button[title="Jawaban membantu"]').first();
  await upBtn.click();
  await expect(upBtn).toHaveCSS("background-color", "rgb(220, 252, 231)"); // #dcfce7

  // Isi komentar lalu kirim
  const commentInput = page.locator('input[placeholder="Komentar (opsional)…"]').first();
  await expect(commentInput).toBeVisible({ timeout: 10000 });
  await commentInput.fill("Jawabannya lengkap dan jelas");
  await commentInput.press("Enter");

  // Tunggu sesi server terbentuk & feedback tersimpan
  await expect.poll(async () => {
    const s = latestSession();
    if (!s) return null;
    const fb = s.messages.find((m) => m.feedback && m.feedback.rating === "up");
    return fb ? fb.feedback.comment : null;
  }, { timeout: 30000 }).toBe("Jawabannya lengkap dan jelas");

  // Bersihkan: hapus sesi uji dari server
  const s = latestSession();
  if (s) {
    const res = await page.request.delete("http://localhost:3001/api/chat/history/" + s.id);
    expect(res.status()).toBe(200);
  }
});