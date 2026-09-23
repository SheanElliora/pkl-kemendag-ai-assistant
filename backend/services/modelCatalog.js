export const MODEL_CATALOG = [
    {
        id: "gemini-3.6-flash",
        label: "Gemini 3.6 Flash (Google AI Studio, gratis) — REKOMENDASI"
    },
    {
        id: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash Lite (Google AI Studio, gratis, backup)"
    },
    {
        id: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash (Google AI Studio, gratis, manual)"
    },
    {
        id: "gemini-3.1-flash-lite",
        label: "Gemini 3.1 Flash Lite (Google AI Studio, gratis, manual)"
    },
    {
        id: "cohere/north-mini-code:free",
        label: "Cohere North Mini (OpenRouter gratis)"
    },
    {
        id: "dots-studio/dots-3-note-preview:free",
        label: "Dots 3 Note (OpenRouter gratis, backup)"
    },
    {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        label: "Nemotron Super 120B (OpenRouter gratis, backup)"
    },
    {
        id: "nex-agi/nex-n2.5-pro:free",
        label: "Nex N2.5 Pro (OpenRouter gratis, backup)"
    },
    {
        id: "nex-agi/nex-n2.5-mini:free",
        label: "Nex N2.5 Mini (OpenRouter gratis, backup)"
    }
];

export function availableModels(hasGemini = Boolean(process.env.GEMINI_API_KEY)) {
    if (hasGemini) return MODEL_CATALOG;
    return MODEL_CATALOG.filter((m) => !/gemini/i.test(m.id));
}

export function defaultModelId(hasGemini = Boolean(process.env.GEMINI_API_KEY)) {
    if (hasGemini) return "gemini-3.6-flash";
    return process.env.OPENROUTER_MODEL || "cohere/north-mini-code:free";
}
