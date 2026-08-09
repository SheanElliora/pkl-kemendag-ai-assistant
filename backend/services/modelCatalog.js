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
        id: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash (default, cepat/hemat)"
    },
    {
        id: "google/gemini-2.5-pro",
        label: "Gemini 2.5 Pro (akurasi lebih tinggi)"
    },
    {
        id: "openai/gpt-4o-mini",
        label: "OpenAI GPT-4o mini (hemat)"
    },
    {
        id: "openai/gpt-4o",
        label: "OpenAI GPT-4o (akurat)"
    },
    {
        id: "meta-llama/llama-3.1-8b-instruct",
        label: "Meta Llama 3.1 8B (open source)"
    },
    {
        id: "anthropic/claude-3.5-sonnet",
        label: "Anthropic Claude 3.5 Sonnet"
    }
];