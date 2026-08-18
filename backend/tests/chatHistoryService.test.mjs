// ============================================================
// Unit test: Riwayat Percakapan (chatHistoryService)
// Data uji ditulis ke %TEMP% via DATA_PATH agar tidak
// menyentuh data chats.json asli proyek.
// ============================================================

import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chats-test-"));

process.env.DATA_PATH = tmp;

let history;

before(async () => {
    const mod = await import("../services/chatHistoryService.js");
    history = mod;
});

after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("buat sesi & tambah pesan user/assistant", () => {
    const session = history.createSession("client:abc", "Percakapan baru");
    assert.ok(session.id);
    assert.equal(session.messages.length, 0);

    const savedUser = history.appendMessage(session.id, {
        role: "user",
        content: "Apa isi PERMENDAG 28?"
    });
    assert.ok(savedUser.id);

    const savedAi = history.appendMessage(session.id, {
        role: "assistant",
        content: "Jawaban [1]",
        sources: [{ filename: "x.pdf", page: 1 }],
        model: "openai/gpt-4o-mini"
    });
    assert.ok(savedAi.id);

    const got = history.getSession(session.id);
    assert.equal(got.messages.length, 2);
    assert.equal(got.title, "Apa isi PERMENDAG 28?");
    assert.equal(got.messages[1].sources[0].filename, "x.pdf");
});

test("getOrCreateSession memakai sesi yang ada", () => {
    const first = history.getOrCreateSession("client:abc", null);
    const again = history.getOrCreateSession("client:abc", first.id);
    assert.equal(first.id, again.id);
});

test("getRecentMessages membatasi jumlah putaran", () => {
    const session = history.createSession("client:abc", "multi");
    for (let i = 0; i < 10; i++) {
        history.appendMessage(session.id, { role: "user", content: "q" + i });
        history.appendMessage(session.id, { role: "assistant", content: "a" + i });
    }
    const recent = history.getRecentMessages(session.id, 6);
    assert.equal(recent.length, 6);
    assert.equal(recent[0].role, "user");
});

test("feedback up/down tersimpan & diverifikasi", () => {
    const session = history.createSession("client:abc", "fb");
    const msg = history.appendMessage(session.id, { role: "assistant", content: "jawaban" });

    const bad = history.setFeedback(session.id, msg.id, "middle", "");
    assert.ok(bad.error);

    const ok = history.setFeedback(session.id, msg.id, "down", "kurang lengkap");
    assert.equal(ok.ok, true);

    const got = history.getSession(session.id);
    assert.equal(got.messages[0].feedback.rating, "down");
    assert.equal(got.messages[0].feedback.comment, "kurang lengkap");
});

test("listSessions hanya milik owner tertentu", () => {
    const a = history.createSession("client:a", "sesi a");
    const b = history.createSession("client:b", "sesi b");
    const listA = history.listSessions("client:a");
    assert.ok(listA.some((s) => s.id === a.id));
    assert.ok(!listA.some((s) => s.id === b.id));
    assert.equal(listA[0].messageCount, 0);
});

test("deleteSession menghapus", () => {
    const session = history.createSession("client:abc", "hapus ini");
    assert.equal(history.deleteSession(session.id), true);
    assert.equal(history.deleteSession(session.id), false);
});

test("chatStats menghitung sesi & feedback", () => {
    const before = history.chatStats().sessions;
    history.createSession("client:abc", "stat");
    const after = history.chatStats();
    assert.equal(after.sessions, before + 1);
    assert.ok(after.feedback.total >= 1);
});