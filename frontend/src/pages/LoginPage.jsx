import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../api.js";

export default function LoginPage() {

  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Flag diset oleh api.js saat API menolak token (401)
    if (localStorage.getItem("cms_session_expired")) {
      setSessionExpired(true);
      localStorage.removeItem("cms_session_expired");
    }
  }, []);

  async function submit(e) {

    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {

      const data =
        await api("/api/auth/login", {
          method: "POST",
          body: {
            username: username.trim(),
            password
          }
        });

      saveSession(data.token, data.user);

      navigate("/cms");

    }
    catch (err) {

      setError(err.message || "Login gagal.");

    }

    setLoading(false);

  }

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(180deg,#f6f7f9,#ffffff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Inter", sans-serif'
      }}
    >
      <div
        className="pop-in"
        style={{
          width: 420,
          maxWidth: "92%",
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 40,
          textAlign: "center"
        }}
      >
        <img
          src="/logo kemendag.png"
          alt="Logo Kemendag"
          style={{
            width: 80,
            height: 80,
            objectFit: "cover",
            borderRadius: 12,
            background: "#fff"
          }}
        />
        <h2 style={{ margin: "18px 0 4px", fontSize: 22, color: "#00439c" }}>
          Masuk CMS
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
          Kelola dokumen & user sebagai admin atau maintainer.
        </p>

        {sessionExpired && (
          <div
            style={{
              background: "#fef9c3",
              color: "#854d0e",
              padding: "12px 14px",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 16,
              textAlign: "left"
            }}
          >
            ⏰ Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 16
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            style={inputStyle}
          />

          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              style={{ ...inputStyle, paddingRight: 48 }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              title={showPass ? "Sembunyikan password" : "Tampilkan password"}
              style={{
                position: "absolute",
                right: 12,
                top: 13,
                background: "none",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1
              }}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: 20,
            background: "none",
            border: "1px solid #cbd5e1",
            color: "#334155",
            padding: "10px 20px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 14
          }}
        >
          Kembali ke Chat
        </button>

      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  marginBottom: 12,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  outline: "none"
};

const buttonStyle = {
  width: "100%",
  background: "#00439c",
  color: "#fff",
  border: "none",
  padding: "13px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15
};