import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { api, getUser, clearSession } from '../api.js';
import { createTheme, FONT_HEADING, FONT_BODY } from '../theme.js';

export default function ChatPage() {

  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [fbComment, setFbComment] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgIndex, setNewMsgIndex] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [cmsBtnVariant, setCmsBtnVariant] = useState(() => localStorage.getItem("cms_btn_variant_v2") || "chip");
  const [cmsBtnLabel, setCmsBtnLabel] = useState(() => localStorage.getItem("cms_btn_label_v2") || "Panel Admin");

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("cms_theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });

  // Palet warna tema (light/dark) — satu sumber warna dari theme.js.
  const t = createTheme(dark);

  useEffect(() => {
    localStorage.setItem("cms_theme", dark ? "dark" : "light");
    document.body.classList.toggle("theme-dark", dark);
  }, [dark]);

  useEffect(() => { localStorage.setItem("cms_btn_variant_v2", cmsBtnVariant); }, [cmsBtnVariant]);
  useEffect(() => { localStorage.setItem("cms_btn_label_v2", cmsBtnLabel); }, [cmsBtnLabel]);

  const cmsGearIcon = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
  const cmsPersonIcon = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );

  const iconStroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const IconFile = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
  const IconChat = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
  const IconBot = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M2 14h2M20 14h2" />
      <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
  const IconUser = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
  const IconCopy = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
  const IconCheck = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
  const IconTrash = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
  const IconRefresh = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
  const IconSend = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
  const IconStop = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
  const IconDownload = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
  const IconX = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
  const IconArrowDown = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
  const IconFileText = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8M16 13H8M16 17H8" />
    </svg>
  );
  const IconDoc = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
  const IconSearch = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
  const IconWarning = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
  const IconBook = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
  const IconMenu = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
  const IconPlus = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
  const IconThumbsUp = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
  const IconThumbsDown = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
  const IconCloud = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
  const IconHardDrive = (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...iconStroke}>
      <path d="M22 12H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  );

  function cmsEntryButton(dark, variant, label, onClick, title) {
    const base = { cursor: "pointer", fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", flexShrink: 0 };
    if (variant === "solid-gold") {
      return (
        <button onClick={onClick} title={title} style={{ ...base, background: "linear-gradient(135deg,#f6c453,#e9a319)", color: "#0b1e3a", border: "none", padding: "10px 16px", borderRadius: "10px", boxShadow: "0 4px 14px rgba(233,163,25,0.45)" }}>
          {cmsGearIcon(15)}
          {label}
        </button>
      );
    }
    if (variant === "icon-only") {
      return (
        <button onClick={onClick} title={title} aria-label={label} style={{ ...base, background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))", color: "white", border: "1px solid rgba(255,255,255,0.45)", width: "42px", height: "42px", padding: "0", borderRadius: "10px" }}>
          {cmsGearIcon(18)}
        </button>
      );
    }
    if (variant === "chip") {
      return (
        <button onClick={onClick} title={title} style={{ ...base, background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))", color: "white", border: "1px solid rgba(255,255,255,0.45)", padding: "4px 10px 4px 6px", borderRadius: "16px", fontSize: "12px", gap: "6px" }}>
          <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "linear-gradient(135deg,#f6c453,#e9a319)", color: "#0b1e3a", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{cmsPersonIcon(11)}</span>
          {label}
        </button>
      );
    }
    return (
      <button onClick={onClick} title={title} style={{ ...base, background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))", color: "white", border: "1px solid rgba(255,255,255,0.45)", padding: "10px 14px", borderRadius: "10px" }}>
        {cmsGearIcon(15)}
        {label}
      </button>
    );
  }

  const chatEndRef = useRef(null);
  const chatAreaRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const heroInputRef = useRef(null);

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() =>
    localStorage.getItem("cms_model") || "google/gemini-2.5-flash"
  );
  const [online, setOnline] = useState(null);

  // ----- Riwayat percakapan (multi sesi, localStorage) -----
  const [conversations, setConversations] = useState(() => loadConversations());
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeIdRef = useRef(null);
  const [historyQuery, setHistoryQuery] = useState("");

  useEffect(() => {
    activeIdRef.current = activeConvId;
  }, [activeConvId]);

  // Simpan seluruh riwayat ke localStorage setiap ada perubahan
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // ----- Sinkron riwayat dengan server (chats.json di backend) -----
  // clientId persisten per browser -> sesi tamu aman antar refresh/perangkat.
  const clientId = getClientId();

  useEffect(() => {
    api("/api/chat/history?clientId=" + encodeURIComponent(clientId))
      .then((data) => {
        if (!Array.isArray(data.sessions) || data.sessions.length === 0) return;
        setConversations((prev) => {
          const known = new Set(prev.map((c) => c.sessionId).filter(Boolean));
          const server = data.sessions
            .map((s) => ({
              id: "srv_" + s.id,
              sessionId: s.id,
              title: s.title || "Percakapan baru",
              createdAt: Date.parse(s.createdAt) || Date.now(),
              updatedAt: Date.parse(s.updatedAt) || Date.now(),
              messages: [],
              msgCount: s.messageCount || 0
            }))
            .filter((s) => !known.has(s.sessionId));
          return server.length ? [...prev, ...server] : prev;
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const currentMessages =
    conversations.find((c) => c.id === activeConvId)?.messages ?? [];

  const user = getUser();

  // Frasa yang diketik di halaman awal (berotasi, satu efek ketik).
  const typedPhrases = [
    "Menjawab dari dokumen perdagangan resmi, disertai referensi sumber dokumen.",
    "Mencari jawaban dari dokumen yang tersedia, lengkap dengan referensinya.",
    "Pertanyaan terjawab dengan konteks dari dokumen resmi Kemendag."
  ];

  // Pertanyaan contoh di halaman awal (klik langsung terkirim, jawaban ada di dokumen).
  const exampleQuestions = [
    "Bagaimana tahapan mendirikan restoran di Jepang?",
    "Siapa pemasok terbesar kain Ankara ke Nigeria?",
    "Apa saja persyaratan impor decoration lights ke Nigeria?"
  ];

  const [suggestionIdx, setSuggestionIdx] = useState(0);
  useEffect(() => {
    if (online !== true) return;
    const iv = setInterval(() => setSuggestionIdx((i) => (i + 1) % exampleQuestions.length), 2600);
    return () => clearInterval(iv);
  }, [online]);

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

  // Simpan pilihan model
  useEffect(() => {
    localStorage.setItem("cms_model", model);
  }, [model]);

  // Auto-scroll halus ke pesan terbaru (hanya jika user berada di dekat bawah)
  useEffect(() => {
    const el = chatAreaRef.current;
    if (el) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom && chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [currentMessages, loading]);

  // Shortcut fokus input: Ctrl+K atau "/" (di luar kotak ketik)
  useEffect(() => {
    function onKeyDown(e) {
      const target = e.target;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const targetInput = currentMessages.length > 0 || loading ? inputRef : heroInputRef;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        targetInput.current?.focus();
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        targetInput.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentMessages.length, loading]);

  function sourceTitle(sources, filename) {
    return filename;
  }

  // ---------- Helper percakapan ----------

  // Sesuaikan tinggi textarea input agar tidak perlu scroll manual.
  function autoResizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

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

  // Riwayat yang ditampilkan, difilter oleh kata kunci pencarian.
  function filteredHistory() {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return listConversations();
    return listConversations().filter((c) =>
      (c.title || "Percakapan baru").toLowerCase().includes(q) ||
      (c.messages || []).some((m) =>
        typeof m.text === "string" && m.text.toLowerCase().includes(q)
      )
    );
  }

  function selectConversation(id) {
    if (loading) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setModel(conv.model || model);
    // Sesi server yang belum pernah dibuka: muat isi percakapan dari backend.
    if (conv.sessionId && conv.messages.length === 0) {
      api("/api/chat/history/" + conv.sessionId)
        .then((data) => {
          const msgs = (data.session?.messages || []).map((m) => ({
            role: m.role === "assistant" ? "bot" : "user",
            text: m.content || "",
            sources: m.sources || [],
            model: m.model || conv.model || model,
            time: Date.parse(m.createdAt) || Date.now(),
            messageId: m.id,
            feedback: m.feedback || null,
            streaming: false
          }));
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, messages: msgs } : c))
          );
          // Pulihkan feedback yang sudah pernah diberikan (dari server).
          const restored = {};
          for (const m of msgs) {
            if (m.feedback) restored["m" + m.messageId] = { rating: m.feedback.rating, comment: m.feedback.comment || "" };
          }
          if (Object.keys(restored).length) setFeedback((prev) => ({ ...prev, ...restored }));
        })
        .catch(() => {});
    }
    setActiveConvId(id);
    activeIdRef.current = id;
    setSidebarOpen(false);
    setConfirmDeleteId(null);
    setPreviewDoc(null);
  }

  function newConversation() {
    if (loading) return;
    setActiveConvId(null);
    activeIdRef.current = null;
    setSidebarOpen(false);
    setConfirmDeleteId(null);
    setPreviewDoc(null);
    setNewMsgIndex(null);
  }

  function deleteConversation(id, e) {
    e?.stopPropagation();
    if (loading) return;
    const conv = conversations.find((c) => c.id === id);
    if (conv?.sessionId) {
      api("/api/chat/history/" + conv.sessionId, { method: "DELETE" }).catch(() => {});
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeIdRef.current === id) {
      setActiveConvId(null);
      activeIdRef.current = null;
    }
    setConfirmDeleteId(null);
  }

  function deleteMessage(index) {
    if (loading) return;
    updateMessages((prev) => prev.filter((_, i) => i !== index));
    setCopied(null);
  }

  // ---------- Konsumsi jawaban streaming ----------

  function applyDelta(text, question, mdl) {
    updateMessages((prev) => {
      const i = prev.findIndex((m) => m.streaming);
      if (i !== -1) {
        return prev.map((m) => (m.streaming ? { ...m, text, model: mdl } : m));
      }
      return [
        ...prev,
        {
          role: "bot",
          text,
          sources: [],
          streaming: true,
          question,
          model: mdl,
          time: Date.now()
        }
      ];
    });
  }

  function finalizeStream(answer, sources, question, mdl) {
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
            model: mdl,
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
              streaming: false,
              model: mdl
            }
          : m
      );
    });
  }

  function removeStreamingMessage() {
    updateMessages((prev) => prev.filter((m) => !m.streaming));
  }

  // Jalankan permintaan chat; hasilnya streaming (SSE)
  async function consumeStream(message, mdl, question, convId) {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    let completed = false;

    // Ikatan ke sesi server (bila percakapan sudah punya sessionId).
    const conv = conversations.find((c) => c.id === convId);
    const body = {
      message,
      model: mdl,
      stream: true,
      clientId,
      ...(conv?.sessionId ? { sessionId: conv.sessionId } : {})
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const ct = res.headers.get("content-type") || "";

      // Fallback: server tidak mendukung SSE -> tangani jawaban JSON
      if (!ct.includes("text/event-stream")) {
        const data = await res.json();
        const answer = data.reply ?? data.answer ?? data.error ?? "Tidak ada jawaban.";
        finalizeStream(answer, data.sources ?? [], question, mdl);
        if (data.sessionId) attachSessionInfo(convId, data.sessionId, data.messageId);
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
              applyDelta(full, question, mdl);
            } else if (data.type === "done") {
              const ans = (data.answer ?? full).trim();
              finalizeStream(ans, data.sources ?? [], question, mdl);
              if (data.sessionId) attachSessionInfo(convId, data.sessionId, data.messageId);
              completed = true;
            } else if (data.type === "error") {
              const msg = "Terjadi kesalahan: " + (data.message || "server.");
              finalizeStream(msg, [], question, mdl);
              if (data.sessionId) attachSessionInfo(convId, data.sessionId, data.messageId);
              completed = true;
            }
          }
        }
      }

      // Streaming selesai tanpa event "done" -> tutup placeholder
      if (!completed) {
        finalizeStream(full.trim(), [], question, mdl);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        removeStreamingMessage();
      } else {
        finalizeStream("Terjadi kesalahan koneksi ke server.", [], question, mdl);
      }
    }

    abortRef.current = null;
    setLoading(false);
  }

  async function sendMessage(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setTimeout(() => autoResizeInput(), 0);
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

    if (currentMessages.length > 0) {
      setNewMsgIndex(currentMessages.length);
    }

    await consumeStream(text, model, text, id);
  }

  // Tempel sessionId/messageId hasil server ke percakapan & pesan bot terakhir.
  function attachSessionInfo(convId, sessionId, messageId) {
    if (!convId || !sessionId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        let messages = c.messages;
        if (messageId) {
          const arr = [...messages];
          const lastBot = arr.reduce((acc, m, i) => (m.role === "bot" ? i : acc), -1);
          if (lastBot !== -1) arr[lastBot] = { ...arr[lastBot], messageId };
          messages = arr;
        }
        return { ...c, sessionId, messages };
      })
    );
  }

  // Kunci feedback per pesan: messageId server bila ada, fallback indeks lokal.
  function msgKey(m, index) {
    return m.messageId ? "m" + m.messageId : "i" + index;
  }

  // Kirim rating feedback (up/down) ke server; komentar opsional menyusul.
  function submitFeedback(index, rating, m) {
    const key = msgKey(m, index);
    const conv = conversations.find((c) => c.id === activeIdRef.current);
    if (!conv?.sessionId || !m.messageId) return;
    const comment = fbComment[key] || "";
    setFeedback((prev) => ({ ...prev, [key]: { rating, comment } }));
    api("/api/chat/feedback", {
      method: "POST",
      body: { sessionId: conv.sessionId, messageId: m.messageId, rating, comment }
    })
      .catch(() => {
        setFeedback((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), error: true } }));
      });
  }

  // Kirim ulang rating + komentar (backend menimpa feedback per pesan).
  function sendFeedbackComment(index, m) {
    const key = msgKey(m, index);
    const rating = feedback[key]?.rating;
    if (!rating) return;
    submitFeedback(index, rating, m);
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

    await consumeStream(userMsg.text, model, userMsg.text, id);
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

  // Unduh percakapan aktif dari server (HTML untuk print-ke-PDF, DOC untuk Word).
  function downloadChat(format) {
    const conv = conversations.find((c) => c.id === activeIdRef.current);
    if (!conv?.sessionId) return;
    const a = document.createElement("a");
    a.href = "/api/chat/history/" + conv.sessionId + "/export?format=" + format;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setExportOpen(false);
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
        background: t.pageBg,
        padding: isMobile ? "8px" : "18px",
        fontFamily: FONT_BODY,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "auto",
          position: "relative",
          background: t.card,
          border: "1px solid " + t.border,
          borderRadius: isMobile ? "14px" : "20px",
          boxShadow: "0 18px 50px rgba(15,40,80,0.14)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: isMobile ? "calc(100vh - 16px)" : "calc(100vh - 36px)"
        }}
      >
        {/* HEADER */}
        <div
          className="app-header"
          style={{
            background: "linear-gradient(135deg, #001845, #004DAF)",
            color: "white",
            boxShadow: "inset 0 -3px 0 0 rgba(233,163,25,0.55)",
            padding: isMobile ? "16px 16px" : "22px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
            flexWrap: isMobile ? "wrap" : "nowrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
            <img
              src="/logo-kemendag-putih.png"
              alt="Logo Kementerian Perdagangan Republik Indonesia"
              style={{
                height: isMobile ? "46px" : "56px",
                width: "auto",
                maxWidth: isMobile ? "170px" : "200px",
                objectFit: "contain",
                flexShrink: 0,
                display: "block"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", minWidth: 0 }}>
            {!isMobile && online !== true && (
              <span
                title="Status koneksi ke backend"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: "1px solid " + (online === null ? "#fde047" : "#fca5a5"),
                  background: online === null ? "#fef9c3" : "#fee2e2",
                  color: online === null ? "#854d0e" : "#991b1b",
                  fontFamily: 'inherit'
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{online === null ? "…" : IconX(11)}</span>
                {online === null ? "Menghubungi" : "Tidak merespons"}
              </span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDark((v) => !v)}
                role="switch"
                aria-checked={dark}
                className="theme-toggle-btn"
                title={dark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
                aria-label={dark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
                style={{
                  position: "relative",
                  width: "42px",
                  height: "22px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.55)",
                  background: "linear-gradient(135deg,#f6c453,#e9a319)",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: "0",
                  display: "block",
                  overflow: "hidden"
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "12px",
                    background: "linear-gradient(135deg,#f6c453,#e9a319)",
                    opacity: dark ? 0 : 1,
                    transition: "opacity 0.4s ease"
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "12px",
                    background: "linear-gradient(135deg,#f6c453,#e9a319)",
                    opacity: dark ? 1 : 0,
                    transition: "opacity 0.4s ease"
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: dark ? "24px" : "3px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    color: "#78350f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                    transition: "left 0.25s ease, color 0.3s ease"
                  }}
                >
                  {dark ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  )}
                </span>
              </button>
              {user ? (
                <>
                  {cmsEntryButton(dark, isMobile ? "icon-only" : cmsBtnVariant, "CMS (" + user.username + ")", () => window.open("/#/cms", "_blank"), "Buka panel CMS")}
                  <button
                    onClick={logout}
                    style={navButtonStyle(dark)}
                  >
                    Keluar
                  </button>
                </>
              ) : (
                cmsEntryButton(dark, isMobile ? "icon-only" : cmsBtnVariant, cmsBtnLabel, () => window.open("/#/cms/login", "_blank"), "Masuk ke panel administrasi CMS")
              )}
            </div>
          </div>
        </div>

        {/* TOMBOL RIWAYAT — ikon garis 3, kiri-atas area chat (di dalam card) */}
        <button
          onClick={() => setSidebarOpen(true)}
          title="Buka riwayat percakapan"
          aria-label="Buka riwayat percakapan"
          className="fade-in"
          style={{
            position: "absolute",
            top: isMobile ? "90px" : "116px",
            left: "16px",
            zIndex: 12,
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            background: dark ? "rgba(21,31,54,0.85)" : "rgba(255,255,255,0.9)",
            border: "1px solid " + (dark ? "#2b3a5c" : "#dbe1ec"),
            color: t.accentText,
            cursor: "pointer",
            boxShadow: "0 3px 12px rgba(15,40,80,0.14)"
          }}
        >
          {IconMenu(18)}
        </button>

        {/* BANNER SERVER TIDAK MERESPONS */}
        {online === false && (
          <div
            className="fade-in"
            style={{
              background: dark ? "#3a2d12" : "#fef3c7",
              color: dark ? "#fde68a" : "#92400e",
              borderBottom: "1px solid " + (dark ? "#6b4f1a" : "#fde68a"),
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
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>{IconWarning(15)} Server tidak merespons — jawaban AI tidak dapat diproses saat ini.</span>
            <button
              onClick={refreshHealth}
              style={{
                background: dark ? "#1b2944" : "#ffffff",
                color: dark ? "#fde68a" : "#92400e",
                border: "1px solid " + (dark ? "#4a3a16" : "#fcd34d"),
                borderRadius: "8px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: 'inherit'
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>{IconRefresh(13)} Coba lagi</span>
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
              overflowY: currentMessages.length === 0 && !loading ? "hidden" : "auto",
              overflowX: currentMessages.length === 0 && !loading ? "hidden" : "auto",
              padding: isMobile ? "6px" : "10px",
              background: t.chatBg,
              position: "relative",
              display: currentMessages.length === 0 && !loading ? "flex" : "block",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {currentMessages.length === 0 && !loading && (
              <div className="aurora" aria-hidden="true">
                <div
                  className="aurora-blob"
                  style={{
                    width: 380,
                    height: 380,
                    top: -90,
                    left: -100,
                    background: "radial-gradient(circle, rgba(0,77,175,0.95), rgba(0,77,175,0) 68%)",
                    opacity: 0.55,
                    animation: "auroraDrift 16s ease-in-out infinite"
                  }}
                />
                <div
                  className="aurora-blob"
                  style={{
                    width: 340,
                    height: 340,
                    top: -50,
                    right: -100,
                    background: "radial-gradient(circle, rgba(56,189,248,0.95), rgba(56,189,248,0) 68%)",
                    animation: "auroraDrift 20s ease-in-out -4s infinite"
                  }}
                />
                <div
                  className="aurora-blob"
                  style={{
                    width: 280,
                    height: 280,
                    bottom: -90,
                    left: -40,
                    background: "radial-gradient(circle, rgba(233,163,25,0.85), rgba(233,163,25,0) 70%)",
                    opacity: 0.3,
                    animation: "auroraDrift 24s ease-in-out -9s infinite"
                  }}
                />
              </div>
            )}

            {currentMessages.length === 0 && !loading && (
            <div
              className="fade-in hero-panel"
              style={{
                width: "100%",
                margin: "auto"
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div className="rise" style={{ display: "flex", justifyContent: "center", marginBottom: "14px", animationDelay: "0s" }}>
                  <img
                    src="/logo-kemendag.png"
                    alt="Logo Kemendag"
                    className="logo-hover"
                    style={{
                      width: isMobile ? "60px" : "84px",
                      height: isMobile ? "60px" : "84px",
                      objectFit: "cover",
                      mixBlendMode: "multiply",
                      filter: "drop-shadow(0 6px 14px rgba(0,77,175,0.18))"
                    }}
                  />
                </div>
                <h2 className="rise" style={{ margin: "0", fontSize: isMobile ? "21px" : "26px", fontWeight: 800, letterSpacing: "-0.5px", color: t.accentText, fontFamily: FONT_HEADING, animationDelay: "0.06s" }}>
                  AI Document Intelligence – Kemendag
                </h2>
                <div className="rise" style={{ width: "56px", height: "3px", margin: "8px auto 0", borderRadius: "3px", background: "linear-gradient(90deg,#e9a319,#f6c453)", animationDelay: "0.08s" }} />
                <p className="rise" style={{ margin: "7px 0 0", fontSize: "12.5px", color: t.textSoft, fontWeight: 600, animationDelay: "0.1s" }}>
                  {todayLabel()}
                </p>
                <div className="rise" style={{ margin: "10px auto 0", fontSize: "15px", color: t.textSoft, lineHeight: "1.5", width: "100%", minHeight: "20px", animationDelay: "0.12s" }}>
                  <Typewriter phrases={typedPhrases} delay={120} pause={2000} />
                </div>
              </div>

              <div className="rise" style={{ width: "190px", height: "1px", margin: "18px auto 0", background: "linear-gradient(90deg, transparent, #c7d2fe, transparent)", animationDelay: "0.24s" }} />

              {online === true && (
                <button
                  key={suggestionIdx}
                  className="rise"
                  onClick={() => sendMessage(exampleQuestions[suggestionIdx])}
                  disabled={loading}
                  title={exampleQuestions[suggestionIdx]}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    margin: "14px auto 0",
                    maxWidth: "100%",
                    background: t.inputBg,
                    border: "1px solid " + t.borderSoft,
                    borderRadius: "999px",
                    padding: "7px 16px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    color: t.accentText,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    animationDelay: "0.26s",
                    visibility: modelOpen ? "hidden" : "visible",
                    transition: "background 0.15s ease, color 0.15s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.accentSoft; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = t.inputBg; e.currentTarget.style.color = t.accentText; }}
                >
                  <span style={{ display: "inline-flex", flexShrink: 0 }}>{IconSearchModule(13)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exampleQuestions[suggestionIdx]}</span>
                </button>
              )}

              <div
                className="rise"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  margin: "10px auto 0",
                  width: "100%",
                  animationDelay: "0.28s"
                }}
              >
                <ModelSelector models={models} model={model} onSelect={setModel} isMobile={isMobile} align="left" onOpenChange={setModelOpen} dark={dark} />
                  <div
                    className="textbox-pill"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flex: 1,
                      minWidth: 0,
                      maxWidth: "580px",
                      height: "44px",
                      boxSizing: "border-box",
                      background: t.inputBg,
                      border: "1px solid " + t.borderSoft,
                      borderRadius: "999px",
                      padding: "0 6px 0 16px"
                    }}
                  >
                  <input
                    ref={heroInputRef}
                    autoFocus
                    className="hero-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Tanyakan informasi perdagangan…"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      fontSize: "15px",
                      fontFamily: 'inherit',
                      color: t.text,
                      background: "transparent",
                      padding: "0"
                    }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    title="Kirim pertanyaan (Enter)"
                    aria-label="Kirim pertanyaan"
                    style={{
                      background: !input.trim() || loading ? (dark ? "#26324d" : "#cbd5e1") : "#004DAF",
                      color: "white",
                      border: "none",
                      borderRadius: "999px",
                      width: "32px",
                      height: "32px",
                      flexShrink: 0,
                      cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                      fontSize: "16px",
                      fontFamily: 'inherit',
                      boxShadow: !input.trim() || loading ? "none" : "0 4px 12px rgba(0,77,175,0.35)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease"
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = "scale(1.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    {IconSend(15)}
                  </button>
                </div>
              </div>

              {online === true && (
                <div className="rise" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "16px", fontSize: "12px", color: t.textMute, animationDelay: "0.32s", visibility: modelOpen ? "hidden" : "visible" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a75c", display: "inline-block", animation: "pulseDot 1.5s infinite" }} />
                  <span>Terhubung — siap menerima pertanyaan</span>
                </div>
              )}
            </div>
          )}

          {currentMessages.length > 0 && !loading && (
            <div style={{ display: "flex", justifyContent: "center", margin: "0 0 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
              {(() => {
                const activeConv = conversations.find((c) => c.id === activeConvId);
                if (!activeConv) return null;
                const synced = !!activeConv.sessionId;
                return (
                  <span
                    title={synced ? "Percakapan tersimpan di server" : "Percakapan hanya tersimpan di perangkat ini"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: synced ? "#16a75c" : "#d97706",
                      border: "1px solid " + (synced ? "#16a75c" : "#d97706"),
                      borderRadius: "999px",
                      padding: "5px 11px",
                      background: synced ? (dark ? "#12331f" : "#ecfdf5") : (dark ? "#33270f" : "#fffbeb"),
                      flexShrink: 0
                    }}
                  >
                    {synced ? IconCloud(12) : IconHardDrive(12)} {synced ? "Tersimpan" : "Lokal"}
                  </span>
                );
              })()}
              {showResetConfirm ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: t.inputBg, border: "1px solid " + t.borderSoft, borderRadius: "999px", padding: "6px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: "13px", color: t.textSoft }}>Mulai ulang percakapan?</span>
                  <button onClick={() => { setShowResetConfirm(false); newConversation(); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "999px", padding: "5px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: 'inherit' }}>Ya</button>
                  <button onClick={() => setShowResetConfirm(false)} style={{ background: t.bgSoft, color: t.textSoft, border: "none", borderRadius: "999px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: 'inherit' }}>Batal</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  title="Kosongkan percakapan saat ini"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "transparent",
                    color: t.textMute,
                    border: "1px dashed " + t.border,
                    borderRadius: "12px",
                    padding: "6px 14px",
                    fontSize: "12.5px",
                    fontFamily: 'inherit',
                    cursor: "pointer",
                    transition: "color 0.15s ease, border-color 0.15s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#004DAF"; e.currentTarget.style.borderColor = "#c7d2fe"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = t.textMute; e.currentTarget.style.borderColor = t.border; }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>{IconRefresh(13)}</span> Mulai ulang percakapan
                </button>
              )}
              {(() => {
                const activeConv = conversations.find((c) => c.id === activeConvId);
                if (!activeConv?.sessionId) return null;
                return (
                  <>
                    <button
                      onClick={() => setExportOpen((v) => !v)}
                      title="Unduh percakapan ini"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#004DAF",
                        color: "white",
                        border: "none",
                        borderRadius: "12px",
                        padding: "6px 14px",
                        fontSize: "12.5px",
                        fontFamily: 'inherit',
                        cursor: "pointer",
                        boxShadow: "0 3px 10px rgba(0,77,175,0.3)"
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center" }}>{IconDownload(14)}</span> Unduh
                    </button>
                    {exportOpen && (
                      <div
                        className="pop-in"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: t.card,
                          border: "1px solid " + t.border,
                          borderRadius: "12px",
                          boxShadow: "0 10px 26px rgba(0,0,0,0.16)",
                          padding: "6px",
                          zIndex: 25,
                          minWidth: "190px"
                        }}
                      >
                        <button
                          onClick={() => downloadChat("html")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "transparent",
                            color: t.text,
                            fontSize: "13px",
                            cursor: "pointer",
                            fontFamily: 'inherit'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = t.bgSoft; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center" }}>{IconFileText(15)}</span> HTML — cetak ke PDF
                        </button>
                        <button
                          onClick={() => downloadChat("doc")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "transparent",
                            color: t.text,
                            fontSize: "13px",
                            cursor: "pointer",
                            fontFamily: 'inherit'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = t.bgSoft; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center" }}>{IconDoc(15)}</span> DOC — buka di Word
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
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
                {index === newMsgIndex && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 4px", padding: "0 18px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "10px", width: "100%", maxWidth: "280px", color: t.textMute, fontSize: "11px", fontWeight: 700, fontFamily: FONT_BODY }}>
                      <span style={{ flex: 1, height: "1px", background: t.border }} />
                      Pesan baru
                      <span style={{ flex: 1, height: "1px", background: t.border }} />
                    </span>
                  </div>
                )}
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
                        background: t.borderSoft,
                        color: t.textMute,
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
                        background: "linear-gradient(135deg,#001845,#004DAF)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        alignSelf: "flex-start",
                        animation: m.streaming ? "pulseRing 1.5s infinite" : "none"
                      }}
                    >
                      {IconBot(20)}
                    </div>
                  )}

                  {showTyping ? (
                    <div
                      style={{
                        background: t.bubbleBot,
                        padding: "14px 18px",
                        borderRadius: "18px 18px 18px 4px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        minWidth: "230px"
                      }}
                    >
                      <ProcessingIndicator dark={dark} />
                      <SourceSkeleton dark={dark} />
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: isMobile ? "85%" : "76%",
                        background: m.role === "user" ? t.bubbleUser : t.bubbleBot,
                        padding: "11px 16px",
                        borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        border: m.role === "bot" ? "1px solid rgba(0,0,0,0.04)" : "none",
                        borderLeft: m.role === "bot" ? "4px solid #004DAF" : "none",
                        borderRight: m.role === "user" ? "4px solid #e9a319" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                        <b style={{ fontSize: "14px", color: m.role === "user" ? (dark ? "#ffffff" : "#004DAF") : t.text }}>
                          {m.role === "user" ? (
                            "Anda"
                          ) : (
                            <>
                              AI
                              {(() => {
                                const msgModel = m.model || model;
                                const badge = providerBadge(msgModel);
                                const short = msgModel.split("/").pop();
                                const label = models.find((x) => x.id === msgModel)?.label ?? msgModel;
                                return (
                                  <span
                                    title={label}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      marginLeft: "8px",
                                      background: badge.background,
                                      color: badge.color,
                                      border: "1px solid rgba(0,0,0,0.08)",
                                      borderRadius: "20px",
                                      padding: "2px 9px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      verticalAlign: "middle"
                                    }}
                                  >
                                    ⌬ {short}
                                  </span>
                                );
                              })()}
                            </>
                          )}
                          {m.role === "bot" && !m.streaming && m.sources && m.sources.length > 0 && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: t.bubbleUser,
                                color: t.accentText,
                                borderRadius: "20px",
                                padding: "2px 9px",
                                marginLeft: "8px",
                                fontSize: "11px",
                                fontWeight: 600,
                                verticalAlign: "middle"
                              }}
                            >
                              {IconFile(11)} {new Set(m.sources.map((s) => s.filename)).size} sumber
                            </span>
                          )}
                          {m.streaming && (
                            <span style={{ fontSize: "11px", color: t.accentText, marginLeft: "8px", fontWeight: 600 }} className="blink">
                              ● mengetik
                            </span>
                          )}
                          {m.time && (
                            <span style={{ fontWeight: 400, fontSize: "11px", color: t.textMute, marginLeft: "8px" }}>
                              {new Date(m.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </b>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => deleteMessage(index)}
                            title="Hapus pesan"
                            aria-label="Hapus pesan"
                            style={miniActionStyle(dark)}
                          >
                            {IconTrash(14)}
                          </button>
                          {m.role === "bot" && !m.streaming && (
                            <>
                              <button
                                onClick={() => copyText(m.text, index)}
                                title={copied === index ? "Tersalin!" : "Salin jawaban"}
                                aria-label="Salin jawaban"
                                style={miniActionStyle(dark)}
                              >
                                {copied === index ? IconCheck(14) : IconCopy(14)}
                              </button>
                              <button
                                onClick={() => reask(index)}
                                title="Ulangi pertanyaan (model berbeda)"
                                aria-label="Ulangi pertanyaan"
                                style={miniActionStyle(dark)}
                              >
                                {IconRefresh(14)}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="markdown-body" style={{ marginTop: "8px", lineHeight: "1.55", fontSize: "14px" }}>
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
                                ),
                                table: (props) => (
                                  <div className="md-table-wrap">
                                    <table {...props} />
                                  </div>
                                )
                              }}
                            >
                              {withCitations(m.text)}
                            </ReactMarkdown>
                          )}
                      </div>

                      {m.role === "bot" && m.streaming && m.text && (
                        <SourceSkeleton dark={dark} />
                      )}

                      {m.role === "bot" && !m.streaming && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            onClick={() => submitFeedback(index, "up", m)}
                            title="Jawaban membantu"
                            aria-label="Jawaban membantu"
                            style={{
                              ...miniActionStyle(dark),
                              background: feedback[msgKey(m, index)]?.rating === "up" ? "#dcfce7" : "transparent",
                              borderColor: feedback[msgKey(m, index)]?.rating === "up" ? "#16a75c" : t.borderSoft,
                              color: feedback[msgKey(m, index)]?.rating === "up" ? "#16a75c" : t.textMute
                            }}
                          >
                            {IconThumbsUp(15)}
                          </button>
                          <button
                            onClick={() => submitFeedback(index, "down", m)}
                            title="Jawaban kurang membantu"
                            aria-label="Jawaban kurang membantu"
                            style={{
                              ...miniActionStyle(dark),
                              background: feedback[msgKey(m, index)]?.rating === "down" ? "#fee2e2" : "transparent",
                              borderColor: feedback[msgKey(m, index)]?.rating === "down" ? "#ff1c3e" : t.borderSoft,
                              color: feedback[msgKey(m, index)]?.rating === "down" ? "#ff1c3e" : t.textMute
                            }}
                          >
                            {IconThumbsDown(15)}
                          </button>
                          {feedback[msgKey(m, index)]?.rating && (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", flex: 1, minWidth: "180px" }}>
                              <input
                                value={fbComment[msgKey(m, index)] || ""}
                                onChange={(e) => setFbComment((prev) => ({ ...prev, [msgKey(m, index)]: e.target.value }))}
                                onKeyDown={(e) => e.key === "Enter" && sendFeedbackComment(index, m)}
                                placeholder="Komentar (opsional)…"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  background: "transparent",
                                  border: "1px solid " + t.borderSoft,
                                  borderRadius: "999px",
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  outline: "none",
                                  fontFamily: 'inherit',
                                  color: t.text
                                }}
                              />
                              <button
                                onClick={() => sendFeedbackComment(index, m)}
                                title="Kirim komentar"
                                aria-label="Kirim komentar"
                                style={miniActionStyle(dark)}
                              >
                                {IconSend(13)}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {m.role === "bot" && !m.streaming && (
                        <>
                          {m.sources && m.sources.length === 0 && (
                            <div style={{ marginTop: "15px", paddingTop: "12px", borderTop: "1px solid " + t.borderSoft, fontSize: "13px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  color: "#92400e"
                                }}
                              >
                                <span style={{ display: "inline-flex", flexShrink: 0 }}>{IconWarning(15)}</span>
                                <span>
                                  Informasi ini tidak ditemukan pada dokumen yang tersedia.
                                  Silakan coba pertanyaan lain atau gunakan kata kunci berbeda.
                                </span>
              </div>
            </div>
          )}
                          {m.sources && m.sources.length > 0 && (
                        <div
                          style={{
                            marginTop: "15px",
                            paddingTop: "12px",
                            borderTop: "1px solid " + t.borderSoft,
                            fontSize: "13px"
                          }}
                        >
                          <b style={{ color: "#c98500", fontSize: "13px", borderLeft: "3px solid #e9a319", paddingLeft: "8px", display: "flex", alignItems: "center", gap: "7px" }}>{IconBook(14)} Sumber Referensi</b>
                          <div style={{ fontSize: "11px", color: t.textMute, marginTop: "4px" }}>
                            Klik nomor halaman untuk membuka dokumen.
                          </div>
                          {(() => {
                            const grouped = (m.sources || []).reduce((acc, source) => {
                              if (!acc[source.filename]) {
                                acc[source.filename] = { entries: [], distance: Infinity };
                              }
                              acc[source.filename].entries.push({
                                page: source.page,
                                distance: typeof source.distance === "number" ? source.distance : null
                              });
                              if (typeof source.distance === "number") {
                                acc[source.filename].distance = Math.min(
                                  acc[source.filename].distance,
                                  source.distance
                                );
                              }
                              return acc;
                            }, {});
                            const entries = Object.entries(grouped);
                            const validDistances = entries
                              .map(([, info]) => info.distance)
                              .filter((d) => typeof d === "number" && isFinite(d));
                            // Jarak terbaik = paling relevan; dipakai sebagai dasar 100%.
                            const bestDistance = validDistances.length
                              ? Math.min(...validDistances)
                              : null;

                            return entries.map(([filename, info]) => {
                              // Halaman unik + skor relevansi, urut jarak kecil (skor besar) dulu.
                              const pageMap = new Map();
                              for (const e of info.entries) {
                                if (!pageMap.has(e.page)) pageMap.set(e.page, e.distance);
                              }
                              const allPages = [...pageMap.entries()]
                                .map(([page, distance]) => ({ page, distance }))
                                .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
                              // Hanya halaman dengan skor relevansi tinggi yang benar-benar
                              // berisi informasi jawaban.
                              const confident = allPages.filter(
                                ({ distance }) =>
                                  confidenceOf(distance, bestDistance) !== null &&
                                  confidenceOf(distance, bestDistance) >= 70
                              );
                              const visiblePages = confident.length ? confident : allPages.slice(0, 1);
                              return (
                              <div
                                key={filename}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  width: "100%",
                                  boxSizing: "border-box",
                                  minWidth: 0,
                                  maxWidth: "100%",
                                  marginTop: "8px",
                                  background: t.card,
                                  border: "1px solid " + t.borderSoft,
                                  borderRadius: "10px",
                                  padding: "8px 12px",
                                  textAlign: "left",
                                  fontSize: "13px",
                                  color: t.textSoft,
                                  fontFamily: 'inherit',
                                  overflow: "hidden"
                                }}
                              >
                                <span style={{ display: "inline-flex", flexShrink: 0, color: t.textMute }}>{IconFile(16)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: t.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {sourceTitle(m.sources, filename)}
                                  </div>
                                  <div style={{ color: t.textMute, fontSize: "12px", marginTop: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", minWidth: 0 }}>
                                    <span style={{ flexShrink: 0 }}>Halaman:</span>
                                    {visiblePages.map(({ page }) => (
                                      <button
                                        key={page}
                                        onClick={(e) => { e.stopPropagation(); setPreviewDoc({ filename, pages: [page] }); }}
                                        title={`Buka halaman ${page}`}
                                        style={pageChipStyle(t)}
                                      >
                                        {page}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                            });
                          })()}
                        </div>
                      )}
                        </>
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
                        background: "linear-gradient(135deg,#f6c453,#e9a319)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0b1e3a",
                        alignSelf: "flex-start"
                      }}
                    >
                      {IconUser(19)}
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
                  background: "linear-gradient(135deg,#001845,#004DAF)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  animation: "pulseRing 1.5s infinite"
                }}
              >
                {IconBot(20)}
              </div>
              <div
                style={{
                  background: t.bubbleBot,
                  padding: "14px 18px",
                  borderRadius: "18px 18px 18px 4px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  minWidth: "230px"
                }}
              >
                <ProcessingIndicator dark={dark} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />

          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              title="Kembali ke pesan terbaru"
              aria-label="Kembali ke pesan terbaru"
              className="pop-in"
              style={{
                position: "sticky",
                bottom: "12px",
                margin: "0 auto",
                display: "block",
                background: "#004DAF",
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
              {IconArrowDown(18)}
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
                background: t.card,
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
                  background: "linear-gradient(135deg,#001845,#004DAF)",
                  color: "white",
                  flexShrink: 0
                }}
              >
                <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ display: "inline-flex", flexShrink: 0 }}>{IconFile(14)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {previewDoc.filename}
                    {previewDoc.pages && previewDoc.pages.length > 0 && (
                      <span style={{ fontSize: "12px", opacity: 0.85 }}> · hlm. {previewDoc.pages.join(", ")}</span>
                    )}
                  </span>
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
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {IconX(13)} Tutup
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

        {/* INPUT AREA (kotak tanya kembali ke bawah setelah ada percakapan) */}
        {(currentMessages.length > 0 || loading) && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              padding: isMobile ? "10px" : "15px",
              borderTop: "1px solid " + t.border,
              alignItems: isMobile ? "stretch" : "center",
              flexWrap: "wrap",
              flexShrink: 0,
              background: t.bar
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                background: t.card,
                border: "1px solid " + t.border,
                borderRadius: "999px",
                padding: isMobile ? "4px 4px 4px 12px" : "6px 6px 6px 16px",
                boxSizing: "border-box"
              }}
            >
              <textarea
              ref={inputRef}
              className="chat-input thin-scroll"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResizeInput();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
              rows={1}
              placeholder={loading
                ? "AI sedang menjawab…"
                : "Tanyakan informasi perdagangan…"}
              style={{
                flex: 1,
                minWidth: "180px",
                padding: "6px 0",
                borderRadius: "0",
                border: "none",
                fontSize: "14px",
                outline: "none",
                fontFamily: 'inherit',
                background: "transparent",
                color: loading ? t.textMute : t.text,
                resize: "none",
                lineHeight: "1.45",
                maxHeight: "140px",
                boxSizing: "border-box",
                alignItems: "center",
                display: "flex",
                overflowY: "auto"
              }}
            />

            <button
              onClick={loading ? stopAnswer : () => sendMessage()}
              title={loading ? "Hentikan jawaban AI" : "Kirim pertanyaan"}
              aria-label={loading ? "Hentikan jawaban AI" : "Kirim pertanyaan"}
              style={{
                width: isMobile ? "32px" : "34px",
                height: isMobile ? "32px" : "34px",
                borderRadius: "50%",
                flexShrink: 0,
                background: loading ? "#dc2626" : "#004DAF",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontFamily: 'inherit',
                fontSize: "16px",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: loading ? "none" : "0 4px 12px rgba(0,77,175,0.35)"
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#003d94"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = loading ? "#dc2626" : "#004DAF"; }}
            >
              {loading ? IconStop(16) : IconSend(16)}
            </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {!isMobile && (
          <div
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: t.textMute,
              background: t.bar,
              borderTop: "1px solid " + t.borderSoft,
              padding: "8px 16px",
              flexShrink: 0
            }}
          >
            Jawaban bersumber dari dokumen yang tersedia; silakan verifikasi dengan dokumen asli.
            <span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>
            <b style={{ fontWeight: 600, color: t.textMute }}>AI Document Intelligence – Kemendag</b>
          </div>
        )}
      </div>

      {/* TOMBOL RIWAYAT — kini berada di header (kiri, sebelum logo) */}

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
              background: t.sidebar,
              zIndex: 41,
              boxShadow: "0 0 40px rgba(0,0,0,0.25)",
              borderRadius: "0 18px 18px 0",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg,#001845,#004DAF)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <b style={{ fontSize: "15px", fontFamily: FONT_HEADING, fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-flex" }}>{IconChat(15)}</span>
                Riwayat Percakapan
              </b>
              <button
                onClick={() => { setSidebarOpen(false); setConfirmDeleteId(null); }}
                aria-label="Tutup riwayat percakapan"
                style={{
                  background: "transparent",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontFamily: 'inherit',
                  fontWeight: 700
                }}
              >
                {IconX(16)}
              </button>
            </div>

            <div style={{ padding: "12px 14px" }}>
              <button
                onClick={newConversation}
                style={{
                  width: "100%",
                  background: t.card,
                  border: "1px solid " + t.borderSoft,
                  color: dark ? "white" : "#004DAF",
                  borderRadius: "12px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: 'inherit',
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>{IconPlus(15)}</span> Percakapan Baru
              </button>
            </div>

            <div style={{ padding: "0 14px 8px" }}>
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Cari percakapan…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.card,
                  border: "1px solid " + t.borderSoft,
                  borderRadius: "999px",
                  padding: "9px 14px",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: 'inherit',
                  color: t.text
                }}
              />
            </div>

            <div className="thin-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px 14px" }}>
              {(() => {
                const items = filteredHistory();
                if (items.length === 0) {
                  return (
                    <p style={{ fontSize: "13px", color: t.textMute, textAlign: "center", marginTop: "24px" }}>
                      {historyQuery.trim()
                        ? "Tidak ada percakapan yang cocok."
                        : "Belum ada percakapan. Mulai tanya sesuatu!"}
                    </p>
                  );
                }
                const groups = [];
                let lastKey = null;
                for (const c of items) {
                  const key = historyGroupLabel(c.updatedAt || c.createdAt);
                  if (key !== lastKey) {
                    groups.push({ key, items: [] });
                    lastKey = key;
                  }
                  groups[groups.length - 1].items.push(c);
                }
                return groups.map((g) => (
                  <div key={g.key}>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: t.textMute,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "14px 8px 4px"
                      }}
                    >
                      {g.key}
                    </div>
                    {g.items.map((c) => (
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
                          border: activeConvId === c.id ? (dark ? "1px solid #3f6db8" : "1px solid #004DAF") : "1px solid transparent",
                          background: activeConvId === c.id ? (dark ? "#1c3a63" : "#eef6fd") : t.card,
                          cursor: "pointer",
                          fontFamily: 'inherit',
                          color: t.text,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
                        }}
                      >
                        <span style={{ display: "inline-flex", flexShrink: 0, color: t.textMute }}>{IconChat(16)}</span>
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
                          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: t.textMute, marginTop: 3, minWidth: 0 }}>
                            <span
                              title={c.sessionId ? "Tersimpan di server" : "Hanya tersimpan di perangkat ini"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                color: c.sessionId ? "#16a75c" : "#d97706",
                                fontWeight: 700,
                                flexShrink: 0
                              }}
                            >
                              {c.sessionId ? IconCloud(11) : IconHardDrive(11)} {c.sessionId ? "tersimpan" : "lokal"}
                            </span>
                            <span style={{ flexShrink: 0 }}>·</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {(c.msgCount ?? c.messages.length)} pesan · {new Date(c.updatedAt || c.createdAt).toLocaleDateString("id-ID")}
                            </span>
                          </span>
                        </span>
                        {confirmDeleteId === c.id ? (
                          <span
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
                          >
                            <span style={{ fontSize: "10px", color: t.textMute, fontWeight: 700 }}>Hapus?</span>
                            <button
                              onClick={(e) => deleteConversation(c.id, e)}
                              title="Ya, hapus percakapan"
                              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "3px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              Ya
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              title="Batal"
                              style={{ background: t.bgSoft, color: t.textSoft, border: "none", borderRadius: "6px", padding: "3px 9px", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              Batal
                            </button>
                          </span>
                        ) : (
                          <span
                            role="button"
                            title="Hapus percakapan"
                            aria-label="Hapus percakapan"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                            style={{
                              flexShrink: 0,
                              color: t.textMute,
                              fontSize: "14px",
                              padding: "2px 6px",
                              cursor: "pointer",
                              borderRadius: "6px",
                              display: "inline-flex"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "#ff1c3e"; e.currentTarget.style.background = dark ? "#3a1220" : "#fee2e2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = t.textMute; e.currentTarget.style.background = "transparent"; }}
                          >
                            {IconTrash(15)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

const navButtonStyle = (dark) => ({
  background: dark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.12)",
  color: "white",
  border: "1px solid " + (dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.45)"),
  padding: "10px 14px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "14px",
  whiteSpace: "nowrap",
  fontFamily: 'inherit'
});

const miniActionStyle = (dark) => ({
  background: "transparent",
  border: "none",
  color: dark ? "#8b98ad" : "#64748b",
  borderRadius: "8px",
  width: "28px",
  height: "28px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: 'inherit'
});

// Pemilih model AI; arah dropdown selalu ke bawah, tinggi dibatasi ruang yang tersedia
// supaya halaman tidak ikut scroll. Daftar model selalu scroll di dalamnya.
function ModelSelector({ models, model, onSelect, isMobile, align = "left", onOpenChange, dark }) {
  const [open, setOpen] = useState(false);
  const [maxH, setMaxH] = useState(320);
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onOpenChange]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
    if (!next) return;
    const btn = btnRef.current;
    const scrollEl = ref.current?.closest(".chat-scroll");
    if (btn && scrollEl) {
      const btnRect = btn.getBoundingClientRect();
      const areaRect = scrollEl.getBoundingClientRect();
      const padBottom = parseFloat(getComputedStyle(scrollEl).paddingBottom) || 0;
      // Ruang yang benar-benar terlihat (batas inner box area chat dikurangi padding bawah).
      const usableBottom = areaRect.bottom - padBottom;
      const spaceBelow = usableBottom - btnRect.bottom - 10;
      setMaxH(Math.max(140, Math.min(420, spaceBelow)));
    } else {
      setMaxH(320);
    }
  }

  const badge = providerBadge(model);
  const short = model.split("/").pop();
  const mt = {
    card: dark ? "#151f36" : "#ffffff",
    border: dark ? "#2a3752" : "#e2e8f0",
    borderSoft: dark ? "#1f2a44" : "#eef2f7",
    text: dark ? "#e5edf7" : "#1e293b",
    textMute: dark ? "#8b98ad" : "#64748b",
    textSoft: dark ? "#c3cede" : "#334155",
    itemBg: dark ? "#1b2740" : "#eef6fd",
    softBg: dark ? "#1e2a45" : "#eef2f7"
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        title="Pilih model AI"
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "6px 12px",
          borderRadius: "999px",
          border: open ? "2px solid #004DAF" : "2px solid " + (dark ? "#2b3a5c" : "#c7d2fe"),
          fontSize: "13px",
          background: open ? mt.itemBg : mt.card,
          color: mt.text,
          outline: "none",
          cursor: "pointer",
          fontFamily: 'inherit',
          transition: "transform 0.15s ease, border-color 0.15s ease, background 0.15s ease",
          boxShadow: open ? "0 4px 14px rgba(0,114,188,0.2)" : "0 8px 24px rgba(0,28,69,0.10)",
          width: isMobile ? "135px" : "180px",
          minWidth: 0,
          height: "44px",
          boxSizing: "border-box",
          whiteSpace: "nowrap"
        }}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "8px",
            background: badge.background,
            color: badge.color
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
          {short}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: mt.textMute,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease"
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          className="pop-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
            minWidth: "280px",
            maxWidth: "min(320px, calc(100vw - 40px))",
            background: mt.card,
            borderRadius: "14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            border: "1px solid " + mt.border,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            maxHeight: maxH,
            overflow: "hidden"
          }}
        >
          {/* Judul tetap di luar area scroll; tidak pernah ikut tergeser */}
          <div
            style={{
              flexShrink: 0,
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 700,
              color: mt.textMute,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid " + mt.borderSoft,
              background: mt.card
            }}
          >
            Pilih Model AI
          </div>
          <div className="thin-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 6px 8px" }}>
            {models.map((m) => {
              const b = providerBadge(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m.id); setOpen(false); onOpenChange?.(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 10px",
                    borderRadius: "10px",
                    border: "none",
                    background: m.id === model ? mt.itemBg : "transparent",
                    cursor: "pointer",
                    fontFamily: 'inherit',
                    color: mt.text
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
                      background: b.background,
                      color: b.color,
                      fontWeight: 700
                    }}
                  >
                    ⌬
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.id.split("/").pop()}
                    </div>
                    <div style={{ fontSize: "11px", color: mt.textMute, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.label}
                    </div>
                  </div>
                  {m.id === model && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#004DAF", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
                      ✓ Aktif
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Efek ketik-maju (typewriter) yang terus berulang:
// ketik frasa -> jeda singkat -> hapus -> ketik lagi, tanpa henti.
function Typewriter({ phrases, delay = 90, pause = 1600 }) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length];
    let timer;
    if (!deleting && text === current) {
      timer = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && text === "") {
      setDeleting(false);
      setIndex((i) => (i + 1) % phrases.length);
    } else {
      timer = setTimeout(
        () => setText(current.slice(0, text.length + (deleting ? -1 : 1))),
        deleting ? 40 : delay
      );
    }
    return () => clearTimeout(timer);
  }, [text, deleting, index, phrases, delay, pause]);

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline" }}>
      <span>{text}</span>
      <span style={{ animation: "blinkCaret 1s step-end infinite", marginLeft: 2, color: "#004DAF" }}>▍</span>
    </span>
  );
}

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

// Identitas anonim persisten per browser (untuk sesi server guest).
let cachedClientId = null;
function getClientId() {
  if (cachedClientId) return cachedClientId;
  let id = null;
  try {
    id = localStorage.getItem("cms_client_id");
  } catch {
    // abaikan
  }
  if (!id) {
    id = "web_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem("cms_client_id", id);
    } catch {
      // abaikan
    }
  }
  cachedClientId = id;
  return id;
}

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

// Label grup tanggal untuk sidebar riwayat (Hari Ini / Kemarin / Tanggal).
function historyGroupLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - date) / 86400000);
  if (diff <= 0) return "Hari Ini";
  if (diff === 1) return "Kemarin";
  if (diff <= 7) return "Minggu Ini";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Label tanggal lengkap dalam bahasa Indonesia.
function todayLabel() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
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

function ProcessingIndicator({ dark }) {
  const step = useCycle(PROCESS_STEPS, 1500);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ fontSize: "14px", color: dark ? "#c3cede" : "#334155", whiteSpace: "nowrap", fontWeight: 600 }}>
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

// Ikon module-level untuk komponen di luar ChatPage (definisi sama
// dengan yang ada di dalam ChatPage; dirapikan bila direfactor).
const iconStrokeModule = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const IconSearchModule = (s) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...iconStrokeModule}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

// Kartu sumber "samar" (skeleton berkilau) saat AI mengetik
function SourceSkeleton({ dark }) {
  return (
    <div className="fade-in" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid " + (dark ? "#1e2a45" : "#e2e8f0") }}>
      <div style={{ fontSize: "13px", color: dark ? "#8b98ad" : "#64748b", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "7px" }}>
        {IconSearchModule(13)} Memeriksa dokumen sumber…
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
            background: dark ? "#1c2a47" : "#ffffff",
            border: "1px solid " + (dark ? "#2a3a58" : "#eef2f7"),
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
function HeroArt({ size = 170 }) {
  return (
    <svg width={size} height={Math.round((size * 118) / 170)} viewBox="0 0 200 145" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "2px", filter: "drop-shadow(0 10px 24px rgba(0,77,175,0.18))" }}>
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8F2F8" />
          <stop offset="1" stopColor="#e0effb" />
        </linearGradient>
        <radialGradient id="heroGlow" cx="0.5" cy="0.4" r="0.55">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.7" stopColor="#bfdbfe" stopOpacity="0.25" />
          <stop offset="1" stopColor="#bfdbfe" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="72" r="62" fill="url(#heroBg)" />
      <circle cx="100" cy="72" r="62" fill="url(#heroGlow)" />
      <circle cx="100" cy="72" r="62" fill="none" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="5 8" opacity="0.8" />
      {/* Kartu dokumen kiri */}
      <rect x="42" y="42" width="44" height="58" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="2.5" transform="rotate(-9 42 42)" />
      <line x1="51" y1="55" x2="76" y2="53" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="51" y1="64" x2="76" y2="62" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="51" y1="73" x2="69" y2="71" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
      {/* Kartu dokumen kanan */}
      <rect x="104" y="34" width="44" height="58" rx="8" fill="#ffffff" stroke="#60a5fa" strokeWidth="2.5" transform="rotate(7 104 34)" />
      <line x1="113" y1="47" x2="138" y2="49" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="113" y1="56" x2="138" y2="58" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="113" y1="65" x2="132" y2="67" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
      {/* Badge AI di tengah */}
      <circle cx="161" cy="66" r="20" fill="#ffffff" stroke="#004DAF" strokeWidth="4.5" />
      <line x1="177" y1="81" x2="190" y2="94" stroke="#004DAF" strokeWidth="5" strokeLinecap="round" />
      {/* Bintang */}
      <text x="88" y="138" fontSize="22" fill="#3b82f6" fontFamily="inherit">✦</text>
      <text x="180" y="42" fontSize="16" fill="#60a5fa" fontFamily="inherit">✦</text>
      <text x="30" y="70" fontSize="12" fill="#93c5fd" fontFamily="inherit">✦</text>
    </svg>
  );
}

// Hilangkan semua tanda kutipan dari teks jawaban:
// "[1]", "[1][2]", "[1, 2]", "[21]", dst.
// Preview dokumen tetap dibuka lewat nomor halaman di Sumber Referensi,
// sehingga nomor kutipan di dalam jawaban tidak lagi ditampilkan.
function withCitations(text) {
  if (!text) return text;
  return text.replace(/\s*\[\d+\s*(?:,\s*\d+\s*)*\]/g, "");
}

// Skor kecocokan RELATIF terhadap dokumen terbaik dalam jawaban yang sama.
// Sumber paling relevan (jarak terkecil) => 100%. Sumber lain diskalakan
// dari rasio jaraknya terhadap jarak terbaik. Ini adil karena skala jarak
// L2 sangat berbeda antardokumen (laporan pasar ~0.3, jurnal ~1.0+).
function confidenceOf(distance, bestDistance) {
  if (typeof distance !== "number" || !isFinite(distance)) return null;
  if (typeof bestDistance !== "number" || !isFinite(bestDistance) || bestDistance <= 0) return null;
  const d = Math.max(0, distance);
  if (d <= 0) return 100;
  const ratio = bestDistance / d;
  // ratio bisa >1 jika bestDistance terhitung lebih kecil dari jarak kartu ini.
  return Math.round(Math.min(1, ratio) * 100);
}

const citeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#e0f2fe",
  color: "#004DAF",
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

const pageChipStyle = (t) => ({
  background: t.borderSoft,
  color: t.textSoft,
  border: "1px solid " + t.border,
  borderRadius: "6px",
  padding: "0 7px",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: "18px",
  cursor: "pointer",
  fontFamily: 'inherit'
});

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