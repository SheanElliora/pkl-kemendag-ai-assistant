// =====================================
// Katalog model OpenRouter
//
// Satu API key OpenRouter berlaku untuk
// semua model di bawah. ID model dipakai
// pada request ke OpenRouter; cukup mengubah
// string ini untuk berpindah model
// (mis. gemini -> openai).
// =====================================

export const MODEL_CATALOG = [
    {
        id: "google/gemini-2.0-flash-exp:free",
        label: "Gemini 2.0 Flash Exp (gratis, cepat, stabil) — REKOMENDASI"
    },
    {
        id: "minimax/minimax-m3:free",
        label: "Minimax M3 (gratis, 50 req/hari)"
    },
    {
        id: "deepseek/deepseek-chat:free",
        label: "DeepSeek Chat (gratis, efisien)"
    },
    {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        label: "Llama 3.3 70B (gratis, open source)"
    },
    {
        id: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash (berbayar, cepat/hemat)"
    },
    {
        id: "openai/gpt-4o-mini",
        label: "OpenAI GPT-4o mini (berbayar, hemat)"
    }
];