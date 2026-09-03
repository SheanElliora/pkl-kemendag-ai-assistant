import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser, clearSession, fmtDate, openPdf } from "../api.js";
import { createTheme, FONT_HEADING, FONT_BODY } from "../theme.js";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB, sama dengan backend

const PRESET_REASONS = [
  "Duplikat dokumen yang sudah ada",
  "Bukan dokumen terkait perdagangan",
  "Kualitas dokumen buruk",
  "Format tidak sesuai",
  "Konten tidak relevan"
];

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "-";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ---- Modal yang dipakai untuk alasan penolakan & konfirmasi hapus ----
function Modal({ title, onClose, onConfirm, children, confirmLabel = "Simpan", confirmColor = "#059669", confirmDisabled = false, t }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,10,24,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{
          width: "92%",
          maxWidth: 460,
          background: t.card,
          border: "1px solid " + t.border,
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          padding: 24,
          color: t.text
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 17, fontFamily: FONT_HEADING, color: t.text }}>{title}</h3>
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid " + t.border,
              color: t.textSoft,
              padding: "8px 16px",
              borderRadius: 12,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit"
            }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              ...smallBtn(confirmColor),
              ...(confirmDisabled ? { opacity: 0.45, cursor: "not-allowed" } : {})
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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

export default function CmsPage() {

  const navigate = useNavigate();
  const user = getUser();

  const isMobile = useMediaQuery("(max-width: 900px)");

  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("cms_sidebar_pinned") !== "0");
  // Sidebar terbuka bila di-pin, atau sementara kursor berada di atasnya.
  const isOpen = pinned || hovering;

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("cms_theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });

  // Palet warna tema (light/dark) — satu sumber warna, serasi dgn chat & login.
  const t = createTheme(dark);

  useEffect(() => {
    localStorage.setItem("cms_theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("cms_sidebar_pinned", pinned ? "1" : "0");
  }, [pinned]);

  useEffect(() => {
    // Ikuti perubahan tema dari tab lain (mis. toggle di halaman chat)
    function onStorage(e) {
      if (e.key === "cms_theme") setDark(e.newValue === "dark");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [fileSearch, setFileSearch] = useState("");
  const [sort, setSort] = useState({ key: "time", dir: "desc" });
  const [loading, setLoading] = useState({ files: false, approval: false, users: false, logs: false });
  const [toasts, setToasts] = useState([]);

  function showToast(type, message) {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, type, message }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3500);
  }

  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "maintainer" });
  const [userMsg, setUserMsg] = useState("");
  const [userQ, setUserQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [logs, setLogs] = useState([]);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!userMsg) return;
    const t = setTimeout(() => setUserMsg(""), 4000);
    return () => clearTimeout(t);
  }, [userMsg]);

  useEffect(() => {
    if (!uploadMsg) return;
    const t = setTimeout(() => setUploadMsg(""), 4000);
    return () => clearTimeout(t);
  }, [uploadMsg]);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPass, setResetPass] = useState("");
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [processingAll, setProcessingAll] = useState(false);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approveAllProgress, setApproveAllProgress] = useState({ total: 0, done: 0 });
  const processingRef = useRef(false);

  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState(isAdmin ? "approval" : "upload");
  const [approvalSub, setApprovalSub] = useState("pending");

  const navItems = isAdmin
    ? [
        { id: "approval", label: "Kelola Dokumen", icon: "folder" },
        { id: "users", label: "Kelola Pengguna", icon: "users" },
        { id: "logs", label: "Riwayat Aktivitas", icon: "file" }
      ]
    : [
        { id: "upload", label: "Unggah Dokumen", icon: "upload" },
        { id: "mydocs", label: "Dokumen Saya", icon: "folder" }
      ];

  const navCount = (id) => (id === "approval" ? pending.length : 0);

  async function refreshFiles() {
    setLoading((s) => ({ ...s, files: true }));
    try {
      const data = await api("/api/cms/files");
      setFiles(data.files || []);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setLoading((s) => ({ ...s, files: false }));
    }
  }

  async function refreshApproval() {
    setLoading((s) => ({ ...s, approval: true }));
    try {
      const data = await api("/api/cms/files");
      const all = data.files || [];
      setFiles(all);
      setPending(all.filter((f) => f.status === "pending" || f.status === "processing"));
      setHistory(all.filter((f) => f.status !== "pending" && f.status !== "processing"));
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setLoading((s) => ({ ...s, approval: false }));
    }
  }

  async function refreshUsers() {
    setLoading((s) => ({ ...s, users: true }));
    try {
      const data = await api("/api/cms/users");
      setUsers(data.users || []);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setLoading((s) => ({ ...s, users: false }));
    }
  }

  async function refreshLogs() {
    setLoading((s) => ({ ...s, logs: true }));
    try {
      const data = await api("/api/cms/login-logs");
      setLogs(data.logs || []);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setLoading((s) => ({ ...s, logs: false }));
    }
  }

  useEffect(() => {
    setFileSearch("");
    setSort({ key: "time", dir: "desc" });
    setHistoryFilter("all");
    if (tab === "upload" || tab === "mydocs") refreshFiles();
    if (tab === "approval") refreshApproval();
    if (tab === "users") refreshUsers();
    if (tab === "logs") refreshLogs();
  }, [tab]);

  // Polling otomatis: segarkan daftar persetujuan.
  // Setiap 5 detik dicek: bila ada dokumen sedang
  // diproses (status "processing") langsung refresh,
  // bila tenang cukup sekali tiap 30 detik.
  useEffect(() => {
    if (tab !== "approval") return;
    let lastRefresh = 0;
    const id = setInterval(() => {
      const now = Date.now();
      if (processingRef.current || now - lastRefresh >= 30000) {
        lastRefresh = now;
        refreshApproval();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [tab]);

  // Perbarui penanda "ada dokumen diproses" setiap
  // daftar disegarkan (untuk interval polling di atas).
  useEffect(() => {
    processingRef.current = files.some((f) => f.status === "processing");
  }, [files]);

  // Segarkan saat window kembali terlihat/difokuskan.
  useEffect(() => {
    if (tab !== "approval") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshApproval();
    };
    const onFocus = () => refreshApproval();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [tab]);

  // ---- Upload ----

  async function doUpload(e) {
    e.preventDefault();
    if (!file) {
      setUploadMsg("Pilih dokumen PDF terlebih dahulu.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadMsg("Ukuran dokumen melebihi batas 20 MB.");
      return;
    }

    setUploading(true);
    setUploadMsg("");

    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api("/api/cms/upload", { method: "POST", body: form });
      setUploadMsg(data.message || "Unggah berhasil.");
      showToast("success", data.message || "Unggah berhasil.");
      setFile(null);
      refreshFiles();
    } catch (err) {
      showToast("error", err.message);
    }

    setUploading(false);
  }

  // ---- Persetujuan admin ----

  async function approve(id) {
    setProcessingId(id);
    try {
      await api(`/api/cms/files/${id}/approve`, { method: "POST", body: {} });
      showToast("success", "Dokumen disetujui, sedang diproses.");
      refreshApproval();
    } catch (err) {
      showToast("error", err.message);
      refreshApproval();
    }
    setProcessingId(null);
  }

  // Buka modal penolakan (bukan window.prompt)
  function openReject(file) {
    setRejectTarget(file);
    setRejectReason("");
  }

  async function confirmApproveAll() {
    setApproveAllOpen(false);
    const ids = pending.filter((f) => f.status === "pending").map((f) => f.id);
    if (ids.length === 0) return;
    setProcessingAll(true);
    setApproveAllProgress({ total: ids.length, done: 0 });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api(`/api/cms/files/${ids[i]}/approve`, { method: "POST", body: {} });
        setApproveAllProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      showToast("success", `${ids.length} dokumen disetujui dan diproses.`);
      refreshApproval();
    } catch (err) {
      showToast("error", err.message);
      refreshApproval();
    }
    setProcessingAll(false);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setProcessingId(id);
    try {
      await api(`/api/cms/files/${id}/reject`, {
        method: "POST",
        body: { reason: rejectReason }
      });
      setRejectTarget(null);
      showToast("success", "Dokumen ditolak.");
      refreshApproval();
    } catch (err) {
      showToast("error", err.message);
      refreshApproval();
    }
    setProcessingId(null);
  }

  async function changeRole(id, role) {
    try {
      await api(`/api/cms/users/${id}`, { method: "PUT", body: { role } });
      showToast("success", "Peran pengguna diperbarui.");
      refreshUsers();
    } catch (err) {
      showToast("error", err.message);
      refreshUsers();
    }
  }

  async function confirmRemoveUser() {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api(`/api/cms/users/${id}`, { method: "DELETE" });
      showToast("success", "Pengguna dihapus.");
      refreshUsers();
    } catch (err) {
      showToast("error", err.message);
      refreshUsers();
    }
  }

  async function confirmResetPassword() {
    const id = resetTarget;
    setResetTarget(null);
    setResetPass("");
    try {
      await api(`/api/cms/users/${id}`, { method: "PUT", body: { password: resetPass } });
      showToast("success", "Kata sandi pengguna direset.");
      refreshUsers();
    } catch (err) {
      showToast("error", err.message);
    }
  }

  async function confirmDeleteDoc() {
    if (!deleteDocTarget) return;
    const id = deleteDocTarget.id;
    setDeleteDocTarget(null);
    try {
      await api(`/api/cms/files/${id}`, { method: "DELETE" });
      showToast("success", "Dokumen dihapus.");
      refreshApproval();
    } catch (err) {
      showToast("error", err.message);
      refreshApproval();
    }
  }

  async function previewFile(f) {
    try {
      await openPdf(`/api/cms/files/${f.id}/download`);
    } catch (err) {
      showToast("error", err.message);
    }
  }

  function logout() {
    clearSession();
    navigate("/cms/login");
  }

  // ---- Render ----

  function toggleSort(k) {
    setSort((s) =>
      s.key === k
        ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: k === "time" ? "desc" : "asc" }
    );
  }

  function sortedRows(rows) {
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (key === "name") return a.originalName.localeCompare(b.originalName) * mul;
      if (key === "size") return ((a.size || 0) - (b.size || 0)) * mul;
      if (key === "uploadedBy") return (a.uploadedBy || "").localeCompare(b.uploadedBy || "") * mul;
      if (key === "status") return (a.status || "").localeCompare(b.status || "") * mul;
      if (key === "time") return (new Date(a.uploadedAt) - new Date(b.uploadedAt)) * mul;
      return 0;
    });
  }

  

  const q = fileSearch.trim().toLowerCase();
  const matchFile = (f) => !q || (f.originalName + " " + (f.uploadedBy || "")).toLowerCase().includes(q);
  const pendingFiltered = sortedRows(pending.filter(matchFile));
  const filteredHistory = sortedRows((historyFilter === "all"
    ? history
    : history.filter((f) => f.status === historyFilter))
    .filter(matchFile));

  const combinedAll = [...pending, ...history.filter((f) => f.status === "approved")];
  const combinedFiltered = sortedRows(combinedAll.filter(matchFile));

  const docCounts = new Map();
  [...pending, ...history].forEach((f) => docCounts.set(f.uploadedBy, (docCounts.get(f.uploadedBy) || 0) + 1));

  const filteredUsers = users.filter((u) => (roleFilter === "all" || u.role === roleFilter) && (!userQ || u.username.toLowerCase().includes(userQ.toLowerCase())));

  const stats = [
    { id: "all", label: "Total Dokumen", value: pending.length + history.filter((f) => f.status === "approved").length, icon: "file", color: "#7fb1e8" },
    { id: "riwayat", label: "Riwayat Pemrosesan", value: history.length, icon: "folder", color: "#64748b" },
    { id: "pending", label: "Menunggu Persetujuan", value: pending.length, icon: "inbox", color: "#e9a319" },
    { id: "approved", label: "Disetujui", value: history.filter((f) => f.status === "approved").length, icon: "check", color: "#059669" },
    { id: "rejected", label: "Ditolak", value: history.filter((f) => f.status === "rejected").length, icon: "x", color: "#dc2626" },
    { id: "error", label: "Gagal Diproses", value: history.filter((f) => f.status === "error").length, icon: "alert", color: "#e9a319" },
    { id: "deleted", label: "Dihapus", value: history.filter((f) => f.status === "deleted").length, icon: "trash", color: "#94a3b8" }
  ];

  

  const roleLabel = user?.role === "admin" ? "Admin" : "Pengelola";
  const initial = (user?.username || "U").charAt(0).toUpperCase();

  return (
    <div
      className="scroll-hover"
      style={{
        height: "100vh",
        background: t.pageBg,
        color: t.text,
        fontFamily: FONT_BODY,
        transition: "background 0.3s ease",
        display: "flex",
        overflow: "hidden"
      }}
    >
      {/* ===== SIDEBAR / TOPBAR ===== */}
      {isMobile ? (
        <div
          style={{
            width: "100%",
            background: t.bar,
            color: t.text,
            borderBottom: "1px solid " + t.border,
            padding: "10px 14px",
            position: "sticky",
            top: 0,
            zIndex: 20,
            boxShadow: "inset 0 -3px 0 0 rgba(233,163,25,0.55)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={dark ? "/logo-kemendag-putih.png" : "/logo-kemendag.png"} alt="Kemendag" style={{ height: 28, borderRadius: 5, background: dark ? "transparent" : "transparent" }} />
            <div style={{ flex: 1 }} />
            <button onClick={() => navigate("/")} title="Kembali ke Chat" style={{ ...topIconBtn, background: dark ? "rgba(255,255,255,0.12)" : "rgba(0,24,69,0.06)", color: dark ? "#e5edf7" : "#001845", border: "1px solid " + (dark ? "rgba(255,255,255,0.3)" : "rgba(0,24,69,0.15)") }}>
              <SIcon name="message" size={16} />
            </button>
            <button onClick={logout} title="Keluar" style={{ ...topIconBtn, background: dark ? "rgba(255,255,255,0.12)" : "rgba(0,24,69,0.06)", color: "#fecaca", border: "1px solid " + (dark ? "rgba(255,255,255,0.3)" : "rgba(0,24,69,0.15)") }}>
              <SIcon name="logout" size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{
                  whiteSpace: "nowrap",
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: tab === n.id ? "1px solid #e9a319" : "1px solid " + (dark ? "rgba(255,255,255,0.12)" : t.border),
                  background: tab === n.id ? "linear-gradient(135deg,#f6c453,#e9a319)" : dark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                  color: tab === n.id ? "#0b1e3a" : dark ? "rgba(255,255,255,0.85)" : t.textSoft,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
                className="top-nav-btn"
              >
                <span style={{ display: "inline-flex" }}><SIcon name={n.icon} size={14} /></span>
                  {n.label}
                  {navCount(n.id) > 0 && (
                    <span style={{
                      background: tab === n.id ? "#0b1e3a" : "#e9a319",
                      color: tab === n.id ? "#e9a319" : "#0b1e3a",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: "3px 7px",
                      borderRadius: 999,
                      marginLeft: 4
                    }}>
                      {navCount(n.id)}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <aside
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{
            width: isOpen ? 250 : 76,
            flexShrink: 0,
            background: "#0f182c",
            color: "#e5edf7",
            padding: isOpen ? "20px 16px" : "12px 4px",
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxSizing: "border-box",
            overflow: "hidden",
            borderRadius: "0 18px 18px 0",
            borderRight: "1px solid #1e2e4a",
            boxShadow: "4px 0 20px rgba(0,0,0,0.22)",
            transition: "width 0.25s ease"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: isOpen ? 10 : 4
            }}
          >
            <img
              src={isOpen ? "/logo-kemendag-putih.png" : "/logo-kemendag.png"}
              alt="Kemendag"
              style={{ height: isOpen ? 40 : 58, borderRadius: isOpen ? 6 : 14, flexShrink: 0 }}
            />
            {isOpen && (
              <button
                onClick={() => setPinned((v) => !v)}
                title={pinned ? "Lepas pin — sidebar mengecil saat kursor keluar" : "Pin — sidebar tetap terbuka"}
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: pinned ? "rgba(233,163,25,0.28)" : "rgba(255,255,255,0.12)",
                  border: "1px solid " + (pinned ? "#e9a319" : "rgba(255,255,255,0.3)"),
                  color: pinned ? "#ffd97a" : "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "inherit",
                  padding: 0,
                  opacity: pinned ? 1 : 0.6
                }}
              >
                {pinned ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                )}
              </button>
            )}
          </div>

          <div
            title={`${user?.username} · ${roleLabel}`}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              padding: isOpen ? "6px 12px" : "6px",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: isOpen ? "flex-start" : "center",
              gap: 8,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              color: "#e5edf7"
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#f6c453,#e9a319)",
                color: "#0b1e3a",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0
              }}
            >
              {initial}
            </span>
            {isOpen && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.username} · {roleLabel}
              </span>
            )}
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                title={isOpen ? n.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isOpen ? "flex-start" : "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: isOpen ? "11px 14px" : "11px 0",
                  borderRadius: tab === n.id ? "0 8px 8px 0" : "8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  border: tab === n.id ? "none" : "none",
                  borderLeft: tab === n.id ? "3px solid #e9a319" : "3px solid transparent",
                  background: tab === n.id ? "rgba(233,163,25,0.12)" : "transparent",
                  color: tab === n.id ? "#ffd97a" : "rgba(255,255,255,0.85)",
                  whiteSpace: "nowrap",
                  overflow: "hidden"
                }}
                onMouseEnter={(e) => { if (tab !== n.id) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { if (tab !== n.id) e.currentTarget.style.background = "transparent"; }}
                className="side-nav-item"
                {...(!isOpen && n.label ? { "data-tip": n.label } : {})}
              >
                <span style={{ flexShrink: 0, position: "relative", display: "inline-flex" }}>
                  <SIcon name={n.icon} size={16} />
                  {!isOpen && navCount(n.id) > 0 && (
                    <span style={{
                      position: "absolute",
                      top: -4,
                      right: -6,
                      minWidth: 15,
                      height: 15,
                      padding: "0 3px",
                      background: "#dc2626",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {navCount(n.id)}
                    </span>
                  )}
                </span>
                {isOpen && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>
                    {navCount(n.id) > 0 && (
                      <span style={{
                        background: "linear-gradient(135deg,#f6c453,#e9a319)",
                        color: "#0b1e3a",
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1,
                        padding: "3px 7px",
                        borderRadius: 999
                      }}>
                        {navCount(n.id)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "4px 0", flexShrink: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SideBtn isOpen={isOpen} t={t} dark={dark} onClick={() => navigate("/")} title="Kembali ke Chat">
              <span style={{ display: "inline-flex" }}><SIcon name="message" size={16} /></span>
              {isOpen && "Kembali ke Chat"}
            </SideBtn>
            <SideBtn isOpen={isOpen} t={t} dark={dark} danger onClick={logout} title="Keluar">
              <span style={{ display: "inline-flex" }}><SIcon name="logout" size={16} /></span>
              {isOpen && "Keluar"}
            </SideBtn>
          </div>
        </aside>
      )}

      {/* ===== KONTEN ===== */}
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: isMobile ? "16px 14px" : "28px 24px" }}>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", width: "100%", maxWidth: 1000, margin: "auto" }} className="fade-in">
          {uploadMsg && tab === "upload" && (
            <div style={{ ...okStyle(t), marginBottom: 16 }}>
              {uploadMsg}
            </div>
          )}

          {/* ===== UPLOAD (maintainer) ===== */}
          {tab === "upload" && (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...cardStyle(t), background: dark ? "#1b2944" : "#eef4ff", border: "1px solid " + (dark ? "#2a3d63" : "#dbeafe"), display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e9a319", color: "#0b1e3a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SIcon name="file" size={16} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.text, fontFamily: FONT_HEADING }}>Cara unggah dokumen</div>
                <div style={{ fontSize: 13, color: t.textSoft, marginTop: 4, lineHeight: 1.5 }}>
                  1. Pilih file PDF maksimal 20 MB &nbsp;·&nbsp; 2. Klik <b style={{ color: t.text }}>Unggah</b> → masuk antrean &nbsp;·&nbsp; 3. Tunggu admin menyetujui (status <span style={{ color: "#059669", fontWeight: 700 }}>Disetujui</span>) &nbsp;·&nbsp; 4. Langsung bisa ditanya di chat
                </div>
              </div>
            </div>
            <div style={cardStyle(t)}>
              <h3 style={h3Style}>Unggah Dokumen Baru</h3>
              <p style={{ fontSize: 14, color: t.textMute, marginTop: 0 }}>
                Dokumen yang diunggah akan menunggu persetujuan admin sebelum dipakai chatbot.
              </p>
              <form onSubmit={doUpload} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ ...inputStyle(t), width: "auto" }}
                />
                <button
                  type="submit"
                  disabled={uploading}
                  style={{ ...primaryBtn, height: 44 }}
                >
                  {uploading ? "Mengunggah..." : "Unggah"}
                </button>
              </form>
              {file && (
                <p style={{ fontSize: 13, color: t.textSoft, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex" }}><SIcon name="file" size={14} /></span>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            </div>
          )}

          {/* ===== DOKUMEN SAYA (maintainer) ===== */}
          {tab === "mydocs" && (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {files.length === 0 && !loading.files ? (
                <div style={cardStyle(t)}>
                  <EmptyState t={t} icon="file" text="Belum ada dokumen diunggah." sub="Mulai dengan mengunggah PDF pertama Anda." />
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                    <button onClick={() => setTab("upload")} style={{ ...primaryBtn, height: 40, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <SIcon name="upload" size={14} /> Unggah sekarang
                    </button>
                  </div>
                </div>
              ) : (
                <FileTable t={t} rows={files} empty="Belum ada dokumen diunggah." loading={loading.files} onView={previewFile} />
              )}
            </div>
          )}

          {/* ===== PERSETUJUAN (admin) ===== */}
          {tab === "approval" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 8, flexShrink: 0, paddingTop: 4 }}>
                {stats.slice(0,4).map((s) => {
                  const isActive = (s.id === "pending" && approvalSub === "pending") || (s.id === "all" && approvalSub === "gabung") || (s.id === "riwayat" && approvalSub === "riwayat" && historyFilter === "all") || (s.id !== "pending" && s.id !== "all" && s.id !== "riwayat" && approvalSub === "riwayat" && historyFilter === s.id);
                  return (
                  <button
                    key={s.label}
                    className="stat-card"
                    onClick={() => {
                      if (s.id === "pending") {
                        setApprovalSub("pending");
                      } else if (s.id === "all") {
                        setApprovalSub("gabung");
                      } else if (s.id === "riwayat") {
                        setApprovalSub("riwayat");
                        setHistoryFilter("all");
                      } else {
                        setApprovalSub("riwayat");
                        setHistoryFilter(s.id);
                      }
                    }}
                    title="Klik untuk menampilkan daftar terkait"
                    style={{
                      background: t.card,
                      border: isActive ? "1px solid #e9a319" : "1px solid " + t.border,
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      minHeight: 68
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: s.color + "1f", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <SIcon name={s.icon} size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT_HEADING, lineHeight: 1.1, color: t.text }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: t.textMute, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                    </div>
                  </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: isMobile ? "wrap" : "nowrap", paddingTop: 0 }}>
                {stats.slice(4).map((s) => {
                  const isActive = (s.id === "pending" && approvalSub === "pending") || (s.id === "all" && approvalSub === "gabung") || (s.id === "riwayat" && approvalSub === "riwayat" && historyFilter === "all") || (s.id !== "pending" && s.id !== "all" && s.id !== "riwayat" && approvalSub === "riwayat" && historyFilter === s.id);
                  return (
                  <button
                    key={s.label}
                    className="stat-card"
                    onClick={() => {
                      if (s.id === "pending") {
                        setApprovalSub("pending");
                      } else if (s.id === "all") {
                        setApprovalSub("gabung");
                      } else if (s.id === "riwayat") {
                        setApprovalSub("riwayat");
                        setHistoryFilter("all");
                      } else {
                        setApprovalSub("riwayat");
                        setHistoryFilter(s.id);
                      }
                    }}
                    title="Klik untuk menampilkan daftar terkait"
                    style={{
                      background: t.card,
                      border: isActive ? "1px solid #e9a319" : "1px solid " + t.border,
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      flex: isMobile ? "1 1 calc(50% - 5px)" : "0 0 calc(25% - 7.5px)",
                      maxWidth: isMobile ? "calc(50% - 5px)" : "calc(25% - 7.5px)",
                      minWidth: 0,
                      minHeight: 68,
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: s.color + "1f", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <SIcon name={s.icon} size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT_HEADING, lineHeight: 1.1, color: t.text }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: t.textMute, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                    </div>
                  </button>
                  );
                })}
              </div>

              {approvalSub === "pending" && (
              <div style={{ ...cardStyle(t), display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap", flexShrink: 0 }}>
                  <h3 style={{ ...h3Style, margin: 0 }}>Menunggu Persetujuan ({pendingFiltered.length})</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Cari file atau pengunggah..."
                        className="cms-input"
                        style={{
                          padding: "7px 30px 7px 14px",
                          borderRadius: 999,
                          border: "1px solid " + t.border,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 13,
                          outline: "none",
                          width: 300,
                          fontFamily: "inherit",
                          boxSizing: "border-box"
                        }}
                      />
                      {fileSearch && (
                        <button
                          onClick={() => setFileSearch("")}
                          title="Hapus pencarian"
                          style={{
                            position: "absolute",
                            right: 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: "none",
                            background: t.border,
                            color: t.textSoft,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "inherit",
                            padding: 0,
                            lineHeight: 1
                          }}
                        >
                          <SIcon name="x" size={10} />
                        </button>
                      )}
                    </div>
                    {pending.length > 0 && (
                    <button
                      onClick={() => setApproveAllOpen(true)}
                      disabled={processingId !== null || processingAll}
                      title="Terima & proses semua dokumen menunggu"
                      style={{
                        ...smallBtn("#059669"),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        ...(processingId !== null || processingAll ? { opacity: 0.6, cursor: "not-allowed" } : {})
                      }}
                    >
                      <SIcon name="check" size={13} />
                      {processingAll ? `Memproses ${approveAllProgress.done}/${approveAllProgress.total}…` : `Terima Semua (${pending.filter((f) => f.status === "pending").length})`}
                    </button>
                    )}
                  </div>
                </div>
                {loading.approval && pending.length === 0 ? (
                  <LoadingBlock t={t} text="Memuat daftar persetujuan…" />
                ) : pending.length === 0 ? (
                  <EmptyState t={t} icon="inbox" text="Tidak ada dokumen menunggu persetujuan." />
                ) : pendingFiltered.length === 0 ? (
                  <p style={{ fontSize: 14, color: t.textMute, margin: 0, padding: "12px 4px" }}>
                    Tidak ada dokumen yang cocok dengan pencarian "{fileSearch}".
                  </p>
                ) : (
                  <>
                  <div style={{ overflow: "auto", maxHeight: "calc(100vh - 320px)" }}>
                    <table style={tableStyle(t)} className="zebra">
                      <thead>
                        <tr>
                          <SortTh label="Dokumen" k="name" t={t} sortKey={sort.key} sortDir={sort.dir} onSort={toggleSort} style={{ width: 400 }} />
                          <SortTh label="Waktu" k="time" t={t} sortKey={sort.key} sortDir={sort.dir} onSort={toggleSort} style={{ width: 160 }} />
                          <Th t={t} style={{ width: 260 }}>Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
{pendingFiltered.map((f) => (
                          <tr key={f.id} className="hover-row">
                            <FileCell f={f} t={t} maxWidth={400} meta={`${formatSize(f.size)} · ${f.uploadedBy}`} />
                            <Td t={t} style={{ whiteSpace: "nowrap", width: 160 }}>{fmtDate(f.uploadedAt)}</Td>
                            <Td t={t} style={{ whiteSpace: "nowrap", width: 260 }}>
                              {f.status === "processing" ? (
                                <span title="Dokumen sedang diproses di latar belakang" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, fontSize: 13, background: "#e9a3191f", color: "#e9a319" }}>
                                  <span style={{ display: "inline-flex", marginRight: 2 }}><SIcon name="inbox" size={13} /></span>Diproses…
                                </span>
                              ) : (
                              <>
                              <button onClick={() => previewFile(f)} style={{ ...smallBtn("#64748b"), ...(processingId !== null ? { opacity: 0.6, cursor: "not-allowed" } : {}) }} title="Pratinjau dokumen" disabled={processingId !== null}><span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle" }}><SIcon name="file" size={13} /></span>Lihat</button>
                              <button onClick={() => approve(f.id)} style={{ ...smallBtn("#059669"), ...(processingId !== null ? { opacity: 0.6, cursor: "not-allowed" } : {}) }} title="Terima & proses dokumen" disabled={processingId !== null}><span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle" }}><SIcon name="check" size={13} /></span>{processingId === f.id ? "Memproses…" : "Terima"}</button>
                              <button onClick={() => openReject(f)} style={{ ...smallBtn("#dc2626"), ...(processingId !== null ? { opacity: 0.6, cursor: "not-allowed" } : {}) }} title="Tolak dokumen" disabled={processingId !== null}><span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle" }}><SIcon name="x" size={13} /></span>Tolak</button>
                              </>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
              )}

              {approvalSub === "riwayat" && (
              <div style={{ ...cardStyle(t), display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14, flexShrink: 0 }}>
                  <div>
                    <h3 style={{ ...h3Style, margin: 0 }}>{historyFilter === "all" ? "Riwayat Pemrosesan" : historyFilter === "approved" ? "Disetujui" : historyFilter === "rejected" ? "Ditolak" : historyFilter === "error" ? "Gagal Diproses" : "Dihapus"} ({filteredHistory.length})</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Cari file atau pengunggah..."
                        className="cms-input"
                        style={{
                          padding: "7px 30px 7px 14px",
                          borderRadius: 999,
                          border: "1px solid " + t.border,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 13,
                          outline: "none",
                          width: 300,
                          fontFamily: "inherit",
                          boxSizing: "border-box"
                        }}
                      />
                      {fileSearch && (
                        <button
                          onClick={() => setFileSearch("")}
                          title="Hapus pencarian"
                          style={{
                            position: "absolute",
                            right: 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: "none",
                            background: t.border,
                            color: t.textSoft,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "inherit",
                            padding: 0,
                            lineHeight: 1
                          }}
                        >
                          <SIcon name="x" size={10} />
                        </button>
                      )}
                    </div>
                </div>
                </div>
                <FileTable t={t} rows={filteredHistory} empty="Tidak ada riwayat." sub="Dokumen yang sudah diproses akan tampil di sini." loading={loading.approval} sortable sortKey={sort.key} sortDir={sort.dir} onSort={toggleSort} onDelete={setDeleteDocTarget} onDetail={setDetailTarget} onView={previewFile} maxHeight="calc(100vh - 320px)" bare />
              </div>
              )}

              {approvalSub === "gabung" && (
              <div style={{ ...cardStyle(t), display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14, flexShrink: 0 }}>
                  <div>
                    <h3 style={{ ...h3Style, margin: 0 }}>Total Dokumen ({combinedFiltered.length})</h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Cari file atau pengunggah..."
                        className="cms-input"
                        style={{
                          padding: "7px 30px 7px 14px",
                          borderRadius: 999,
                          border: "1px solid " + t.border,
                          background: t.inputBg,
                          color: t.text,
                          fontSize: 13,
                          outline: "none",
                          width: 300,
                          fontFamily: "inherit",
                          boxSizing: "border-box"
                        }}
                      />
                      {fileSearch && (
                        <button
                          onClick={() => setFileSearch("")}
                          title="Hapus pencarian"
                          style={{
                            position: "absolute",
                            right: 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: "none",
                            background: t.border,
                            color: t.textSoft,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "inherit",
                            padding: 0,
                            lineHeight: 1
                          }}
                        >
                          <SIcon name="x" size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <FileTable t={t} rows={combinedFiltered} empty="Tidak ada dokumen." sub="Belum ada dokumen di dalam sistem." loading={loading.approval} sortable sortKey={sort.key} sortDir={sort.dir} onSort={toggleSort} onDelete={setDeleteDocTarget} onDetail={setDetailTarget} onView={previewFile} maxHeight="calc(100vh - 320px)" bare />
              </div>
              )}
            </div>
          )}

          {/* ===== KELOLA USER (admin) ===== */}
          {tab === "users" && (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
                {[
                  { id: "all", label: "Total Pengguna", value: users.length, icon: "users", color: "#7fb1e8" },
                  { id: "admin", label: "Admin", value: users.filter((x) => x.role === "admin").length, icon: "shield", color: "#e9a319" },
                  { id: "maintainer", label: "Pengelola", value: users.filter((x) => x.role === "maintainer").length, icon: "user", color: "#10b981" }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setRoleFilter(s.id)}
                    title="Klik untuk menampilkan daftar terkait"
                    className="stat-card"
                    style={{
                      background: t.card,
                      border: roleFilter === s.id ? "1px solid #e9a319" : "1px solid " + t.border,
                      borderRadius: 16,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease"
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: s.color + "1f", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <SIcon name={s.icon} size={17} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT_HEADING, lineHeight: 1.1, color: t.text }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: t.textMute, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={cardStyle(t)}>
                <h3 style={{ ...h3Style, display: "flex", alignItems: "center", gap: 8 }}>
                  <SIcon name="user-plus" size={17} />
                  Tambah Pengguna
                </h3>
                <form onSubmit={(e) => { e.preventDefault(); createUser(); }} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMute, display: "flex", pointerEvents: "none" }}>
                      <SIcon name="user" size={14} />
                    </span>
                    <input
                      placeholder="Nama Pengguna"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      style={{ ...inputStyle(t), height: 40, minWidth: 190, padding: "7px 14px 7px 36px", fontSize: 13.5 }}
                    />
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: t.textMute, display: "flex", pointerEvents: "none" }}>
                      <SIcon name="key" size={14} />
                    </span>
                    <input
                      type="password"
                      placeholder="Kata Sandi (min. 6)"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      style={{ ...inputStyle(t), height: 40, minWidth: 190, padding: "7px 14px 7px 36px", fontSize: 13.5 }}
                    />
                  </div>
                  <RoleSelect role={newUser.role} onSelect={(r) => setNewUser({ ...newUser, role: r })} t={t} dark={dark} />
                  <button
                    type="submit"
                    className="add-user-btn"
                    style={{
                      height: 40,
                      padding: "0 24px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7
                    }}
                  >
                    <SIcon name="user-plus" size={14} />
                    Tambah
                  </button>
                </form>
                {userMsg && <p style={okStyle(t)}>{userMsg}</p>}
              </div>
              <div style={cardStyle(t)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ ...h3Style, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <SIcon name="users" size={17} />
                    Daftar Pengguna
                  </h3>
                  <div style={{ position: "relative" }}>
                    <input
                      value={userQ}
                      onChange={(e) => setUserQ(e.target.value)}
                      placeholder="Cari pengguna..."
                      className="cms-input"
                      style={{
                        padding: "7px 30px 7px 14px",
                        borderRadius: 999,
                        border: "1px solid " + t.border,
                        background: t.inputBg,
                        color: t.text,
                        fontSize: 13,
                        outline: "none",
                        width: 300,
                        fontFamily: "inherit",
                        boxSizing: "border-box"
                      }}
                    />
                    {userQ && (
                      <button
                        onClick={() => setUserQ("")}
                        title="Hapus pencarian"
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textSoft, cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                      >
                        <SIcon name="x" size={10} />
                      </button>
                    )}
                  </div>
                </div>
                {loading.users && users.length === 0 ? (
                  <LoadingBlock t={t} text="Memuat daftar pengguna…" />
                ) : users.length === 0 ? (
                  <EmptyState t={t} icon="users" text="Belum ada pengguna." />
                ) : filteredUsers.length === 0 ? (
                  <EmptyState t={t} icon="users" text="Tidak ada pengguna yang cocok." sub="Ubah kata kunci pencarian atau filter role." />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle(t)} className="zebra">
                      <thead>
                        <tr>
                          <Th t={t}>Nama Pengguna</Th><Th t={t}>Peran</Th><Th t={t}>Dokumen</Th><Th t={t}>Aksi</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover-row">
                            <Td t={t}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: "50%", background: roleColor(u.role) + "22", border: "1px solid " + roleColor(u.role) + "55", color: roleColor(u.role), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                  {u.username.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 600 }}>{u.username}</span>
                                {u.id === user.id && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(233,163,25,0.14)", border: "1px solid rgba(233,163,25,0.55)", color: "#e9a319", whiteSpace: "nowrap" }}>Anda</span>
                                )}
                              </div>
                            </Td>
                            <Td t={t}>
                              <select
                                value={u.role}
                                disabled={u.id === user.id}
                                onChange={(e) => changeRole(u.id, e.target.value)}
                                style={{
                                  ...inputStyle(t),
                                  minWidth: 128,
                                  width: 128,
                                  padding: "6px 10px",
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  borderRadius: 999,
                                  background: roleColor(u.role) + "1f",
                                  border: "1px solid " + roleColor(u.role) + "66",
                                  color: roleColor(u.role),
                                  cursor: u.id === user.id ? "not-allowed" : "pointer",
                                  opacity: u.id === user.id ? 0.65 : 1
                                }}
                              >
                                <option value="maintainer">Pengelola</option>
                                <option value="admin">Admin</option>
                              </select>
                            </Td>
                            <Td t={t}>
                              {docCounts.get(u.username) || 0}
                            </Td>
                            <Td t={t}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {u.id !== user.id && (
                                  <>
                                    <button
                                      onClick={() => { setResetTarget(u.id); setResetPass(""); }}
                                      style={smallBtn("#64748b")}
                                      title={`Atur ulang kata sandi ${u.username}`}
                                    >
                                      <span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle" }}><SIcon name="key" size={13} /></span>
                                      Atur Ulang
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarget(u.id)}
                                      style={smallBtn("#dc2626")}
                                      title={`Hapus pengguna ${u.username}`}
                                    >
                                      <span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle" }}><SIcon name="trash" size={13} /></span>
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== LOG AKTIVITAS (admin) ===== */}
          {tab === "logs" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ ...cardStyle(t), display: "flex", flexDirection: "column", minHeight: 0, flex: 1, marginBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12, flexShrink: 0 }}>
                <h3 style={{ ...h3Style, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                  <SIcon name="file" size={17} />
                  Riwayat Aktivitas
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={{ ...inputStyle(t), height: 36, padding: "7px 14px", fontSize: 13, borderRadius: 999, width: 150 }} />
                  <span style={{ fontSize: 12, color: t.textMute, whiteSpace: "nowrap", background: t.cardSoft, border: "1px solid " + t.borderSoft, borderRadius: 999, padding: "5px 10px" }}>{logs.filter((l) => String(l.timestamp || "").slice(0, 10) === logDate).length} aktivitas</span>
                </div>
              </div>
              {(() => {
                const filteredLogs = logs.filter((l) => String(l.timestamp || "").slice(0, 10) === logDate);
                if (loading.logs && logs.length === 0) return <LoadingBlock t={t} text="Memuat riwayat aktivitas…" />;
                if (filteredLogs.length === 0) return <EmptyState t={t} icon="file" text={logs.length === 0 ? "Belum ada aktivitas masuk." : `Tidak ada aktivitas pada ${logDate}.`} sub={logs.length === 0 ? undefined : "Pilih tanggal lain di atas."} />;
                return (
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", maxHeight: "calc(100vh - 380px)" }}>
                  <table style={tableStyle(t)} className="zebra">
                    <thead>
                      <tr>
                        <Th t={t}>Pengguna</Th><Th t={t}>Waktu</Th><Th t={t}>Perangkat</Th><Th t={t}>Browser</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((l) => (
                        <tr key={l.id} className="hover-row">
                          <Td t={t}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#64748b22", border: "1px solid #64748b55", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>
                                {(l.username || "?").charAt(0).toUpperCase()}
                              </div>
                              <span>{l.username}</span>
                            </div>
                          </Td>
                          <Td t={t}>{fmtDate(l.timestamp)}</Td>
                          <Td t={t}>{l.device || "-"}</Td>
                          <Td t={t}>{[l.browser, l.os].filter(Boolean).join(" · ") || "-"}</Td>
                        </tr>
))}
                    </tbody>
                  </table>
                </div>
                );
              })()}
            </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== MODAL: Terima Semua ===== */}
      {approveAllOpen && (
        <Modal
          t={t}
          title={`Terima semua ${pending.length} dokumen?`}
          onClose={() => setApproveAllOpen(false)}
          onConfirm={confirmApproveAll}
          confirmLabel="Ya, Terima Semua"
          confirmColor="#059669"
        >
          <p style={{ margin: 0, fontSize: 14, color: t.textSoft }}>
            Semua dokumen yang menunggu akan disetujui dan langsung diproses oleh sistem. Tindakan ini tidak dapat dibatalkan satu per satu.
          </p>
        </Modal>
      )}

      {/* ===== MODAL: Detail Dokumen ===== */}
      {detailTarget && (
        <Modal
          t={t}
          title="Detail Dokumen"
          onClose={() => setDetailTarget(null)}
          onConfirm={() => setDetailTarget(null)}
          confirmLabel="Tutup"
          confirmColor="#004DAF"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            {[
              { label: "Dokumen", value: detailTarget.originalName },
              { label: "Ukuran", value: formatSize(detailTarget.size) },
              { label: "Pengunggah", value: detailTarget.uploadedBy },
              { label: "Waktu Unggah", value: fmtDate(detailTarget.uploadedAt) },
              { label: "Status", value: detailTarget.status === "pending" ? "Menunggu" : detailTarget.status === "processing" ? "Diproses…" : detailTarget.status === "approved" ? "Disetujui" : detailTarget.status === "error" ? "Gagal Diproses" : detailTarget.status === "deleted" ? "Dihapus" : "Ditolak" },
              ...(detailTarget.approvedAt ? [
                { label: "Waktu Diproses", value: fmtDate(detailTarget.approvedAt) },
                { label: "Diproses Oleh", value: detailTarget.approvedBy || "-" }
              ] : []),
              ...(detailTarget.rejectedAt ? [
                { label: "Waktu Ditolak", value: fmtDate(detailTarget.rejectedAt) },
                { label: "Ditolak Oleh", value: detailTarget.rejectedBy || "-" },
                { label: "Alasan Penolakan", value: detailTarget.rejectReason || "-" }
              ] : []),
              ...(detailTarget.error ? [
                { label: "Pesan Error", value: detailTarget.error }
              ] : []),
              ...(detailTarget.deletedAt ? [
                { label: "Waktu Dihapus", value: fmtDate(detailTarget.deletedAt) },
                { label: "Dihapus Oleh", value: detailTarget.deletedBy || "-" }
              ] : [])
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", gap: 10 }}>
                <span style={{ width: 110, flexShrink: 0, color: t.textMute }}>{r.label}</span>
                <span style={{ color: t.text, fontWeight: 600, wordBreak: "break-word" }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ width: 110, flexShrink: 0, color: t.textMute }}>Catatan</span>
              <span
                style={{
                  color: t.text,
                  wordBreak: "break-word",
                  background: t.cardSoft,
                  border: "1px solid " + t.border,
                  borderRadius: 10,
                  padding: "10px 12px",
                  flex: 1
                }}
              >
                {detailTarget.rejectReason || detailTarget.error || "-"}
              </span>
                </div>
                {detailTarget.status !== "deleted" && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                    <button
                      onClick={() => previewFile(detailTarget)}
                      style={{
                        ...smallBtn("#64748b"),
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                      }}
                      title="Buka PDF dokumen ini"
                    >
                      <span style={{ display: "inline-flex" }}><SIcon name="file" size={13} /></span>
                      Unduh PDF
                    </button>
                  </div>
                )}
            </div>
          </Modal>
          )}

      {/* ===== MODAL: Alasan Penolakan ===== */}
      {rejectTarget && (
        <Modal
          t={t}
          title={`Tolak dokumen "${rejectTarget.originalName}"?`}
          onClose={() => setRejectTarget(null)}
          onConfirm={confirmReject}
          confirmLabel="Tolak Dokumen"
          confirmColor="#dc2626"
          confirmDisabled={!rejectReason.trim()}
        >
          <p style={{ margin: "0 0 12px", fontSize: 14, color: t.textSoft }}>
            Alasan penolakan akan dicatat dan ditampilkan kepada pengunggah.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {PRESET_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setRejectReason(rejectReason === r ? "" : r)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid " + (rejectReason === r ? "#dc2626" : t.border),
                  background: rejectReason === r ? "rgba(220,38,38,0.1)" : "none",
                  color: rejectReason === r ? "#dc2626" : t.textSoft,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit"
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tulis alasan penolakan (wajib diisi)..."
            rows={3}
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: 12,
              border: "1px solid " + (rejectReason.trim() ? t.border : "#dc2626"),
              background: t.inputBg,
              color: t.text,
              fontSize: 14,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
          {!rejectReason.trim() && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#dc2626" }}>
              Alasan wajib diisi sebelum menolak dokumen.
            </p>
          )}
        </Modal>
      )}

      {/* ===== MODAL: Konfirmasi Hapus User ===== */}
      {deleteTarget && (
        <Modal
          t={t}
          title={`Hapus pengguna "${users.find((u) => u.id === deleteTarget)?.username || ""}"?`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmRemoveUser}
          confirmLabel="Ya, Hapus"
          confirmColor="#dc2626"
        >
          <p style={{ margin: 0, fontSize: 14, color: t.textSoft }}>
            Tindakan ini tidak dapat dibatalkan. Pengguna tidak akan bisa login lagi.
          </p>
        </Modal>
      )}

      {/* ===== MODAL: Atur Ulang Kata Sandi ===== */}
      {resetTarget && (
        <Modal
          t={t}
          title={`Atur ulang kata sandi "${users.find((u) => u.id === resetTarget)?.username || ""}"`}
          onClose={() => setResetTarget(null)}
          onConfirm={confirmResetPassword}
          confirmLabel="Simpan Kata Sandi"
          confirmColor="#059669"
          confirmDisabled={resetPass.length < 6}
        >
          <input
            type="password"
            placeholder="Kata Sandi baru (min. 6)"
            value={resetPass}
            onChange={(e) => setResetPass(e.target.value)}
            autoFocus
            style={{ ...inputStyle(t), width: "100%", boxSizing: "border-box" }}
          />
        </Modal>
      )}

      {/* ===== MODAL: Konfirmasi Hapus Dokumen ===== */}
      {deleteDocTarget && (
        <Modal
          t={t}
          title={`Hapus dokumen "${deleteDocTarget.originalName}"?`}
          onClose={() => setDeleteDocTarget(null)}
          onConfirm={confirmDeleteDoc}
          confirmLabel="Ya, Hapus"
          confirmColor="#dc2626"
        >
          <p style={{ margin: 0, fontSize: 14, color: t.textSoft }}>
            Dokumen akan dihapus dari sistem: file PDF, data vektor untuk pencarian AI, dan riwayat akses chatbot.
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </Modal>
      )}

      {/* ===== TOAST ===== */}
      {toasts.length > 0 && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1200, display: "flex", flexDirection: "column", gap: 10, maxWidth: "calc(100% - 40px)" }}>
          {toasts.map((tst) => (
            <div
              key={tst.id}
              className="pop-in"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderRadius: 999,
                background: tst.type === "error" ? "#dc2626" : "#059669",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                maxWidth: 360
              }}
            >
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <SIcon name={tst.type === "error" ? "x" : "check"} size={14} />
              </span>
              {tst.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ---- Fungsi tambah user (dibutuhkan submit handler) ----
  async function createUser() {
    setUserMsg("");
    try {
      const data = await api("/api/cms/users", {
        method: "POST",
        body: {
          username: newUser.username.trim(),
          password: newUser.password,
          role: newUser.role
        }
      });
      setUserMsg(data.message || "Pengguna dibuat.");
      showToast("success", data.message || "Pengguna dibuat.");
      setNewUser({ username: "", password: "", role: "maintainer" });
      refreshUsers();
    } catch (err) {
      showToast("error", err.message);
    }
  }
}

// ---- Komponen kecil styling (agar JSX di atas ringkas) ----

// ---- Ikon SVG garis tipis (feather) — selaras dgn halaman lain ----
function SIcon({ name, size = 15 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  switch (name) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...common}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "user-plus":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
      case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      );
    default:
      return null;
  }
}

// Pemilih role (meniru gaya ModelSelector di halaman chat)
function RoleSelect({ role, onSelect, t, dark }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const options = [
    { id: "maintainer", label: "Pengelola", desc: "Unggah & kelola dokumen", icon: "user", color: "#10b981" },
    { id: "admin", label: "Admin", desc: "Akses penuh sistem", icon: "shield", color: "#e9a319" }
  ];
  const cur = options.find((o) => o.id === role) || options[0];
  const mt = {
    card: dark ? "#151f36" : "#ffffff",
    border: dark ? "#2a3752" : "#d4dce8",
    borderSoft: dark ? "#1f2a44" : "#e2e8f0",
    text: dark ? "#e5edf7" : "#1e293b",
    textMute: dark ? "#8b98ad" : "#64748b",
    itemBg: dark ? "#1b2740" : "#eef6fd",
    itemHover: dark ? "#24345a" : "#f1f5f9",
    itemIdle: dark ? "#1b2740" : "#f8fafc"
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Pilih role"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "6px 12px",
          borderRadius: 999,
          border: open ? "1px solid " + t.accent : "1px solid " + t.border,
          background: open ? mt.itemBg : t.inputBg,
          color: t.text,
          outline: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13.5,
          boxSizing: "border-box",
          whiteSpace: "nowrap",
          transition: "border-color 0.15s ease, background 0.15s ease"
        }}
      >
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 8, background: cur.color + "1f", color: cur.color }}>
          <SIcon name={cur.icon} size={13} />
        </span>
        <span style={{ fontWeight: 700, color: cur.color }}>{cur.label}</span>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMute, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", marginLeft: 4 }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div
          className="pop-in"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: 250,
            background: mt.card,
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            border: "1px solid " + mt.border,
            zIndex: 30,
            paddingBottom: 8
          }}
        >
          <div style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: mt.textMute, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid " + mt.borderSoft, background: mt.card, borderRadius: "14px 14px 0 0" }}>
            Pilih Peran
          </div>
          <div style={{ padding: "4px 6px 0" }}>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onSelect(o.id); setOpen(false); }}
                onMouseEnter={(e) => { if (o.id !== role) e.currentTarget.style.background = mt.itemHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = o.id === role ? mt.itemBg : mt.itemIdle; }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  marginBottom: 5,
                  borderRadius: 10,
                  border: o.id === role
                    ? "1px solid " + t.accent
                    : "1px solid " + (dark ? "#2a3752" : "#e2e8f0"),
                  background: o.id === role ? mt.itemBg : mt.itemIdle,
                  boxShadow: o.id === role ? "0 2px 10px rgba(0,77,175,0.18)" : "0 1px 3px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: mt.text
                }}
              >
                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: o.color + "1f", color: o.color, fontWeight: 700 }}>
                  <SIcon name={o.icon} size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div>
                  <div style={{ fontSize: 12, color: mt.textMute, marginTop: 1 }}>{o.desc}</div>
                </div>
                {o.id === role && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#e9a319", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Aktif
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SideBtn({ children, onClick, danger, isOpen, title, t, dark }) {
  return (
    <button
      onClick={onClick}
      title={isOpen ? title : undefined}
      className={`side-btn${danger ? " danger" : ""}`}
      {...(!isOpen && title ? { "data-tip": title } : {})}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isOpen ? "flex-start" : "center",
        gap: 10,
        width: "100%",
        background: danger ? "rgba(220,38,38,0.18)" : "rgba(255,255,255,0.08)",
        border: "1px solid " + (danger ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.14)"),
        color: danger ? "#fecaca" : "#e5edf7",
        padding: isOpen ? "10px 14px" : "10px 0",
        borderRadius: 999,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13.5,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        overflow: "hidden",
        transition: "background 0.15s ease"
      }}
    >
      {children}
    </button>
  );
}

const topIconBtn = {
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.35)",
  width: 38,
  height: 38,
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 15,
  fontFamily: "inherit",
  flexShrink: 0
};

function EmptyState({ icon, text, sub, t }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 10px", color: t.textMute }} className="fade-in">
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
        <SIcon name={icon} size={34} />
      </div>
      <div style={{ fontSize: 14 }}>{text}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>{sub}</div>}
    </div>
  );
}

const roleColor = (role) => (role === "admin" ? "#e9a319" : "#10b981");

function FileTable({ rows, empty, sub, title, onDelete, onDetail, onView, t, loading = false, sortable = false, sortKey, sortDir, onSort, fill = false, maxHeight, bare = false }) {
  const statusLabel = (status) =>
    status === "pending" ? "Menunggu"
    : status === "processing" ? "Diproses…"
    : status === "approved" ? "Disetujui"
    : status === "error" ? "Gagal Diproses"
    : status === "deleted" ? "Dihapus"
    : "Ditolak";

  return (
    <div style={{ ...(bare ? {} : cardStyle(t)), ...(fill ? { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflow: "hidden", marginBottom: 0 } : {}) }}>
      {title && <h3 style={h3Style}>{title}</h3>}
      {loading && rows.length === 0 ? (
        <LoadingBlock t={t} />
      ) : rows.length === 0 ? (
        <EmptyState t={t} icon="file" text={empty} sub={sub} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", ...(maxHeight ? { maxHeight } : {}) }}>
          <table style={tableStyle(t)} className="zebra">
            <thead>
              <tr>
                {sortable ? (
                  <>
                    <SortTh label="Dokumen" k="name" t={t} sortKey={sortKey} sortDir={sortDir} onSort={onSort} style={{ width: 300 }} />
                    <SortTh label="Status" k="status" t={t} sortKey={sortKey} sortDir={sortDir} onSort={onSort} style={{ width: 140 }} />
                    <SortTh label="Waktu" k="time" t={t} sortKey={sortKey} sortDir={sortDir} onSort={onSort} style={{ width: 160 }} />
                  </>
                ) : (
                  <>
                    <Th t={t} style={{ width: 300 }}>Dokumen</Th><Th t={t} style={{ width: 140 }}>Status</Th><Th t={t} style={{ width: 160 }}>Waktu</Th>
                  </>
                )}
                <Th t={t}>Catatan</Th>
                {(onDelete || onView) && <Th t={t} style={{ width: 80 }}>Aksi</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className="hover-row"
                  style={f.status === "error" ? { background: "rgba(220,38,38,0.06)" } : undefined}
                >
                  <FileCell f={f} t={t} maxWidth={300} meta={`${formatSize(f.size)}${f.uploadedBy ? " · " + f.uploadedBy : ""}`} style={f.status === "error" ? { borderLeft: "3px solid #dc2626" } : undefined} />
                  <Td t={t} style={{ whiteSpace: "nowrap", width: 140 }}>
                    <span style={statusBadge(t)[f.status] || statusBadge(t).pending}>
                      {statusLabel(f.status)}
                      {f.status === "deleted" && f.deletedBy ? ` oleh ${f.deletedBy}` : ""}
                    </span>
                  </Td>
                  <Td t={t} style={{ whiteSpace: "nowrap", width: 160 }}>{fmtDate(f.uploadedAt)}</Td>
                  <Td t={t} style={{ maxWidth: 200 }}>
                    {f.rejectReason || f.error ? (
                      <button
                        onClick={() => onDetail && onDetail(f)}
                        title="Klik untuk melihat detail"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: t.accent,
                          cursor: "pointer",
                          fontSize: 14,
                          fontFamily: "inherit",
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 200,
                          display: "block"
                        }}
                      >
                        {f.rejectReason || (f.error ? f.error.slice(0, 60) + "…" : "-")}
                      </button>
                    ) : (
                      "-"
                    )}
                  </Td>
                  {(onDelete || onView) && (
                    <Td t={t} style={{ whiteSpace: "nowrap", width: 80 }}>
                      {f.status === "approved" && onView && (
                        <button
                          onClick={() => onView(f)}
                          title={`Buka PDF ${f.originalName}`}
                          className="del-ghost"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "5px 8px",
                            borderRadius: 999,
                            color: t.accent,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            lineHeight: 1,
                            marginRight: 4
                          }}
                        >
                          <SIcon name="file" size={15} />
                        </button>
                      )}
                      {["approved", "error"].includes(f.status) && (
                        <button
                          onClick={() => onDelete(f)}
                          title={`Hapus dokumen ${f.originalName}`}
                          className="del-ghost"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "5px 8px",
                            borderRadius: 999,
                            color: t.textMute,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            lineHeight: 1
                          }}
                        >
                          <SIcon name="trash" size={15} />
                        </button>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const h3Style = { margin: "0 0 14px", fontSize: 17, fontFamily: FONT_HEADING, letterSpacing: "-0.3px" };

function LoadingBlock({ t, text = "Memuat…" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.textMute, fontSize: 14, padding: "18px 4px" }}>
      <span
        style={{
          width: 16,
          height: 16,
          border: "2px solid " + t.border,
          borderTopColor: t.accent,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          display: "inline-block"
        }}
      />
      {text}
    </div>
  );
}

function cardStyle(t) {
  return {
    background: t.card,
    border: "1px solid " + t.border,
    borderRadius: 16,
    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
    padding: 20,
    marginBottom: 18,
    transition: "background 0.3s ease"
  };
}

function inputStyle(t) {
  return {
    padding: "11px 14px",
    borderRadius: 999,
    border: "1px solid " + t.border,
    background: t.inputBg,
    color: t.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit"
  };
}

const primaryBtn = {
  background: "#004DAF",
  color: "#fff",
  border: "none",
  padding: "0 22px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 600,
  fontFamily: "inherit",
  boxShadow: "0 4px 14px rgba(0,77,175,0.35)"
};

function okStyle(t) {
  return {
    background: t.cardSoft,
    border: "1px solid #059669",
    color: t.accent,
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600
  };
}

function tableStyle(t) {
  return { width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 560 };
}

function Th({ children, t, style }) {
  return <th style={{ ...thStyle(t), ...style }}>{children}</th>;
}

function SortTh({ label, k, t, sortKey, sortDir, onSort, style }) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        ...thStyle(t),
        cursor: "pointer",
        userSelect: "none",
        fontWeight: active ? 700 : 600,
        color: active ? t.accent : t.textMute,
        ...style
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {active && <span style={{ fontSize: 9, lineHeight: 1 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
      </span>
    </th>
  );
}

function thStyle(t) {
  return {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "2px solid " + t.border,
    color: t.textMute,
    fontSize: 13,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    background: t.card,
    zIndex: 2
  };
}

function Td({ children, t, style }) {
  return (
    <td style={{ padding: "10px 8px", borderBottom: "1px solid " + t.border, color: t.text, verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
}

function FileCell({ f, t, maxWidth = 300, style, meta }) {
  return (
    <Td t={t} style={{ maxWidth, width: maxWidth, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ display: "inline-flex", flexShrink: 0, color: t.textMute }}><SIcon name="file" size={15} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            title={f.originalName}
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.text }}
          >
            {f.originalName}
          </div>
          {meta && (
            <div style={{ fontSize: 12, color: t.textMute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {meta}
            </div>
          )}
        </div>
      </div>
    </Td>
  );
}

function smallBtn(color) {
  return {
    background: color,
    color: "#fff",
    border: "none",
    padding: "7px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    marginRight: 6,
    fontFamily: "inherit"
  };
}

function statusBadge(t) {
  return {
    approved: { background: t.cardSoft, color: t.dark ? "#6ee7b7" : "#059669", border: "1px solid #059669", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
    rejected: { background: t.cardSoft, color: t.dark ? "#fecaca" : "#dc2626", border: "1px solid #dc2626", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
    pending: { background: t.cardSoft, color: "#d97706", border: "1px solid #d97706", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
    error: { background: t.cardSoft, color: t.dark ? "#c3cede" : "#475569", border: "1px solid " + t.border, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
    deleted: { background: t.cardSoft, color: t.dark ? "#8b98ad" : "#64748b", border: "1px solid " + t.border, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }
  };
}
