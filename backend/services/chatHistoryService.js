import { readJson, writeJson } from "./storeService.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_FOLDER } from "../config.js";

const STORE = "chats";

function now() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

let _sessionsCache = null;
let _sessionsCacheFP = "";
let _sessionsCacheTime = 0;
const _CACHE_TTL = 4000;

function _fp() {
    try {
        const p = path.join(DATA_FOLDER, STORE + ".json");
        return fs.existsSync(p) ? String(fs.statSync(p).mtimeMs) : "0";
    } catch { return "0"; }
}

function loadSessions() {
    const fp = _fp();
    if (_sessionsCache && fp === _sessionsCacheFP && Date.now() - _sessionsCacheTime < _CACHE_TTL) {
        return _sessionsCache;
    }
    const data = readJson(STORE, []);
    const arr = Array.isArray(data)
        ? data.filter((s) => s && typeof s === "object" && s.id)
        : [];
    _sessionsCache = arr;
    _sessionsCacheFP = fp;
    _sessionsCacheTime = Date.now();
    return arr;
}

function saveSessions(sessions) {
    _sessionsCache = sessions;
    _sessionsCacheFP = _fp();
    _sessionsCacheTime = Date.now();
    writeJson(STORE, sessions);

    _sessionsCacheFP = _fp();
}

function findSession(sessions, sessionId) {
    if (!sessionId) return null;
    return sessions.find((s) => s && s.id === sessionId) || null;
}

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

export function getOrCreateSession(owner, sessionId) {
    if (sessionId) {
        const sessions = loadSessions();
        const existing = findSession(sessions, sessionId);
        if (existing) return existing;
    }
    return createSession(owner, "Percakapan baru");
}

export function listSessions(owner, limit = 50) {
    return loadSessions()
        .filter((s) => s && s.owner === owner && Array.isArray(s.messages))
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
    const next = sessions.filter((s) => s && s.id !== sessionId);
    if (next.length === sessions.length) return false;
    saveSessions(next);
    return true;
}

export function getRecentMessages(sessionId, maxTurns = 6) {
    const session = getSession(sessionId);
    if (!session || !Array.isArray(session.messages)) return [];
    return session.messages
        .slice(-maxTurns)
        .map((m) => ({
            role: m.role,
            content: m.content
        }));
}

export function appendMessage(sessionId, { role, content, sources, model, conversational }) {
    const sessions = loadSessions();
    const session = findSession(sessions, sessionId);
    if (!session) return null;
    if (!Array.isArray(session.messages)) session.messages = [];

    const message = {
        id: newId("msg"),
        role,
        content: String(content || ""),
        sources: role === "assistant" ? (sources || []) : undefined,
        model: role === "assistant" ? model || null : undefined,
        conversational: role === "assistant" ? (conversational || false) : undefined,
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

export function chatStats() {
    const sessions = loadSessions().filter((s) => s && Array.isArray(s.messages));
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
