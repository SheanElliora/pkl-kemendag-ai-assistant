import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser, clearSession, fmtDate } from "../api.js";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB, sama dengan backend

// ---- Modal yang dipakai untuk alasan penolakan & konfirmasi hapus ----
function Modal({ title, onClose, onConfirm, children, confirmLabel = "Simpan", confirmColor = "#16a75c" }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
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
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          padding: 24
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 17, color: "#1e293b" }}>{title}</h3>
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={smallBtn("#64748b")}>Batal</button>
          <button onClick={onConfirm} style={smallBtn(confirmColor)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function CmsPage() {

  const navigate = useNavigate();
  const user = getUser();

  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");

  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "maintainer" });
  const [userMsg, setUserMsg] = useState("");

  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState(isAdmin ? "approval" : "upload");

  async function refreshFiles() {
    try {
      const data = await api("/api/cms/files");
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshApproval() {
    try {
      const data = await api("/api/cms/files");
      const all = data.files || [];
      setFiles(all);
      setPending(all.filter((f) => f.status === "pending"));
      setHistory(all.filter((f) => f.status !== "pending"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshUsers() {
    try {
      const data = await api("/api/cms/users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshLogs() {
    try {
      const data = await api("/api/cms/login-logs");
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (tab === "upload" || tab === "mydocs") refreshFiles();
    if (tab === "approval") refreshApproval();
    if (tab === "users") refreshUsers();
    if (tab === "logs") refreshLogs();
  }, [tab]);

  // ---- Upload ----

  async function doUpload(e) {
    e.preventDefault();
    if (!file) {
      setUploadMsg("Pilih file PDF terlebih dahulu.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadMsg("Ukuran file melebihi batas 20 MB.");
      return;
    }

    setUploading(true);
    setUploadMsg("");
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api("/api/cms/upload", { method: "POST", body: form });
      setUploadMsg(data.message || "Upload berhasil.");
      setFile(null);
      refreshFiles();
    } catch (err) {
      setError(err.message);
    }

    setUploading(false);
  }

  // ---- Persetujuan admin ----

  async function approve(id) {
    setProcessingId(id);
    try {
      await api(`/api/cms/files/${id}/approve`, { method: "POST", body: {} });
      refreshApproval();
    } catch (err) {
      setError(err.message);
      refreshApproval();
    }
    setProcessingId(null);
  }

  // Buka modal penolakan (bukan window.prompt)
  function openReject(file) {
    setRejectTarget(file);
    setRejectReason("");
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
      refreshApproval();
    } catch (err) {
      setError(err.message);
      refreshApproval();
    }
    setProcessingId(null);
  }

  async function changeRole(id, role) {
    setError("");
    try {
      await api(`/api/cms/users/${id}`, { method: "PUT", body: { role } });
      refreshUsers();
    } catch (err) {
      setError(err.message);
      refreshUsers();
    }
  }

  async function confirmRemoveUser() {
    const id = deleteTarget;
    const username = users.find((u) => u.id === id)?.username || "";
    setDeleteTarget(null);
    setError("");
    try {
      await api(`/api/cms/users/${id}`, { method: "DELETE" });
      refreshUsers();
    } catch (err) {
      setError(err.message);
      refreshUsers();
    }
  }

  async function confirmDeleteDoc() {
    if (!deleteDocTarget) return;
    const id = deleteDocTarget.id;
    setDeleteDocTarget(null);
    setError("");
    try {
      await api(`/api/cms/files/${id}`, { method: "DELETE" });
      refreshApproval();
    } catch (err) {
      setError(err.message);
      refreshApproval();
    }
  }

  function logout() {
    clearSession();
    navigate("/cms/login");
  }

  // ---- Render ----

  const filteredHistory = historyFilter === "all"
    ? history
    : history.filter((f) => f.status === historyFilter);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#f6f7f9,#ffffff)",
        fontFamily: '"Inter", sans-serif'
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #001845, #00439c)",
          color: "white",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>⚙ CMS Knowledge Management</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, background: "rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 8 }}>
            {user?.username} · {user?.role === "admin" ? "Admin" : "Maintainer"}
          </span>
          <button onClick={() => navigate("/")} style={headerBtn}>💬 Chat</button>
          <button onClick={logout} style={headerBtn}>Keluar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "auto", padding: "24px 20px" }} className="fade-in">
        {/* TABS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {!isAdmin && (
            <>
              <TabBtn active={tab === "upload"} onClick={() => setTab("upload")}>📤 Upload Dokumen</TabBtn>
              <TabBtn active={tab === "mydocs"} onClick={() => setTab("mydocs")}>📁 Dokumen Saya</TabBtn>
            </>
          )}
          {isAdmin && (
            <>
              <TabBtn active={tab === "approval"} onClick={() => setTab("approval")}>✅ Persetujuan</TabBtn>
              <TabBtn active={tab === "users"} onClick={() => setTab("users")}>👥 Kelola User</TabBtn>
              <TabBtn active={tab === "logs"} onClick={() => setTab("logs")}>📜 Log Aktivitas</TabBtn>
            </>
          )}
        </div>

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        {uploadMsg && tab === "upload" && (
          <div style={{ ...okStyle, background: "#dcfce7", padding: "12px 16px", borderRadius: 10, marginBottom: 16 }}>
            {uploadMsg}
          </div>
        )}

        {/* ===== UPLOAD (maintainer) ===== */}
        {tab === "upload" && (
          <div style={cardStyle}>
            <h3 style={h3Style}>Unggah Dokumen Baru</h3>
            <p style={{ fontSize: 14, color: "#64748b", marginTop: 0 }}>
              Dokumen yang diunggah akan menunggu persetujuan admin sebelum dipakai chatbot.
            </p>
            <form onSubmit={doUpload} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={uploading}
                style={{ ...primaryBtn, height: 44 }}
              >
                {uploading ? "Mengunggah..." : "Upload"}
              </button>
            </form>
            {file && (
              <p style={{ fontSize: 13, color: "#334155", marginTop: 12 }}>
                📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        )}

        {/* ===== DOKUMEN SAYA (maintainer) ===== */}
        {tab === "mydocs" && <FileTable rows={files} empty="Belum ada dokumen diunggah." />}

        {/* ===== PERSETUJUAN (admin) ===== */}
        {tab === "approval" && (
          <>
            <div style={cardStyle}>
              <h3 style={h3Style}>Menunggu Persetujuan ({pending.length})</h3>
              {pending.length === 0 ? (
                <EmptyState icon="📭" text="Tidak ada dokumen menunggu persetujuan." />
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <Th>File</Th><Th>Pengunggah</Th><Th>Waktu</Th><Th>Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((f) => (
                      <tr key={f.id}>
                        <Td>📄 {f.originalName}</Td>
                        <Td>{f.uploadedBy}</Td>
                        <Td>{fmtDate(f.uploadedAt)}</Td>
                        <Td>
                          <button onClick={() => approve(f.id)} style={{ ...smallBtn("#16a75c"), ...(processingId !== null ? { opacity: 0.6, cursor: "not-allowed" } : {}) }} title="Terima & proses dokumen" disabled={processingId !== null}>{processingId === f.id ? "Memproses…" : "✔ Terima"}</button>
                          <button onClick={() => openReject(f)} style={{ ...smallBtn("#ff1c3e"), ...(processingId !== null ? { opacity: 0.6, cursor: "not-allowed" } : {}) }} title="Tolak dokumen" disabled={processingId !== null}>✖ Tolak</button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                <h3 style={{ ...h3Style, margin: 0 }}>Riwayat Pemrosesan</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["all", "Semua"], ["approved", "Disetujui"], ["rejected", "Ditolak"], ["error", "Error"], ["deleted", "Dihapus"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setHistoryFilter(val)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 20,
                        border: historyFilter === val ? "none" : "1px solid #cbd5e1",
                        background: historyFilter === val ? "#00439c" : "#fff",
                        color: historyFilter === val ? "#fff" : "#334155",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <FileTable rows={filteredHistory} empty="Tidak ada riwayat." onDelete={setDeleteDocTarget} />
            </div>
          </>
        )}

        {/* ===== KELOLA USER (admin) ===== */}
        {tab === "users" && (
          <>
            <div style={cardStyle}>
              <h3 style={h3Style}>Tambah User</h3>
              <form onSubmit={(e) => { e.preventDefault(); createUser(); }} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  style={{ ...inputStyle, minWidth: 160 }}
                />
                <input
                  type="password"
                  placeholder="Password (min. 6)"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  style={{ ...inputStyle, minWidth: 160 }}
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  style={{ ...inputStyle, minWidth: 140 }}
                >
                  <option value="maintainer">Maintainer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" style={{ ...primaryBtn, height: 44 }}>Tambah</button>
              </form>
              {userMsg && <p style={okStyle}>{userMsg}</p>}
            </div>

            <div style={cardStyle}>
              <h3 style={h3Style}>Daftar User</h3>
              {users.length === 0 ? (
                <EmptyState icon="👥" text="Belum ada user." />
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <Th>Username</Th><Th>Role</Th><Th>Aksi</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <Td>{u.username}</Td>
                        <Td>
                          <select
                            value={u.role}
                            disabled={u.id === user.id}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            style={inputStyle}
                          >
                            <option value="maintainer">Maintainer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </Td>
                        <Td>
                          {u.id !== user.id && (
                            <button
                              onClick={() => setDeleteTarget(u.id)}
                              style={smallBtn("#ff1c3e")}
                              title={`Hapus user ${u.username}`}
                            >
                              Hapus
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ===== LOG AKTIVITAS (admin) ===== */}
        {tab === "logs" && (
          <div style={cardStyle}>
            <h3 style={h3Style}>Log Login</h3>
            {logs.length === 0 ? (
              <EmptyState icon="📜" text="Belum ada aktivitas login." />
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>User</Th><Th>Waktu</Th><Th>Perangkat</Th><Th>Browser</Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.username}</Td>
                      <Td>{fmtDate(l.timestamp)}</Td>
                      <Td>{l.device || "-"}</Td>
                      <Td>{[l.browser, l.os].filter(Boolean).join(" · ") || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL: Alasan Penolakan ===== */}
      {rejectTarget && (
        <Modal
          title={`Tolak dokumen "${rejectTarget.originalName}"?`}
          onClose={() => setRejectTarget(null)}
          onConfirm={confirmReject}
          confirmLabel="Tolak Dokumen"
          confirmColor="#ff1c3e"
        >
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
            Alasan penolakan akan dicatat dan ditampilkan kepada pengunggah.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tulis alasan penolakan (opsional)..."
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              resize: "vertical",
              outline: "none",
              fontFamily: 'inherit'
            }}
          />
        </Modal>
      )}

      {/* ===== MODAL: Konfirmasi Hapus User ===== */}
      {deleteTarget && (
        <Modal
          title={`Hapus user "${users.find((u) => u.id === deleteTarget)?.username || ""}"?`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmRemoveUser}
          confirmLabel="Ya, Hapus"
          confirmColor="#ff1c3e"
        >
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Tindakan ini tidak dapat dibatalkan. User tidak akan bisa login lagi.
          </p>
        </Modal>
      )}

      {/* ===== MODAL: Konfirmasi Hapus Dokumen ===== */}
      {deleteDocTarget && (
        <Modal
          title={`Hapus dokumen "${deleteDocTarget.originalName}"?`}
          onClose={() => setDeleteDocTarget(null)}
          onConfirm={confirmDeleteDoc}
          confirmLabel="Ya, Hapus"
          confirmColor="#ff1c3e"
        >
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Dokumen akan dihapus dari sistem: file PDF, data vektor untuk pencarian AI, dan riwayat akses chatbot.
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </Modal>
      )}
    </div>
  );

  // ---- Fungsi tambah user (dibutuhkan submit handler) ----
  async function createUser() {
    setUserMsg("");
    setError("");
    try {
      const data = await api("/api/cms/users", {
        method: "POST",
        body: {
          username: newUser.username.trim(),
          password: newUser.password,
          role: newUser.role
        }
      });
      setUserMsg(data.message || "User dibuat.");
      setNewUser({ username: "", password: "", role: "maintainer" });
      refreshUsers();
    } catch (err) {
      setError(err.message);
    }
  }
}

// ---- Komponen kecil styling (agar JSX di atas ringkas) ----

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        border: active ? "none" : "1px solid #cbd5e1",
        background: active ? "#00439c" : "#fff",
        color: active ? "#fff" : "#334155",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 10px", color: "#94a3b8" }} className="fade-in">
      <div style={{ fontSize: 34, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

function FileTable({ rows, empty, title, onDelete }) {
  const statusLabel = (status) =>
    status === "pending" ? "Menunggu"
    : status === "approved" ? "Disetujui"
    : status === "error" ? "Gagal"
    : status === "deleted" ? "Dihapus"
    : "Ditolak";

  return (
    <div style={cardStyle}>
      {title && <h3 style={h3Style}>{title}</h3>}
      {rows.length === 0 ? (
        <EmptyState icon="📄" text={empty} />
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>File</Th><Th>Status</Th><Th>Waktu</Th><Th>Catatan</Th>
              {onDelete && <Th>Aksi</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <Td>📄 {f.originalName}</Td>
                <Td>
                  <span style={statusBadge[f.status] || statusBadge.pending}>
                    {statusLabel(f.status)}
                    {f.status === "deleted" && f.deletedBy ? ` oleh ${f.deletedBy}` : ""}
                  </span>
                </Td>
                <Td>{fmtDate(f.uploadedAt)}</Td>
                <Td>{f.rejectReason || (f.error ? f.error.slice(0, 60) + "…" : "-")}</Td>
                {onDelete && (
                  <Td>
                    {["approved", "error"].includes(f.status) && (
                      <button
                        onClick={() => onDelete(f)}
                        style={smallBtn("#ff1c3e")}
                        title={`Hapus dokumen ${f.originalName}`}
                      >
                        Hapus
                      </button>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const h3Style = { margin: "0 0 14px", color: "#1e293b" };
const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  padding: 20,
  marginBottom: 18
};
const inputStyle = {
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: 'inherit'
};
const primaryBtn = {
  background: "#00439c",
  color: "#fff",
  border: "none",
  padding: "0 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontFamily: 'inherit'
};
const headerBtn = {
  background: "rgba(255,255,255,0.15)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.5)",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  fontFamily: 'inherit'
};
const errorStyle = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 14,
  marginBottom: 16
};
const okStyle = { fontSize: 14, color: "#16a75c", fontWeight: 600, marginBottom: 10 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
function Th({ children }) {
  return <th style={thStyle}>{children}</th>;
}
const thStyle = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "2px solid #e2e8f0",
  color: "#475569",
  fontSize: 13
};
function Td({ children }) {
  return <td style={{ padding: "10px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" }}>{children}</td>;
}
function smallBtn(color) {
  return {
    background: color,
    color: "#fff",
    border: "none",
    padding: "7px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    marginRight: 6,
    fontFamily: 'inherit'
  };
}
const statusBadge = {
  approved: { background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  rejected: { background: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  pending: { background: "#fef9c3", color: "#a16207", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  error: { background: "#f1f5f9", color: "#475569", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  deleted: { background: "#e2e8f0", color: "#475569", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }
};