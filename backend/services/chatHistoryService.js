// ============================================================
// Layanan Riwayat Percakapan
//
// Menyimpan sesi percakapan chat ke data/chats.json via
// storeService (pola sama dengan users.json / files.json).
//
// Struktur data:
//   [
//     {
//       id: "sesi-<timestamp>-<acak>",
//       owner: "guest" | "<clientId>" | "<userId>",
//       title: "Pertanyaan pertama...",
//       createdAt: ISO,
//       updatedAt: ISO,
//       messages: [
//         {
//           id: "msg-...",
//           role: "user" | "assistant",
//           content: "...",
//           sources: [...],      // hanya untuk assistant
//           model: "...",        // hanya untuk assistant
//           feedback: null | { rating: "up"|"down", comment: "", at: ISO },
//           createdAt: ISO
//         }
//       ]
//     }
//   ]
//
// Volume kecil (sesuai pemakaian demo), jadi membaca/menulis
// seluruh file per operasi masih aman dan sederhana.
// ============================================================

import { readJson, writeJson } from "./storeService.js";
import crypto from "crypto";

const STORE = "chats";

function now() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function loadSessions() {
    const data = readJson(STORE, []);
    return Array.isArray(data) ? data : [];
}

function saveSessions(sessions) {
    writeJson(STORE, sessions);
}

function findSession(sessions, sessionId) {
    return sessions.find((s) => s.id === sessionId) || null;
}

// ====================================
// Sesi
// ====================================

export function createSession(owner, title) {
    const sessions = loadSessions();
    const session = {
        id: newId("sesi"),
        owner,
        title: String(title || "Percakapan baru").slice(0, 200),
        createdAt: now(),
        updatedAt: now(),
        messages: []
    };
    sessions.unshift(session);
    saveSessions(sessions);
    return session;
}

// Ambil sesi; buat baru bila tidak ada. Dipakai route chat agar
// klien tidak perlu dua panggilan (buat sesi lalu kirim pesan).
export function getOrCreateSession(owner, sessionId) {
    if (sessionId) {
        const sessions = loadSessions();
        const existing = findSession(sessions, sessionId);
        if (existing) return existing;
    }
    return createSession(owner, "Percakapan baru");
}

// Daftar sesi milik owner (tanpa pesan, ringan untuk list sidebar).
export function listSessions(owner, limit = 50) {
    return loadSessions()
        .filter((s) => s.owner === owner)
        .slice(0, limit)
        .map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messageCount: s.messages.length
        }));
}

export function getSession(sessionId) {
    const sessions = loadSessions();
    const session = findSession(sessions, sessionId);
    return session ? { ...session } : null;
}

export function deleteSession(sessionId) {
    const sessions = loadSessions();
    const next = sessions.filter((s) => s.id !== sessionId);
    if (next.length === sessions.length) return false;
    saveSessions(next);
    return true;
}

// Riwayat ringkas untuk konteks multi-turn: N pesan terakhir.
// Hanya {role, content} yang dikirim ke LLM (tanpa sources).
export function getRecentMessages(sessionId, maxTurns = 6) {
    const session = getSession(sessionId);
    if (!session) return [];
    return session.messages
        .slice(-maxTurns)
        .map((m) => ({
            role: m.role,
            content: m.content
        }));
}

// ====================================
// Pesan
// ====================================

// Menambahkan pesan; judul sesi diambil dari pesan user pertama.
export function appendMessage(sessionId, { role, content, sources, model }) {
    const sessions = loadSessions();
    const session = findSession(sessions, sessionId);
    if (!session) return null;

    const message = {
        id: newId("msg"),
        role,
        content: String(content || ""),
        sources: role === "assistant" ? (sources || []) : undefined,
        model: role === "assistant" ? model || null : undefined,
        feedback: null,
        createdAt: now()
    };

    session.messages.push(message);

    if (role === "user" && session.title === "Percakapan baru") {
        session.title = String(content || "Percakapan baru").slice(0, 200);
    }

    session.updatedAt = now();
    saveSessions(sessions);
    return { ...message, sessionId };
}

// ====================================
// Feedback
// ====================================

export function setFeedback(sessionId, messageId, rating, comment) {
    if (!["up", "down"].includes(rating)) {
        return { error: "Rating harus 'up' atau 'down'" };
    }
    const sessions = loadSessions();
    const session = findSession(sessions, sessionId);
    if (!session) return { error: "Sesi tidak ditemukan" };

    const message = session.messages.find((m) => m.id === messageId);
    if (!message) return { error: "Pesan tidak ditemukan" };

    message.feedback = {
        rating,
        comment: String(comment || "").slice(0, 500),
        at: now()
    };

    saveSessions(sessions);
    return { ok: true, messageId, rating };
}

// ====================================
// Statistik
// ====================================

export function chatStats() {
    const sessions = loadSessions();
    const messages = sessions.flatMap((s) => s.messages);

    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const feedbacks = messages.filter((m) => m.feedback);

    const today = new Date().toISOString().slice(0, 10);

    return {
        sessions: sessions.length,
        messages: messages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        sessionsToday: sessions.filter((s) => s.createdAt.slice(0, 10) === today).length,
        feedback: {
            up: feedbacks.filter((f) => f.feedback.rating === "up").length,
            down: feedbacks.filter((f) => f.feedback.rating === "down").length,
            total: feedbacks.length
        }
    };
}