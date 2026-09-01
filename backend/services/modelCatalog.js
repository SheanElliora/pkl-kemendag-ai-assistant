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
        id: "minimax/minimax-m3:free",
        label: "Minimax M3 (gratis, 50 req/hari) — REKOMENDASI gratis"
    },
    {
        id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        label: "Nemotron 3 Nano 30B (gratis, backup)"
    },
    {
        id: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash (berbayar, cepat/hemat)"
    },
    {
        id: "openai/gpt-4o-mini",
        label: "OpenAI GPT-4o mini (berbayar, hemat)"
    },
    {
        id: "openai/gpt-4o",
        label: "OpenAI GPT-4o (berbayar, akurat)"
    },
    {
        id: "anthropic/claude-3.5-sonnet",
        label: "Anthropic Claude 3.5 Sonnet (berbayar)"
    }
];