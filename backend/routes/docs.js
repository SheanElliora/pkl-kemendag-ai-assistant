// ============================================================
// Dokumentasi API (OpenAPI 3.0 + Swagger UI)
//
// GET /api/docs.json -> spesifikasi OpenAPI (JSON)
// GET /api/docs      -> halaman Swagger UI (CDN) yang
//                       memuat spesifikasi tersebut
// ============================================================

import { Router } from "express";

const router = Router();

const spec = {
    openapi: "3.0.3",
    info: {
        title: "API AI Assistant Sistem Informasi Perdagangan (Kemendag)",
        description:
            "Asisten AI berbasis RAG: chat publik (dengan riwayat & feedback), CMS dokumen (upload/approve/reject/delete), manajemen user, statistik, dan dokumentasi ini.",
        version: "1.0.0"
    },
    servers: [
        { url: "http://localhost:3001", description: "Lokal (dev)" }
    ],
    tags: [
        { name: "Kesehatan" },
        { name: "Chat" },
        { name: "Autentikasi" },
        { name: "CMS Dokumen" },
        { name: "CMS User & Log" }
    ],
    paths: {

        "/api/health": {
            get: {
                tags: ["Kesehatan"],
                summary: "Cek status server",
                responses: {
                    "200": { description: "OK" }
                }
            }
        },

        "/api/stats": {
            get: {
                tags: ["Kesehatan"],
                summary: "Statistik publik (jumlah dokumen & vektor)",
                responses: {
                    "200": {
                        description: "Statistik",
                        content: {
                            "application/json": {
                                example: { documents: { total: 11, approved: 8 }, vectors: 631 }
                            }
                        }
                    }
                }
            }
        },

        "/api/models": {
            get: {
                tags: ["Kesehatan"],
                summary: "Daftar model LLM untuk dropdown chat",
                responses: { "200": { description: "Default + katalog model" } }
            }
        },

        "/api/documents": {
            get: {
                tags: ["Kesehatan"],
                summary: "Daftar PDF aktif di folder docs",
                responses: { "200": { description: "Daftar nama file" } }
            }
        },

        "/api/chat": {
            post: {
                tags: ["Chat"],
                summary: "Kirim pertanyaan RAG (publik, rate-limit 20/menit)",
                description:
                    "Body opsional: sessionId (untuk multi-turn & riwayat), clientId (identitas anonim), model, stream (SSE).",
                requestBody: {
                    content: {
                        "application/json": {
                            example: {
                                message: "Apa isi PERMENDAG Nomor 28 Tahun 2024?",
                                sessionId: "sesi-...",
                                stream: false
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "reply + sources (+ sessionId/messageId)" },
                    "400": { description: "Message kosong" },
                    "429": { description: "Rate limit tercapai" }
                }
            }
        },

        "/api/chat/history": {
            get: {
                tags: ["Chat"],
                summary: "Daftar sesi percakapan (clientId via query atau token Bearer)",
                responses: { "200": { description: "Daftar sesi" } }
            }
        },

        "/api/chat/history/{sessionId}": {
            get: {
                tags: ["Chat"],
                summary: "Isi lengkap satu percakapan",
                parameters: [
                    { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                ],
                responses: {
                    "200": { description: "Percakapan + pesan" },
                    "404": { description: "Tidak ditemukan" }
                }
            },
            delete: {
                tags: ["Chat"],
                summary: "Hapus satu percakapan",
                parameters: [
                    { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                ],
                responses: {
                    "200": { description: "Terhapus" },
                    "404": { description: "Tidak ditemukan" }
                }
            }
        },

        "/api/chat/history/{sessionId}/export": {
            get: {
                tags: ["Chat"],
                summary: "Ekspor percakapan (format=html untuk print-to-PDF, format=doc untuk Word)",
                parameters: [
                    { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                    { name: "format", in: "query", schema: { type: "string", enum: ["html", "doc"], default: "html" } }
                ],
                responses: { "200": { description: "File HTML/DOC (attachment)" } }
            }
        },

        "/api/chat/feedback": {
            post: {
                tags: ["Chat"],
                summary: "Penilaian jawaban (up/down) + komentar opsional",
                requestBody: {
                    content: {
                        "application/json": {
                            example: { sessionId: "sesi-...", messageId: "msg-...", rating: "up", comment: "Jawaban bagus" }
                        }
                    }
                },
                responses: {
                    "200": { description: "Feedback tersimpan" },
                    "404": { description: "Sesi/pesan tidak ditemukan" }
                }
            }
        },

        "/api/auth/login": {
            post: {
                tags: ["Autentikasi"],
                summary: "Login (rate-limit 10x/15 menit/IP)",
                requestBody: {
                    content: {
                        "application/json": { example: { username: "admin", password: "***" } }
                    }
                },
                responses: {
                    "200": { description: "token + user" },
                    "401": { description: "Kredensial salah" }
                }
            }
        },

        "/api/auth/me": {
            get: {
                tags: ["Autentikasi"],
                summary: "Profil user saat ini (Bearer token)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Profil" } }
            }
        },

        "/api/cms/upload": {
            post: {
                tags: ["CMS Dokumen"],
                summary: "Upload PDF (maintainer/admin) -> status pending",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    file: { type: "string", format: "binary" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "fileId + status pending" },
                    "400": { description: "Bukan PDF / melebihi 20 MB" }
                }
            }
        },

        "/api/cms/files": {
            get: {
                tags: ["CMS Dokumen"],
                summary: "Daftar file (maintainer: milik sendiri; admin: semua)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Daftar file" } }
            }
        },

        "/api/cms/files/{id}/approve": {
            post: {
                tags: ["CMS Dokumen"],
                summary: "Setujui dokumen (admin) -> processing -> approved (ingest latar belakang)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "integer" } }
                ],
                responses: {
                    "200": { description: "status processing (antrean)" },
                    "400": { description: "Bukan pending / file hilang" }
                }
            }
        },

        "/api/cms/files/{id}/reject": {
            post: {
                tags: ["CMS Dokumen"],
                summary: "Tolak dokumen (admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "integer" } }
                ],
                responses: {
                    "200": { description: "status rejected" },
                    "400": { description: "Alasan wajib" }
                }
            }
        },

        "/api/cms/files/{id}": {
            delete: {
                tags: ["CMS Dokumen"],
                summary: "Hapus dokumen approved (admin)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "integer" } }
                ],
                responses: {
                    "200": { description: "status deleted + vektor dibersihkan" },
                    "400": { description: "Bukan approved / tidak ditemukan" }
                }
            }
        },

        "/api/cms/users": {
            get: {
                tags: ["CMS User & Log"],
                summary: "Daftar user (admin)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Daftar user" } }
            },
            post: {
                tags: ["CMS User & Log"],
                summary: "Buat user (admin)",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        "application/json": {
                            example: { username: "analis", password: "rahasia123", role: "maintainer" }
                        }
                    }
                },
                responses: {
                    "200": { description: "User dibuat" },
                    "400": { description: "Validasi gagal" }
                }
            }
        },

        "/api/cms/users/{id}": {
            put: {
                tags: ["CMS User & Log"],
                summary: "Ubah role/password user (admin)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "User diperbarui" } }
            },
            delete: {
                tags: ["CMS User & Log"],
                summary: "Hapus user (admin, tidak bisa hapus diri sendiri)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "User dihapus" } }
            }
        },

        "/api/cms/login-logs": {
            get: {
                tags: ["CMS User & Log"],
                summary: "Log aktivitas login (admin)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Daftar log" } }
            }
        },

        "/api/cms/stats": {
            get: {
                tags: ["CMS User & Log"],
                summary: "Statistik lengkap (admin): dokumen, vektor, user, chat & feedback",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Statistik lengkap" } }
            }
        },

        "/api/docs.json": {
            get: {
                tags: ["Kesehatan"],
                summary: "Spesifikasi OpenAPI ini",
                responses: { "200": { description: "OpenAPI JSON" } }
            }
        }
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT"
            }
        }
    }
};

router.get("/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(spec, null, 2));
});

router.get("/docs", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>Dokumentasi API — AI Assistant SIP</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"/>
<style>
    html { margin: 0; padding: 0; }
    body { margin: 0; padding: 0; }
    #api-title { padding: 14px 20px; background: #0f172a; color: #f8fafc; font-family: "Segoe UI", Arial, sans-serif; font-size: 15px; }
    #api-title b { color: #e9a319; }
</style>
</head>
<body>
<div id="api-title"><b>Dokumentasi API</b> — AI Assistant Sistem Informasi Perdagangan (Kemendag) · lokal: <code>http://localhost:3001</code></div>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
    window.onload = function () {
        window.ui = SwaggerUIBundle({
            url: "/api/docs.json",
            dom_id: "#swagger-ui",
            deepLinking: true,
            persistAuthorization: true
        });
    };
</script>
</body>
</html>`);
});

export default router;