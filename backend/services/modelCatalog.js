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
        id: "nex-agi/nex-n2.5-pro:free",
        label: "Nex N2.5 Pro (gratis, 50 req/hari) — REKOMENDASI gratis"
    },
    {
        id: "nex-agi/nex-n2.5-mini:free",
        label: "Nex N2.5 Mini (gratis, backup 1)"
    },
    {
        id: "inclusionai/ling-3.0-flash-fin:free",
        label: "Ling 3.0 Flash (gratis, backup 2)"
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