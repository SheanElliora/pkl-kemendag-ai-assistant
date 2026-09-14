import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const chatsPath = path.join(dataDir, "chats.json");
const backupDir = path.resolve(__dirname, "../backup");

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

const args = process.argv.slice(2);
const doBackup = !args.includes("--no-backup");
const keepSessions = Number(args.find((a) => a.startsWith("--keep="))?.split("=")[1] ?? 0);

if (doBackup) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `pre-reset-${ts}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ["chats.json", "files.json", "users.json"]) {
    const src = path.join(dataDir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
  }
  console.log(`[backup] ${dest}`);
}

if (!fs.existsSync(chatsPath)) {
  console.log("[reset] chats.json tidak ada, skip");
  process.exit(0);
}

const raw = loadJson(chatsPath, {});
const entries = Object.entries(raw);
const guestKeys = entries.filter(([k, v]) => {
  const owner = v?.owner || "";
  return owner === "guest" || owner.startsWith("guest") || k.startsWith("guest");
});

console.log(`[reset] total sesi: ${entries.length}, guest: ${guestKeys.length}`);

if (keepSessions > 0) {
  guestKeys.sort((a, b) => {
    const ta = a[1]?.updatedAt || a[1]?.createdAt || "";
    const tb = b[1]?.updatedAt || b[1]?.createdAt || "";
    return String(tb).localeCompare(String(ta));
  });
  const toDelete = guestKeys.slice(keepSessions);
  for (const [k] of toDelete) delete raw[k];
  console.log(`[reset] keep ${keepSessions} guest terbaru, hapus ${toDelete.length}`);
} else {
  for (const [k] of guestKeys) delete raw[k];
  console.log(`[reset] hapus semua guest (${guestKeys.length})`);
}

fs.writeFileSync(chatsPath, JSON.stringify(raw, null, 2), "utf8");
const after = Object.keys(raw).length;
console.log(`[reset] selesai: ${entries.length} -> ${after} sesi`);
console.log(`[reset] file: ${chatsPath}`);
