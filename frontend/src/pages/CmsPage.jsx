import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser, clearSession, fmtDate } from "../api.js";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB, sama dengan backend

export default function CmsPage() {

  const navigate = useNavigate();
  const user = getUser();

  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);

  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);

  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "maintainer" });
  const [userMsg, setUserMsg] = useState("");

  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

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

  async function decide(id, action) {
    let reason;
    if (action === "reject") {
      reason = window.prompt("Alasan penolakan:", "");
      if (reason == null) return; // dibatalkan
    }
    try {
      await api(`/api/cms/files/${id}/${action}`, {
        method: "POST",
        body: action === "reject" ? { reason } : {}
      });
      refreshApproval();
    } catch (err) {
      setError(err.message);
    }
  }

  // ---- Kelola user ----

  async function createUser(e) {
    e.preventDefault();
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

  async function changeRole(id, role) {
    setError("");
    try {
      await api(`/api/cms/users/${id}`, {
        method: "PUT",
        body: { role }
      });
      refreshUsers();
    } catch (err) {
      setError(err.message);
      refreshUsers();
    }
  }

  async function removeUser(id, username) {
    if (!window.confirm(`Hapus user "${username}"?`)) return;
    setError("");
    try {
      await api(`/api/cms/users/${id}`, { method: "DELETE" });
      refreshUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    clearSession();
    navigate("/cms/login");
  }

  // ==== Render ====

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#eef5fb,#ffffff)",
        fontFamily: '"Inter", sans-serif'
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #004a8f, #0072bc)",
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

      <div style={{ maxWidth: 1000, margin: "auto", padding: "24px 20px" }}>
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
            {uploadMsg && <p style={okStyle}>{uploadMsg}</p>}
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
                <p style={{ color: "#64748b", fontSize: 14 }}>Tidak ada dokumen menunggu.</p>
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
                          <button onClick={() => decide(f.id, "approve")} style={smallBtn("#16a34a")}>✔ Terima</button>
                          <button onClick={() => decide(f.id, "reject")} style={smallBtn("#dc2626")}>✖ Tolak</button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <FileTable
              rows={history}
              empty="Belum ada dokumen diproses."
              title="Riwayat Pemrosesan"
            />
          </>
        )}

        {/* ===== KELOLA USER (admin) ===== */}
        {tab === "users" && (
          <>
            <div style={cardStyle}>
              <h3 style={h3Style}>Tambah User</h3>
              <form onSubmit={createUser} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                          <button onClick={() => removeUser(u.id, u.username)} style={smallBtn("#dc2626")}>Hapus</button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== LOG AKTIVITAS (admin) ===== */}
        {tab === "logs" && (
          <div style={cardStyle}>
            <h3 style={h3Style}>Log Login</h3>
            {logs.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 14 }}>Belum ada aktivitas login.</p>
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
    </div>
  );
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
        background: active ? "#004a8f" : "#fff",
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

function FileTable({ rows, empty, title }) {
  return (
    <div style={cardStyle}>
      {title && <h3 style={h3Style}>{title}</h3>}
      {rows.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 14 }}>{empty}</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>File</Th><Th>Status</Th><Th>Waktu</Th><Th>Catatan</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <Td>📄 {f.originalName}</Td>
                <Td>
                  <span style={statusBadge[f.status] || statusBadge.pending}>
                    {f.status === "pending" ? "Menunggu" : f.status === "approved" ? "Disetujui" : "Ditolak"}
                  </span>
                </Td>
                <Td>{fmtDate(f.uploadedAt)}</Td>
                <Td>{f.rejectReason || "-"}</Td>
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
  boxSizing: "border-box"
};
const primaryBtn = {
  background: "#004a8f",
  color: "#fff",
  border: "none",
  padding: "0 20px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600
};
const headerBtn = {
  background: "rgba(255,255,255,0.15)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.5)",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
};
const errorStyle = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "12px 16px",
  borderRadius: 10,
  fontSize: 14,
  marginBottom: 16
};
const okStyle = { fontSize: 14, color: "#16a34a", fontWeight: 600, marginBottom: 0 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
function Th({ children }) {
  return <th style={thStyle}>{children}</th>;
}
const thStyle = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "2px solid #e2e8f0",
  color: "#475569"
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
    marginRight: 6
  };
}
const statusBadge = {
  approved: { background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  rejected: { background: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  pending: { background: "#fef9c3", color: "#a16207", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }
};