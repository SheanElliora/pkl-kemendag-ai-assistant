import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../api.js";
import { createTheme, FONT_HEADING, FONT_BODY } from "../theme.js";

export default function LoginPage() {

  const navigate = useNavigate();

  const [username, setUsername] = useState(() => localStorage.getItem("cms_last_username") || "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusField, setFocusField] = useState(null);
  const [capsLock, setCapsLock] = useState(false);

  const [dark, setDark] = useState(() => localStorage.getItem("cms_theme") === "dark");

  useEffect(() => {
    // Ikuti perubahan tema dari tab lain (mis. toggle di halaman chat)
    function onStorage(e) {
      if (e.key === "cms_theme") setDark(e.newValue === "dark");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    // Flag diset oleh api.js saat API menolak token (401)
    if (localStorage.getItem("cms_session_expired")) {
      setSessionExpired(true);
      localStorage.removeItem("cms_session_expired");
    }
  }, []);

  const t = createTheme(dark);

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

      localStorage.setItem("cms_last_username", username.trim());

      navigate("/cms");

    }
    catch (err) {

      setError(err.message || "Login gagal.");

    }

    setLoading(false);

  }

  function fieldStyle(name, extra = {}) {
    const focused = focusField === name;
    return {
      width: "100%",
      boxSizing: "border-box",
      height: 42,
      padding: "0 18px",
      borderRadius: "999px",
      border: "1px solid " + (focused ? t.accent : t.cardBorder),
      background: t.inputBg,
      color: t.text,
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      boxShadow: focused ? "0 0 0 3px rgba(233,163,25,0.15)" : "none",
      ...extra
    };
  }

  return (
    <div
      style={{
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: t.pageBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
fontFamily: FONT_BODY
      }}
    >
      <div
        className="pop-in"
        style={{
          width: 420,
          maxWidth: "92%",
          position: "relative",
          background: dark ? "#2a3d63" : "#f6f8fd",
          border: "1px solid " + t.cardBorder,
          borderRadius: 20,
          boxShadow: (dark
            ? "0 8px 24px rgba(0,0,0,0.35)"
            : "0 8px 24px rgba(15,40,80,0.12)") + ", inset 0 3px 0 rgba(233,163,25,0.55)",
          padding: 40,
          textAlign: "center"
        }}
      >
        <div className="rise" style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
          <img
            src="/logo-kemendag.png"
            alt="Logo Kemendag"
            className="logo-hover"
            style={{
              width: 104,
              height: 104,
              objectFit: "cover",
              cursor: "pointer",
              filter: "drop-shadow(0 6px 14px rgba(0,77,175,0.18))"
            }}
          />
        </div>
        <h2 className="rise" style={{ margin: "18px 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", fontFamily: FONT_HEADING, color: t.accentText, animationDelay: "0.06s" }}>
          Panel Admin
        </h2>
        <p className="rise" style={{ margin: "14px 0 24px", fontSize: 14, color: t.textMute, animationDelay: "0.1s" }}>
          Kelola dokumen & pengguna — AI Document Intelligence Kemendag
        </p>

        {sessionExpired && (
          <div
            style={{
              background: dark ? "#3a2d12" : "#fef9c3",
              color: dark ? "#fde68a" : "#854d0e",
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 14,
              marginBottom: 16,
              textAlign: "left"
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "middle" }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Sesi berakhir. Silakan masuk kembali.
          </div>
        )}

        {error && (
          <div
            className="shake"
            style={{
              background: dark ? "#3a1220" : "#fee2e2",
              color: dark ? "#fecaca" : "#b91c1c",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 14,
              marginBottom: 16
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={submit} className="rise" style={{ animationDelay: "0.14s" }}>
          <div style={{ position: "relative", display: "flex", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", color: t.textMute, pointerEvents: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </span>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onFocus={() => setFocusField("username")}
              onBlur={() => setFocusField(null)}
              placeholder="Nama Pengguna"
              autoComplete="username"
              autoFocus
              disabled={loading}
              required
              style={fieldStyle("username", { paddingLeft: 46 })}
            />
          </div>

          <div style={{ position: "relative", display: "flex", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", color: t.textMute, pointerEvents: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onFocus={() => setFocusField("password")}
              onBlur={() => setFocusField(null)}
              onKeyUp={(e) => setCapsLock(e.getModifierState ? e.getModifierState("CapsLock") : false)}
              placeholder="Kata Sandi"
              autoComplete="current-password"
              disabled={loading}
              required
              style={fieldStyle("password", { paddingLeft: 46, paddingRight: 48 })}
            />
            {capsLock && (
              <span
                title="Caps Lock aktif"
                style={{
                  position: "absolute",
                  right: 40,
                  top: 0,
                  bottom: 0,
                  color: t.textMute,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2l6 9H2z" />
                  <rect x="3" y="13" width="10" height="2" rx="1" />
                </svg>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              title={showPass ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              style={{
                position: "absolute",
                right: 14,
                top: 0,
                bottom: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                color: t.textMute,
                display: "flex",
                alignItems: "center"
              }}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.background = "#003d94"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,77,175,0.45)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "#004DAF"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,77,175,0.35)"; }}
            style={{
              width: "100%",
              background: "#004DAF",
              color: "#fff",
              border: "none",
              padding: "13px",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 15,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              opacity: loading ? 0.85 : 1,
              transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
              boxShadow: "0 6px 16px rgba(0,77,175,0.35)"
            }}
          >
            {loading ? (
              <>
                <span
                  className="spin"
                  style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", flexShrink: 0 }}
                />
                Memproses...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          className="rise"
          style={{
            marginTop: 20,
            background: "none",
            border: "1px solid " + t.accent,
            color: t.accent,
            padding: "10px 22px",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
            fontWeight: 600,
            animationDelay: "0.2s",
            transition: "background 0.15s ease, color 0.15s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = t.accent; }}
        >
          Kembali ke Chat
        </button>

      </div>

      <div
        className="rise"
        style={{
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          color: t.textMute,
          opacity: 0.85,
          animationDelay: "0.3s"
        }}
      >
        AI Document Intelligence · Kementerian Perdagangan RI
      </div>
    </div>
  );
}