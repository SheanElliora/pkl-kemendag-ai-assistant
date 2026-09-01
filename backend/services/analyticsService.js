import fs from "fs";
import path from "path";

const STATS_FILE = path.resolve(
    process.env.DATA_PATH || "./data",
    "analytics_stats.json"
);

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
        }
    } catch { /* ignore */ }
    return {
        totalQueries: 0,
        totalAnswers: 0,
        totalFallbacks: 0,
        modelUsage: {},
        questionCategories: {},
        avgResponseTime: 0,
        recentQueries: [],
        lastUpdated: null,
    };
}

function saveStats(stats) {
    try {
        fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
        stats.lastUpdated = new Date().toISOString();
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch { /* ignore */ }
}

export async function recordQuery(question, model, fallback = false) {
    const stats = loadStats();
    stats.totalQueries++;
    stats.totalAnswers++;

    if (!stats.modelUsage[model]) {
        stats.modelUsage[model] = 0;
    }
    stats.modelUsage[model]++;

    if (fallback) {
        stats.totalFallbacks++;
    }

    const category = categorizeQuestion(question);
    if (!stats.questionCategories[category]) {
        stats.questionCategories[category] = 0;
    }
    stats.questionCategories[category]++;

    stats.recentQueries.push({
        question: question.slice(0, 100),
        model,
        fallback,
        timestamp: new Date().toISOString(),
    });

    if (stats.recentQueries.length > 100) {
        stats.recentQueries = stats.recentQueries.slice(-100);
    }

    saveStats(stats);
    return stats;
}

export async function recordFallback(model) {
    const stats = loadStats();
    stats.totalFallbacks++;
    if (!stats.modelUsage[model]) {
        stats.modelUsage[model] = 0;
    }
    stats.modelUsage[model]++;
    saveStats(stats);
    return stats;
}

function categorizeQuestion(question) {
    const q = question.toLowerCase();
    if (/regulasi|peraturan|permendag|undang|pp|ki|pasal/i.test(q)) return "regulasi";
    if (/harga|nilai|nominal|uang|rp|usd/i.test(q)) return "nilai_keuangan";
    if (/impor|ekspor|export|import/i.test(q)) return "dagang_luar_negeri";
    if (/alat medis|instrumen|peralatan|medis|kesehatan/i.test(q)) return "alat_medis";
    if (/game|restoran|resto/i.test(q)) return "bisnis";
    if (/kain|tekstil|ankara|textile/i.test(q)) return "tekstil";
    if (/lampu|decoration|signed/i.test(q)) return "energi_listrik";
    if (/jurnal|riset|penelitian|makalah|academic/i.test(q)) return "akademik";
    if (/mse|mean|lstm|arima|regresi|algoritma|model/i.test(q)) return "analisis_data";
    if (/hs\s*\d+/i.test(q)) return "klasifikasi_dagang";
    return "umum";
}

export function getSystemStats() {
    const stats = loadStats();
    const totalModelCalls = Object.values(stats.modelUsage).reduce((a, b) => a + b, 0);
    return {
        totalQueries: stats.totalQueries,
        totalAnswers: stats.totalAnswers,
        totalFallbacks: stats.totalFallbacks,
        fallbackRate: totalModelCalls > 0
            ? ((stats.totalFallbacks / totalModelCalls) * 100).toFixed(1) + "%"
            : "0%",
        modelUsage: stats.modelUsage,
        questionCategories: stats.questionCategories,
        recentQueries: stats.recentQueries.slice(-20),
        lastUpdated: stats.lastUpdated || null,
    };
}

export function getQuestionStats() {
    const stats = loadStats();
    return {
        categories: stats.questionCategories,
        totalQuestions: stats.totalQueries,
        topCategory: Object.entries(stats.questionCategories).sort((a, b) => b[1] - a[1])[0] || null,
    };
}