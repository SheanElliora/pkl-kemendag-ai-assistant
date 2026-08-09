import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { api, getUser, clearSession } from '../api.js';

const styles = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-5px); opacity: 1; }
}
`;

export default function ChatPage() {

  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() =>
    localStorage.getItem("cms_model") || "google/gemini-2.5-flash"
  );

  const user = getUser();

  const suggestions = [
    "Bagaimana persepsi pasar Nigeria terhadap produk tekstil Indonesia?",
    "Bagaimana pasar game yang ada di Jepang sekarang?",
    "Bagaimana perkembangan industri restoran di Jepang?"
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

  useEffect(() => {
    localStorage.setItem("cms_model", model);
  }, [model]);

  function sourceTitle(sources, filename) {
    const source = sources.find((s) => s.filename === filename);
    const title = source?.title ?? "";
    if (title.trim()) return title;
    return filename;
  }

  async function sendMessage() {

    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text }
    ]);

    setInput('');
    setLoading(true);

    try {

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: model
        })
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text:
            data.answer ??
            data.reply ??
            data.error ??
            "Tidak ada jawaban.",
          sources: data.sources ?? []
        }
      ]);

    }
    catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Terjadi kesalahan koneksi ke server.",
          sources: []
        }
      ]);
    }

    setLoading(false);

  }

  function logout() {
    clearSession();
    navigate(0); // muat ulang
  }

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(180deg,#eef5fb,#ffffff)",
        padding: "35px",
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
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          overflow: "hidden"
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: "linear-gradient(135deg, #004a8f, #0072bc)",
            color: "white",
            padding: "18px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img
              src="/logo kemendag.png"
              alt="Logo Kemendag"
              style={{
                width: "70px",
                height: "70px",
                objectFit: "cover",
                background: "white",
                borderRadius: "10px",
                flexShrink: 0
              }}
            />
            <div style={{ textAlign: "left" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
                AI Document Intelligence
              </h2>
              <p style={{ margin: "5px 0 0", fontSize: "14px", opacity: 0.9 }}>
                Document Intelligence System - Kemendag
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setMessages([])}
              style={navButtonStyle}
            >
              🗑 Clear Chat
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

        {/* CHAT AREA */}
        <div
          style={{
            height: "calc(100vh - 360px)",
            overflowY: "auto",
            padding: "20px",
            background: "#eef2f756"
          }}
        >
          {messages.length === 0 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: "50px" }}>
                <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#004a8f" }}>
                  AI Assistant
                </h2>
                <p style={{ marginTop: "12px", fontSize: "15px", color: "#475569", lineHeight: "1.8" }}>
                  Sistem siap membantu menjawab pertanyaan berdasarkan dokumen yang telah disetujui.
                  <br />
                  Silakan pilih contoh pertanyaan atau ketik pertanyaan Anda.
                </p>
              </div>

              <h4 style={{ marginBottom: "15px", color: "#1e293b", fontWeight: 600 }}>
                Contoh Pertanyaan
              </h4>

              {suggestions.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setInput(item)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #dbeafe",
                    background: "#ffffff",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#334155",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                padding: "10px 18px"
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  background: m.role === "user" ? "#dbeafe" : "#f8fafc",
                  padding: "14px 20px",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
                }}
              >
                <b style={{ fontSize: "14px", color: m.role === "user" ? "#004a8f" : "#111827" }}>
                  {m.role === "user" ? "Anda" : "AI Document Intelligence"}
                </b>
                <div style={{ marginTop: "10px", lineHeight: "1.6" }}>
                  {m.role === "user" ? m.text : <ReactMarkdown>{m.text}</ReactMarkdown>}
                </div>

                {m.role === "bot" && m.sources && m.sources.length > 0 && (
                  <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #ddd", fontSize: "13px" }}>
                    <b>📚 Sumber Referensi</b>
                    {Object.entries(
                      m.sources.reduce((acc, source) => {
                        if (!acc[source.filename]) acc[source.filename] = [];
                        acc[source.filename].push(source.page);
                        return acc;
                      }, {})
                    ).map(([filename, pages]) => (
                      <div key={filename} style={{ marginTop: "8px" }}>
                        📄 {sourceTitle(m.sources, filename)}
                        <br />
                        Halaman relevan: {[...new Set(pages)].slice(0, 5).join(", ")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ padding: "10px", color: "#64748b", fontStyle: "italic" }}>
              AI sedang mencari informasi dokumen
              <span style={{ animation: "bounce 1s infinite" }}> ●</span>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "15px",
            borderTop: "1px solid #ddd",
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            title="Pilih model AI"
            style={{
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              background: "#fff",
              outline: "none",
              maxWidth: "230px"
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Tanyakan informasi perdagangan..."
            style={{
              flex: 1,
              minWidth: "180px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              outline: "none"
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              background: "#004a8f",
              color: "white",
              border: "none",
              padding: "0 25px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: 600,
              height: "48px"
            }}
          >
            Kirim
          </button>
        </div>
      </div>
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
  whiteSpace: "nowrap"
};