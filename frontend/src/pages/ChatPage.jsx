import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { api, getUser, clearSession } from '../api.js';

export default function ChatPage() {

  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatEndRef = useRef(null);
  const chatAreaRef = useRef(null);
  const abortRef = useRef(null);

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() =>
    localStorage.getItem("cms_model") || "google/gemini-2.5-flash"
  );
  const [online, setOnline] = useState(null);
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef(null);

  // ----- Riwayat percakapan (multi sesi, localStorage) -----
  const [conversations, setConversations] = useState(() => loadConversations());
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeConvId;
  }, [activeConvId]);

  // Simpan seluruh riwayat ke localStorage setiap ada perubahan
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const currentMessages =
    conversations.find((c) => c.id === activeConvId)?.messages ?? [];

  const user = getUser();

  const suggestions = [
    "Bagaimana persepsi pasar Nigeria terhadap produk tekstil Indonesia?",
    "Bagaimana pasar game yang ada di Jepang sekarang?",
    "Bagaimana perkembangan industri restoran di Jepang?",
    "Bagaimana peluang ekspor alat kesehatan ke Jepang?"
  ];

  const topics = [
    { emoji: "🇳🇬", label: "Tekstil Nigeria" },
    { emoji: "🇯🇵", label: "Pasar Game Jepang" },
    { emoji: "🍜", label: "Restoran Jepang" },
    { emoji: "🏥", label: "Alat Medis Jepang" },
    { emoji: "💡", label: "Regulasi Perdagangan" }
  ];

  useEffect(() => {
    api("/api/models")
      .then((data) => {
        if (Array.isArray(data.models) && data.models.length) {
          setModels(data.models);
          if (!data.models.some((m) => m.id === model)) {
            setModel(data.default || data.models[0].id);
          }
        }
      })
      .catch(() => setModels([]));
  }, []);

  // Status koneksi backend untuk badge di header
  function refreshHealth() {
    setOnline(null);
    api("/api/health")
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }

  useEffect(() => {
    refreshHealth();
  }, []);

  // Tutup dropdown model saat klik di luar komponen
  useEffect(() => {
    function onClickOutside(e) {
      if (modelRef.current && !modelRef.current.contains(e.target)) {
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Simpan pilihan model
  useEffect(() => {
    localStorage.setItem("cms_model", model);
  }, [model]);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages, loading]);

  // Nama tampilan model yang sedang dipakai
  const currentModelLabel =
    models.find((m) => m.id === model)?.label ?? "…";

  // Nama pendek model aktif (bagian setelah "/")
  const currentModelShort =
    model.split("/").pop();

  // Warna badge per provider
  const currentModelBadge = providerBadge(model);

  function sourceTitle(sources, filename) {
    const source = sources.find((s) => s.filename === filename);
    const title = source?.title ?? "";
    if (title.trim()) return title;
    return filename;
  }

  // ---------- Helper percakapan ----------

  function updateMessages(fn) {
    const id = activeIdRef.current;
    if (!id) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, messages: fn(c.messages), updatedAt: Date.now() }
          : c
      )
    );
  }

  function ensureConversation() {
    if (activeIdRef.current) return activeIdRef.current;
    const id = newId();
    activeIdRef.current = id;
    setActiveConvId(id);
    setConversations((prev) => [
      {
        id,
        title: "Percakapan baru",
        model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      },
      ...prev
    ]);
    return id;
  }

  function listConversations() {
    return [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function selectConversation(id) {
    if (loading) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setModel(conv.model || model);
    setActiveConvId(id);
    activeIdRef.current = id;
    setSidebarOpen(false);
    setPreviewDoc(null);
  }

  function newConversation() {
    if (loading) return;
    setActiveConvId(null);
    activeIdRef.current = null;
    setSidebarOpen(false);
    setPreviewDoc(null);
  }

  function deleteConversation(id, e) {
    e?.stopPropagation();
    if (loading) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeIdRef.current === id) {
      setActiveConvId(null);
      activeIdRef.current = null;
    }
  }

  function deleteMessage(index) {
    if (loading) return;
    updateMessages((prev) => prev.filter((_, i) => i !== index));
    setCopied(null);
  }

  // ---------- Konsumsi jawaban streaming ----------

  function applyDelta(text, question) {
    updateMessages((prev) => {
      const i = prev.findIndex((m) => m.streaming);
      if (i !== -1) {
        return prev.map((m) => (m.streaming ? { ...m, text } : m));
      }
      return [
        ...prev,
        {
          role: "bot",
          text,
          sources: [],
          streaming: true,
          question,
          time: Date.now()
        }
      ];
    });
  }

  function finalizeStream(answer, sources, question) {
    updateMessages((prev) => {
      const i = prev.findIndex((m) => m.streaming);
      if (i === -1) {
        return [
          ...prev,
          {
            role: "bot",
            text: answer,
            sources: sources || [],
            streaming: false,
            question,
            time: Date.now()
          }
        ];
      }
      return prev.map((m) =>
        m.streaming
          ? {
              ...m,
              text: answer,
              sources: sources || [],
              streaming: false
            }
          : m
      );
    });
  }

  function removeStreamingMessage() {
    updateMessages((prev) => prev.filter((m) => !m.streaming));
  }

  // Jalankan permintaan chat; hasilnya streaming (SSE)
  async function consumeStream(message, mdl, question) {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    let completed = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model: mdl, stream: true }),
        signal: controller.signal
      });

      const ct = res.headers.get("content-type") || "";

      // Fallback: server tidak mendukung SSE -> tangani jawaban JSON
      if (!ct.includes("text/event-stream")) {
        const data = await res.json();
        const answer = data.reply ?? data.answer ?? data.error ?? "Tidak ada jawaban.";
        finalizeStream(answer, data.sources ?? [], question);
        completed = true;
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;

            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            if (data.type === "delta") {
              full += data.text || "";
              applyDelta(full, question);
            } else if (data.type === "done") {
              const ans = (data.answer ?? full).trim();
              finalizeStream(ans, data.sources ?? [], question);
              completed = true;
            } else if (data.type === "error") {
              const msg = "Terjadi kesalahan: " + (data.message || "server.");
              finalizeStream(msg, [], question);
              completed = true;
            }
          }
        }
      }

      // Streaming selesai tanpa event "done" -> tutup placeholder
      if (!completed) {
        finalizeStream(full.trim(), [], question);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        removeStreamingMessage();
      } else {
        finalizeStream("Terjadi kesalahan koneksi ke server.", [], question);
      }
    }

    abortRef.current = null;
    setLoading(false);
  }

  async function sendMessage(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;

    setInput("");
    const id = ensureConversation();
    const t = Date.now();

    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              model,
              title:
                c.messages.length
                  ? c.title
                  : text.length > 42
                    ? text.slice(0, 42) + "…"
                    : text
            }
          : c
      )
    );

    updateMessages((prev) => [
      ...prev,
      { role: "user", text, time: t }
    ]);

    await consumeStream(text, model, text);
  }

  // Tanya ulang: hapus jawaban bot lama, jawab lagi dengan model aktif
  async function reask(botIndex) {
    if (loading) return;
    const id = activeIdRef.current;
    if (!id) return;
    const conv = conversations.find((c) => c.id === id);
    const all = conv?.messages ?? [];
    const userMsg = [...all.slice(0, botIndex)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;

    const withoutBot = all.filter((_, idx) => idx !== botIndex);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, messages: withoutBot, updatedAt: Date.now() } : c
      )
    );

    await consumeStream(userMsg.text, model, userMsg.text);
  }

  // Batalkan proses AI yang sedang berjalan
  function stopAnswer() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  async function copyText(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard diblokir browser, abaikan
    }
  }

  // Deteksi posisi scroll chat area untuk tombol turun
  function onChatScroll() {
    const el = chatAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBtn(!nearBottom);
  }

  function scrollToBottom() {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function logout() {
    clearSession();
    navigate(0);
  }

  const streamingNow = currentMessages.some((m) => m.streaming);

  const previewUrl = previewDoc
    ? "/api/documents/" + encodeURIComponent(previewDoc.filename) +
      (previewDoc.pages && previewDoc.pages[0] ? "#page=" + previewDoc.pages[0] : "")
    : "";

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(180deg,#f6f7f9,#ffffff)",
        padding: isMobile ? "8px" : "18px",
        fontFamily: '"Inter", sans-serif',
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "auto",
          background: "#f1f5f9a5",
          borderRadius: isMobile ? "14px" : "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: isMobile ? "calc(100vh - 16px)" : "calc(100vh - 36px)"
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: "linear-gradient(135deg, #001845, #00439c)",
            color: "white",
            padding: isMobile ? "12px 16px" : "18px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
            flexWrap: isMobile ? "wrap" : "nowrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "16px", minWidth: 0 }}>
            <img
              src="/logo kemendag.png"
              alt="Logo Kemendag"
              style={{
                width: isMobile ? "44px" : "70px",
                height: isMobile ? "44px" : "70px",
                objectFit: "cover",
                background: "white",
                borderRadius: "10px",
                flexShrink: 0
              }}
            />
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? "16px" : "20px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: '"Sora", sans-serif' }}>
                AI Document Intelligence
              </h2>
              {!isMobile && (
                <p style={{ margin: "5px 0 0", fontSize: "14px", opacity: 0.9 }}>
                  Document Intelligence System - Kemendag
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: 0 }}>
            {!isMobile && (
              <span
                title="Status koneksi ke backend"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: online === null ? "#facc15" : online ? "#16a75c" : "#ff1c3e",
                    display: "inline-block"
                  }}
                />
                {online === null ? "Menghubungi server…" : online ? "Terhubung" : "Server tidak merespons"}
              </span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={navButtonStyle}
                title="Buka riwayat percakapan"
              >
                {isMobile ? "☰" : "☰ Riwayat"}
              </button>
              {user ? (
                <>
                  <button
                    onClick={() => navigate("/cms")}
                    style={navButtonStyle}
                  >
                    ⚙ CMS ({user.username})
                  </button>
                  <button
                    onClick={logout}
                    style={navButtonStyle}
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate("/cms/login")}
                  style={navButtonStyle}
                >
                  ⚙ Masuk CMS
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BANNER SERVER TIDAK MERESPONS */}
        {online === false && (
          <div
            className="fade-in"
            style={{
              background: "#fef3c7",
              color: "#92400e",
              borderBottom: "1px solid #fde68a",
              padding: isMobile ? "6px 12px" : "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexShrink: 0,
              fontSize: "13px",
              fontWeight: 600,
              flexWrap: "wrap"
            }}
          >
            <span>⚠️ Server tidak merespons — jawaban AI tidak dapat diproses saat ini.</span>
            <button
              onClick={refreshHealth}
              style={{
                background: "#ffffff",
                color: "#92400e",
                border: "1px solid #fcd34d",
                borderRadius: "8px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: 'inherit'
              }}
            >
              ↻ Coba lagi
            </button>
          </div>
        )}

        {/* CHAT AREA */}
        <div
          ref={chatAreaRef}
          onScroll={onChatScroll}
          className="chat-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "8px" : "12px",
            background: "#eef2f756",
            position: "relative"
          }}
        >
          {currentMessages.length === 0 && !loading && (
            <div className="fade-in" style={{ maxWidth: "720px", margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: "12px", paddingTop: "0" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <HeroArt />
                </div>
                <h2 style={{ margin: "0", fontSize: isMobile ? "22px" : "26px", fontWeight: 700, color: "#00439c", fontFamily: '"Sora", sans-serif' }}>
                  Selamat Datang ✨
                </h2>
                <p style={{ margin: "6px auto 0", fontSize: "15px", color: "#475569", lineHeight: "1.65", maxWidth: "540px" }}>
                  Sistem menjawab pertanyaan Anda berdasarkan dokumen perdagangan resmi yang telah disetujui,
                  lengkap dengan referensi sumber halaman.
                </p>
              </div>

              <h4 style={{ margin: "0 0 10px", color: "#1e293b", fontWeight: 600, fontSize: "15px", fontFamily: '"Sora", sans-serif' }}>
                Pilih Topik
              </h4>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
                {topics.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(t.label + " — apakah ada informasi terkait?" )}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 14px",
                      borderRadius: "20px",
                      border: "1px solid #E8F2F8",
                      background: "#ffffff",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "#334155",
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: "transform 0.15s ease, box-shadow 0.15s ease"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,114,188,0.18)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <h4 style={{ margin: "0 0 10px", color: "#1e293b", fontWeight: 600, fontSize: "15px", fontFamily: '"Sora", sans-serif' }}>
                Contoh Pertanyaan
              </h4>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                  gap: "10px"
                }}
              >
                {suggestions.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(item)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid #E8F2F8",
                      background: "#ffffff",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "#334155",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      fontFamily: 'inherit',
                      minHeight: "58px"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,114,188,0.18)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)"; }}
                  >
                    <span
                      style={{
                        background: "#E8F2F8",
                        color: "#00439c",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </span>
                    <span style={{ lineHeight: "1.45" }}>
                      {item}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentMessages.map((m, index) => {

            const sep =
              index === 0 ||
              !sameDay(m.time, currentMessages[index - 1].time);

            const showTyping = m.streaming && !m.text;

            return (
              <div key={index}>
                {sep && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      margin: "10px 0 4px"
                    }}
                  >
                    <span
                      style={{
                        background: "#e2e8f0cc",
                        color: "#64748b",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: "20px"
                      }}
                    >
                      {dateLabel(m.time)}
                    </span>
                  </div>
                )}

                <div
                  className="msg-in"
                  style={{
                    display: "flex",
                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    padding: "10px 18px",
                    gap: "10px"
                  }}
                >
                  {m.role === "bot" && (
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        flexShrink: 0,
                        background: "linear-gradient(135deg,#001845,#00439c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        alignSelf: "flex-start",
                        animation: m.streaming ? "pulseRing 1.5s infinite" : "none"
                      }}
                    >
                      🤖
                    </div>
                  )}

                  {showTyping ? (
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "14px 18px",
                        borderRadius: "18px 18px 18px 4px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        minWidth: "230px"
                      }}
                    >
                      <ProcessingIndicator />
                      <SourceSkeleton />
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: isMobile ? "85%" : "76%",
                        background: m.role === "user" ? "#E8F2F8" : "#f8fafc",
                        padding: "11px 16px",
                        borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        borderLeft: m.role === "bot" ? "4px solid #00439c" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                        <b style={{ fontSize: "14px", color: m.role === "user" ? "#00439c" : "#111827" }}>
                          {m.role === "user" ? "Anda" : "AI · " + currentModelLabel}
                          {m.streaming && (
                            <span style={{ fontSize: "11px", color: "#00439c", marginLeft: "8px", fontWeight: 600 }} className="blink">
                              ● mengetik
                            </span>
                          )}
                          {m.time && (
                            <span style={{ fontWeight: 400, fontSize: "11px", color: "#94a3b8", marginLeft: "8px" }}>
                              {new Date(m.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </b>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => deleteMessage(index)}
                            title="Hapus pesan"
                            style={miniActionStyle}
                          >
                            ✕
                          </button>
                          {m.role === "bot" && !m.streaming && (
                            <>
                              <button
                                onClick={() => copyText(m.text, index)}
                                title={copied === index ? "Tersalin!" : "Salin jawaban"}
                                style={miniActionStyle}
                              >
                                {copied === index ? "✓" : "⧉"}
                              </button>
                              <button
                                onClick={() => reask(index)}
                                title="Ulangi pertanyaan (model berbeda)"
                                style={miniActionStyle}
                              >
                                ↻
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: "8px", lineHeight: "1.55", fontSize: "14px" }}>
                        {m.role === "user"
                          ? m.text
                          : (
                            <ReactMarkdown
                              components={{
                                a: (props) => (
                                  <CiteAnchor
                                    {...props}
                                    sources={m.sources}
                                    onOpen={setPreviewDoc}
                                  />
                                )
                              }}
                            >
                              {withCitations(m.text)}
                            </ReactMarkdown>
                          )}
                      </div>

                      {m.role === "bot" && m.streaming && m.text && (
                        <SourceSkeleton />
                      )}

                      {m.role === "bot" && !m.streaming && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <button
                            onClick={() => setFeedback((prev) => ({ ...prev, [index]: prev[index] === "up" ? null : "up" }))}
                            title="Jawaban membantu"
                            style={{
                              ...miniActionStyle,
                              background: feedback[index] === "up" ? "#dcfce7" : "transparent",
                              borderColor: feedback[index] === "up" ? "#16a75c" : "#e2e8f0",
                              color: feedback[index] === "up" ? "#16a75c" : "#64748b"
                            }}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => setFeedback((prev) => ({ ...prev, [index]: prev[index] === "down" ? null : "down" }))}
                            title="Jawaban kurang membantu"
                            style={{
                              ...miniActionStyle,
                              background: feedback[index] === "down" ? "#fee2e2" : "transparent",
                              borderColor: feedback[index] === "down" ? "#ff1c3e" : "#e2e8f0",
                              color: feedback[index] === "down" ? "#ff1c3e" : "#64748b"
                            }}
                          >
                            👎
                          </button>
                        </div>
                      )}

                      {m.role === "bot" && !m.streaming && m.sources && m.sources.length > 0 && (
                        <div
                          style={{
                            marginTop: "15px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e2e8f0",
                            fontSize: "13px"
                          }}
                        >
                          <b style={{ color: "#00439c", fontSize: "13px" }}>📚 Sumber Referensi</b>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                            Klik kartu untuk membuka dokumen, atau klik nomor halaman.
                          </div>
                          {Object.entries(
                            (m.sources || []).reduce((acc, source) => {
                              if (!acc[source.filename]) {
                                acc[source.filename] = { pages: [], distance: Infinity };
                              }
                              acc[source.filename].pages.push(source.page);
                              if (typeof source.distance === "number") {
                                acc[source.filename].distance = Math.min(
                                  acc[source.filename].distance,
                                  source.distance
                                );
                              }
                              return acc;
                            }, {})
                          ).map(([filename, info]) => {
                            const uniqPages = [...new Set(info.pages)].slice(0, 5);
                            const confidence = confidenceOf(info.distance);
                            return (
                              <div
                                key={filename}
                                role="button"
                                tabIndex={0}
                                onClick={() => setPreviewDoc({ filename, pages: uniqPages })}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreviewDoc({ filename, pages: uniqPages }); } }}
                                title={`Buka ${filename}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  width: "100%",
                                  marginTop: "8px",
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "10px",
                                  padding: "8px 12px",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  fontSize: "13px",
                                  color: "#334155",
                                  fontFamily: 'inherit',
                                  transition: "transform 0.15s ease, box-shadow 0.15s ease"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,114,188,0.15)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                              >
                                <span style={{ fontSize: "16px", flexShrink: 0 }}>📄</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {sourceTitle(m.sources, filename)}
                                  </div>
                                  <div style={{ color: "#64748b", fontSize: "12px", marginTop: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
                                    <span>Halaman:</span>
                                    {uniqPages.map((p) => (
                                      <button
                                        key={p}
                                        onClick={(e) => { e.stopPropagation(); setPreviewDoc({ filename, pages: [p] }); }}
                                        title={`Buka halaman ${p}`}
                                        style={pageChipStyle}
                                      >
                                        {p}
                                      </button>
                                    ))}
                                  </div>
                                  {confidence !== null && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px" }}>
                                      <span style={{ fontSize: "11px", color: "#64748b" }}>Kecocokan sumber:</span>
                                      <div style={{ width: "56px", height: "5px", borderRadius: "4px", background: "#e2e8f0", overflow: "hidden" }}>
                                        <div
                                          style={{
                                            width: `${confidence}%`,
                                            height: "100%",
                                            background: confidence >= 70 ? "#16a75c" : confidence >= 45 ? "#ff9f1c" : "#ff1c3e",
                                            borderRadius: "4px"
                                          }}
                                        />
                                      </div>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>{confidence}%</span>
                                    </div>
                                  )}
                                </div>
                                <span style={{ color: "#00439c", fontSize: "12px", flexShrink: 0 }}>Buka ↗</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {m.role === "user" && (
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        flexShrink: 0,
                        background: "#e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "17px",
                        alignSelf: "flex-start"
                      }}
                    >
                      👤
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && !streamingNow && (
            <div
              className="msg-in"
              style={{ display: "flex", justifyContent: "flex-start", padding: "10px 18px", gap: "10px" }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "12px",
                  flexShrink: 0,
                  background: "linear-gradient(135deg,#001845,#00439c)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  animation: "pulseRing 1.5s infinite"
                }}
              >
                🤖
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  padding: "14px 18px",
                  borderRadius: "18px 18px 18px 4px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  minWidth: "230px"
                }}
              >
                <ProcessingIndicator />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />

          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              title="Kembali ke pesan terbaru"
              className="pop-in"
              style={{
                position: "sticky",
                bottom: "12px",
                margin: "0 auto",
                display: "block",
                background: "#00439c",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                fontSize: "18px",
                boxShadow: "0 4px 14px rgba(0,114,188,0.35)"
              }}
            >
              ↓
            </button>
          )}
        </div>

        {/* MODAL PREVIEW PDF SUMBER */}
        {previewDoc && (
          <div
            onClick={() => setPreviewDoc(null)}
            className="fade-in"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 30,
              padding: "24px"
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pop-in"
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "900px",
                height: "85vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "14px 20px",
                  background: "linear-gradient(135deg,#001845,#00439c)",
                  color: "white",
                  flexShrink: 0
                }}
              >
                <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "14px", fontWeight: 600 }}>
                  📄 {previewDoc.filename}
                  {previewDoc.pages && previewDoc.pages.length > 0 && (
                    <span style={{ fontSize: "12px", opacity: 0.85 }}> · hlm. {previewDoc.pages.join(", ")}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.5)",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      textDecoration: "none",
                      fontWeight: 600
                    }}
                  >
                    Buka tab baru ↗
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.5)",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: 'inherit',
                      fontWeight: 600
                    }}
                  >
                    ✕ Tutup
                  </button>
                </div>
              </div>
              <iframe
                src={previewUrl}
                title={previewDoc.filename}
                style={{ flex: 1, border: "none", background: "#52525b" }}
              />
            </div>
          </div>
        )}

        {/* INPUT AREA */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: isMobile ? "10px" : "15px",
            borderTop: "1px solid #ddd",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: "wrap",
            flexShrink: 0,
            background: "#ffffff"
          }}
        >
          <div ref={modelRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              title="Pilih model AI"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "12px",
                border: modelOpen ? "1px solid #00439c" : "1px solid #cbd5e1",
                fontSize: "13px",
                background: modelOpen ? "#eef6fd" : "#fff",
                color: "#1e293b",
                outline: "none",
                cursor: "pointer",
                fontFamily: 'inherit',
                boxShadow: modelOpen ? "0 4px 14px rgba(0,114,188,0.2)" : "none",
                maxWidth: isMobile ? "180px" : "230px"
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "15px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "26px",
                  height: "26px",
                  borderRadius: "8px",
                  background: currentModelBadge.background,
                  color: currentModelBadge.color
                }}
              >
                ⌬
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 600
                }}
              >
                {currentModelShort}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  marginLeft: "auto",
                  color: "#64748b",
                  transform: modelOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease"
                }}
              >
                ▼
              </span>
            </button>

            {modelOpen && (
              <div
                className="pop-in"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  minWidth: "280px",
                  maxWidth: "min(320px, calc(100vw - 40px))",
                  background: "#ffffff",
                  borderRadius: "14px",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                  border: "1px solid #e2e8f0",
                  padding: "8px",
                  zIndex: 20,
                  maxHeight: isMobile ? "55vh" : "none",
                  overflowY: isMobile ? "auto" : "visible"
                }}
              >
                <div
                  style={{
                    padding: "8px 10px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}
                >
                  Pilih Model AI
                </div>
                {models.map((m) => {
                  const badge = providerBadge(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setModelOpen(false); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: "10px",
                        border: "none",
                        background: m.id === model ? "#eef6fd" : "transparent",
                        cursor: "pointer",
                        fontFamily: 'inherit',
                        color: "#1e293b"
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: "14px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          background: badge.background,
                          color: badge.color,
                          fontWeight: 700
                        }}
                      >
                        ⌬
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.id.split("/").pop()}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.label}
                        </div>
                      </div>
                      {m.id === model && (
                        <span style={{ color: "#00439c", fontSize: "14px", flexShrink: 0 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
            placeholder={loading
              ? "AI sedang menjawab…"
              : "Tanyakan informasi perdagangan…"}
            style={{
              flex: 1,
              minWidth: "180px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none",
              fontFamily: 'inherit',
              background: loading ? "#f1f5f9" : "#fff",
              color: loading ? "#94a3b8" : "#1e293b"
            }}
          />

          <button
            onClick={loading ? stopAnswer : () => sendMessage()}
            title={loading ? "Hentikan jawaban AI" : "Kirim pertanyaan"}
            style={{
              background: loading ? "#ff1c3e" : "#00439c",
              color: "white",
              border: "none",
              padding: "0 16px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
              height: "38px",
              fontFamily: 'inherit',
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minWidth: "108px"
            }}
          >
            {loading ? (
              <>
                <span style={{ fontSize: "14px", lineHeight: 1 }}>⏹</span>
                Hentikan
              </>
            ) : (
              "Kirim"
            )}
          </button>
        </div>

        {/* FOOTER */}
        {!isMobile && (
          <div
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: "#94a3b8",
              background: "#ffffff",
              borderTop: "1px solid #eef2f7",
              padding: "8px 16px",
              flexShrink: 0
            }}
          >
            Jawaban AI dapat mengandung ketidakakuratan. Verifikasi selalu dengan dokumen sumber.
          </div>
        )}
      </div>

      {/* SIDEBAR RIWAYAT PERCAKAPAN */}
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            className="fade-in"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              zIndex: 40
            }}
          />
          <aside
            className="slide-in-left"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(320px, 88vw)",
              background: "#f8fafc",
              zIndex: 41,
              boxShadow: "0 0 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg,#001845,#00439c)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <b style={{ fontSize: "15px", fontFamily: '"Sora", sans-serif' }}>💬 Riwayat Percakapan</b>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.5)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: 'inherit',
                  fontWeight: 600
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "12px 14px" }}>
              <button
                onClick={newConversation}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #E8F2F8",
                  color: "#00439c",
                  borderRadius: "12px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: 'inherit',
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
                }}
              >
                ＋ Percakapan Baru
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px 14px" }}>
              {listConversations().length === 0 && (
                <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", marginTop: "24px" }}>
                  Belum ada percakapan. Mulai tanya sesuatu! ✨
                </p>
              )}
              {listConversations().map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    marginTop: "6px",
                    borderRadius: "10px",
                    border: activeConvId === c.id ? "1px solid #00439c" : "1px solid transparent",
                    background: activeConvId === c.id ? "#eef6fd" : "#ffffff",
                    cursor: "pointer",
                    fontFamily: 'inherit',
                    color: "#1e293b",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
                  }}
                >
                  <span style={{ fontSize: "16px", flexShrink: 0 }}>💬</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {c.title || "Percakapan baru"}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginTop: 2 }}>
                      {c.messages.length} pesan · {new Date(c.updatedAt || c.createdAt).toLocaleDateString("id-ID")}
                    </span>
                  </span>
                  <span
                    role="button"
                    title="Hapus percakapan"
                    onClick={(e) => deleteConversation(c.id, e)}
                    style={{
                      flexShrink: 0,
                      color: "#94a3b8",
                      fontSize: "14px",
                      padding: "2px 6px",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ff1c3e"; e.currentTarget.style.background = "#fee2e2"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "transparent"; }}
                  >
                    ✕
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

const navButtonStyle = {
  background: "rgba(255,255,255,0.15)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.5)",
  padding: "10px 14px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "14px",
  whiteSpace: "nowrap",
  fontFamily: 'inherit'
};

const miniActionStyle = {
  background: "transparent",
  border: "1px solid #e2e8f0",
  color: "#64748b",
  borderRadius: "8px",
  width: "28px",
  height: "28px",
  cursor: "pointer",
  fontSize: "14px",
  lineHeight: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: 'inherit'
};

// Warna aksen kecil untuk ikon model berdasarkan provider.
function providerBadge(modelId) {
  if (modelId.startsWith("google/")) return { background: "#e0f2fe", color: "#0369a1" };
  if (modelId.startsWith("openai/")) return { background: "#d1fae5", color: "#047857" };
  if (modelId.startsWith("meta-llama/")) return { background: "#fef3c7", color: "#b45309" };
  if (modelId.startsWith("anthropic/")) return { background: "#fce7f3", color: "#be185d" };
  return { background: "#eef2f7", color: "#475569" };
}

// ---------- Helper localStorage & topik ----------

const CONV_KEY = "cms_conversations_v1";

function loadConversations() {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveConversations(list) {
  try {
    localStorage.setItem(CONV_KEY, JSON.stringify(list));
  } catch {
    // penyimpanan penuh / diblokir, abaikan
  }
}

function newId() {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

function dateLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// ---------- Komponen & helper tampilan tambahan ----------

// Siklus indeks untuk teks langkah yang bergiliran
function useCycle(steps, ms) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % steps.length), ms);
    return () => clearInterval(id);
  }, [steps.length, ms]);
  return steps[idx];
}

// Indikator "AI sedang bekerja" dengan langkah bergiliran
const PROCESS_STEPS = [
  "Mencari dokumen…",
  "Membaca halaman…",
  "Menyusun jawaban…"
];

function ProcessingIndicator() {
  const step = useCycle(PROCESS_STEPS, 1500);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ fontSize: "14px", color: "#334155", whiteSpace: "nowrap", fontWeight: 600 }}>
        {step}
      </div>
      <div className="typing-dots" style={{ marginTop: 0 }}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

// Kartu sumber "samar" (skeleton berkilau) saat AI mengetik
function SourceSkeleton() {
  return (
    <div className="fade-in" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600, marginBottom: "8px" }}>
        🔍 Memeriksa dokumen sumber…
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
            background: "#ffffff",
            border: "1px solid #eef2f7",
            borderRadius: "10px",
            padding: "8px 12px"
          }}
        >
          <div className="skeleton" style={{ width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="skeleton" style={{ height: "11px", width: "70%", marginBottom: "5px" }} />
            <div className="skeleton" style={{ height: "9px", width: "45%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Ilustrasi hero layar selamat datang
function HeroArt() {
  return (
    <svg width="120" height="82" viewBox="0 0 150 110" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "2px" }}>
      <circle cx="75" cy="55" r="52" fill="#E8F2F8" />
      <circle cx="75" cy="55" r="52" fill="url(#heroSoft)" opacity="0.6" />
      <rect x="32" y="30" width="40" height="52" rx="7" fill="#ffffff" stroke="#93c5fd" strokeWidth="2" transform="rotate(-8 32 30)" />
      <line x1="40" y1="42" x2="63" y2="40" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="50" x2="63" y2="48" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="58" x2="58" y2="56" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      <rect x="74" y="24" width="40" height="52" rx="7" fill="#ffffff" stroke="#60a5fa" strokeWidth="2" transform="rotate(6 74 24)" />
      <line x1="82" y1="36" x2="105" y2="38" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <line x1="82" y1="44" x2="105" y2="46" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <line x1="82" y1="52" x2="99" y2="54" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <circle cx="112" cy="52" r="17" fill="#ffffff" stroke="#00439c" strokeWidth="4" transform="rotate(0 112 52)" />
      <line x1="125" y1="65" x2="136" y2="76" stroke="#00439c" strokeWidth="4" strokeLinecap="round" />
      <text x="64" y="103" fontSize="20" fill="#3b82f6" fontFamily="inherit">✦</text>
      <text x="132" y="30" fontSize="14" fill="#60a5fa" fontFamily="inherit">✦</text>
      <defs>
        <radialGradient id="heroSoft" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Konversi teks jawaban agar [n] jadi tautan kutipan
function withCitations(text) {
  if (!text) return text;
  return text.replace(/\[(\d+)\]/g, (m, n) => `[[${n}]](/cite/${parseInt(n, 10) - 1})`);
}

// Skor kepastian dari jarak vektor (semakin kecil jarak, semakin relevan)
function confidenceOf(distance) {
  if (distance === undefined || distance === null) return null;
  const d = Math.max(0, Math.min(1, distance));
  return Math.round((1 - d) * 100);
}

const citeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#e0f2fe",
  color: "#00439c",
  border: "1px solid #bae6fd",
  borderRadius: "6px",
  padding: "0 5px",
  margin: "0 2px",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "16px",
  cursor: "pointer",
  verticalAlign: "0.45em",
  fontFamily: 'inherit'
};

const pageChipStyle = {
  background: "#eef2f7",
  color: "#334155",
  border: "1px solid #d3dce6",
  borderRadius: "6px",
  padding: "0 7px",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "18px",
  cursor: "pointer",
  fontFamily: 'inherit'
};

// Komponen tautan milik ReactMarkdown:
// - /cite/<idx> => tombol buka dokumen sumber
// - selain itu tautan biasa
function CiteAnchor({ href, children, sources, onOpen, node, ...rest }) {
  if (href && href.startsWith("/cite/")) {
    const idx = parseInt(href.slice(6).split("/")[0], 10);
    const src = sources?.[idx];
    if (!src) return <span>{children}</span>;
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          onOpen({ filename: src.filename, pages: [src.page] });
        }}
        title={`Buka ${src.filename} hlm. ${src.page}`}
        style={citeStyle}
      >
        {children}
      </button>
    );
  }
  return <a href={href} {...rest}>{children}</a>;
}