// ============================================================
// Conversational Gate UNIVERSAL — sapaan / chit-chat vs dokumen
//
// Prinsip: BUKAN daftar pola per pertanyaan, melainkan analisis
// struktur: pertanyaan yang TIDAK mengandung substansi topik
// (hanya kata sapaan, pronomina, kata tanya, kata bantu, dll)
// tidak butuh retrieval. Pertanyaan ber-substansi dicek melawan
// kosakata korpus (dibaca OTOMATIS dari backend/docs/ — adaptif
// saat dokumen bertambah) + istilah inti domain perdagangan.
//
// 0 token, 0 biaya, <1ms. Keputusan:
//
//   RAG (bukan percakapan) bila SALAH SATU:
//     G1. ada pronomina -nya / anafora kuat (topik by reference)
//     G2. ada kata kerja pencari-dokumen (jelaskan, sebutkan, ...)
//     G3. ada entitas dokumen (kode HS, mata uang, persen)
//     G4. "itu/ini" + ada history (follow-up, biar context gate kerja)
//     G5. sisa kata substansi cocok kosakata korpus / domain
//     G6. follow-up samar (gimana/terus/berapa/...) + ada history
//   Selebihnya -> PERCAKAPAN (skip retrieval, tanpa sitasi).
// ============================================================

import { buildDocKeywordMap } from "./contextGateService.js";

// --- G1: pronomina -nya (gamenya, harganya, modalnya) selalu topikal.
// Kecualikan kata umum yang bukan pronomina.
const NYA_EXCEPT = new Set([
    "hanya", "tentunya", "semuanya", "sebenarnya", "katanya",
    "rupanya", "akibatnya", "akhirnya", "awalnya", "misalnya",
    "contohnya", "tandanya", "artinya", "maknanya", "gunanya",
]);
const NYA_REGEX = /\b([a-z]{3,}nya)\b/i;

// --- G1: anafora kuat (rujukan balik eksplisit ke konteks sebelumnya)
const STRONG_ANAPHORA = /\b(tersebut|tadi|sebelumnya|barusan|disana|disitu|disini|sana|situ|sini|di\s*sana|di\s*situ|di\s*sini|yang\s*tadi|yang\s*sebelumnya|di\s*atas)\b/i;

// --- G2: kata kerja pencari-dokumen (imperatif informatif)
const SEEKING_VERBS = new Set([
    "jelaskan", "sebutkan", "tunjukkan", "tunjukan", "berikan",
    "beritahu", "beritahukan", "ringkas", "ringkaskan", "rangkum",
    "rangkumkan", "carikan", "cari", "uraikan", "jabarkan",
    "paparkan", "tampilkan", "contohkan", "daftarkan",
]);

// --- G3: entitas kuat sinyal dokumen
const HS_REGEX = /\bhs\s*\d+/i;
const CURRENCY_REGEX = /\b(usd|idr|rp|jpy|cny|cnh|eur|myr|sgd|thb|vnd|php)\s*[\d.,]+/i;
const PERCENT_REGEX = /\d+\s*(%|persen|percent)/i;

// --- G5: istilah inti domain perdagangan (jangkar stabil app Kemendag;
// kosakata spesifik korpus dibaca otomatis dari backend/docs/)
const DOMAIN_CORE = [
    "ekspor", "impor", "perdagangan", "dagang", "regulasi", "peraturan",
    "tarif", "bea", "cukai", "pajak", "kuota", "larangan", "dilarang",
    "hs", "komoditas", "komoditi", "produk", "barang", "jasa",
    "pasar", "industri", "sektor", "bisnis", "usaha", "investasi",
    "umkm", "pemasok", "konsumen", "produsen", "distributor",
    "persyaratan", "perizinan", "izin", "lisensi", "sertifikasi",
    "sertifikat", "standar", "mutu", "kualitas", "label",
    "negara", "nasional", "internasional", "global",
    "harga", "biaya", "modal", "nilai", "bayar", "pembayaran",
    "turis", "wisata", "pariwisata", "pengunjung",
    "restoran", "kuliner", "makanan", "minuman",
    "tekstil", "kain", "garmen", "pakaian", "fesyen", "fashion",
    "medis", "kesehatan", "instrumen", "peralatan", "alat",
    "game", "gim", "permainan", "lampu", "dekorasi",
    "dokumen", "laporan", "jurnal", "penelitian", "data",
];

// --- Kata sosial: bila tersisa hanya ini (atau kosong) -> percakapan.
// Kelas kata TERTUTUP & stabil (bukan daftar pertanyaan).
const SOCIAL_WORDS = new Set([
    // sapaan
    "halo", "hai", "hi", "hello", "hey", "salam", "assalamualaikum",
    "alaikumsalam", "selamat", "pagi", "siang", "sore", "malam",
    "good", "morning", "afternoon", "evening",
    // terima kasih
    "terima", "kasih", "makasih", "thanks", "thx", "thank", "you",
    "nuhun", "matur", "suwun",
    // perpisahan
    "dadah", "bye", "jumpa", "tinggal", "goodbye",
    // identitas diri
    "nama", "diri", "identitas",
    // afirmasi / interjeksi
    "ok", "oke", "okee", "sip", "yap", "yup", "yes", "baik",
    "siap", "oh", "ooh", "wah", "wow", "wih", "hmm", "haha",
    "hehe", "kabar",
    // pronomina
    "aku", "saya", "kamu", "kau", "anda", "kita", "kami",
    "kalian", "dia", "mereka", "beliau", "mu", "ku", "gue", "lo",
    // kata tanya
    "apa", "siapa", "kapan", "kenapa", "mengapa", "bagaimana",
    "gimana", "mana", "berapa", "dimana", "apakah", "kok",
    // kata bantu / kesopanan / partikel
    "bisa", "dapat", "boleh", "mau", "ingin", "tolong", "mohon",
    "coba", "silakan", "silahkan", "harap", "minta", "tanya",
    "bantu", "bantuin", "aja", "saja", "dong", "deh", "sih",
    "lah", "kah", "pun", "ya", "yuk", "ayo", "terus", "trus",
    "lanjut", "lalu", "kemudian", "abis", "yang", "dan",
    "di", "ke", "dari", "untuk", "dengan", "pada", "adalah",
    "atau", "itu", "ini", "ada", "tidak", "nggak", "enggak",
    "tak", "juga", "sudah", "belum", "sedang", "lagi", "sangat",
    "tentang", "mengenai", "soal", "hal", "nih", "tuh", "sana",
]);

// Kata yang menandakan konteks SOSIAL (sapaan/makasih/pamit/identitas)
// -> tetap percakapan walau ada history (bedakan dari follow-up samar).
const SOCIAL_SIGNAL = /\b(halo|hai|hello|hey|assalamualaikum|selamat|pagi|siang|sore|malam|terima|kasih|makasih|thanks|thx|dadah|bye|jumpa|tinggal|nama|diri|identitas|ok|oke|sip|baik|siap|kabar|salam)\b/i;

// Follow-up samar: tanpa topik sendiri, hanya bermakna dengan history.
const VAGUE_FOLLOWUP = /^(gimana|bagaimana|terus|trus|lanjut|lanjutkan|lalu|kemudian|kenapa|mengapa|kapan|berapa|siapa|mana|dimana|oh|oke|ok|baik|siap|iya|ya|betul|benar|salah|tidak|nggak|jadi|apanya|yang\s*mana)\b[\s?]*$/i;

function tokenizeQ(text) {
    return String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3);
}

function hasNyaPronoun(text) {
    const matches = String(text || "").toLowerCase().match(/\b[a-z]{3,}nya\b/gi) || [];
    return matches.some((m) => !NYA_EXCEPT.has(m.toLowerCase()));
}

// Kosakata korpus (cache 30 dtk di contextGateService) + domain inti.
let domainUnionCache = null;
function getDomainUnion() {
    const map = buildDocKeywordMap();
    const set = new Set(DOMAIN_CORE);
    for (const t of (map.allTokens || [])) set.add(String(t).toLowerCase());
    for (const t of (map.general || [])) set.add(String(t).toLowerCase());
    for (const t of (map.specific || [])) set.add(String(t).toLowerCase());
    domainUnionCache = set;
    return set;
}

// Klasifikasi lunak sub-tipe untuk hint prompt (bukan penentu gate).
function classifySubtype(qLower) {
    if (/\b(halo|hai|hello|hey|assalamualaikum|selamat|pagi|siang|sore|malam|salam|kabar)\b/i.test(qLower)) return "greeting";
    if (/\b(dadah|bye|jumpa|goodbye)\b/i.test(qLower) || /\bselamat\s+tinggal\b/i.test(qLower)) return "farewell";
    if (/\b(terima|kasih|makasih|thanks|thx|nuhun|matur)\b/i.test(qLower)) return "thanks";
    if (/\b(nama|diri|identitas)\b/i.test(qLower) || /\b(siapa\s*(kamu|kau|anda)|kamu\s*siapa|who\s*are\s*you)\b/i.test(qLower)) return "identity";
    if (/\b(susah|sulit|error|eror|gagal|ribet|bug|lemot|lambat|macet|crash|tidak\s*bisa|nggak\s*bisa)\b/i.test(qLower)) return "complaint";
    if (/\b(semangat|sukses|hebat|keren|mantap|bagus|pintar|pandai|good\s*job)\b/i.test(qLower)) return "encouragement";
    if (/\b(ok|oke|sip|baik|siap|betul|benar|iya)\b/i.test(qLower)) return "affirmation";
    if (/\b(bisa|dapat|mampu|bantu|tolong|fitur|kemampuan|fungsi|tugas)\b/i.test(qLower)) return "capability";
    return "general";
}

/**
 * Deteksi universal: percakapan (true) vs butuh dokumen (false).
 * @param {string} question
 * @param {Array} history - riwayat [{role, content}] untuk follow-up
 * @returns {{ isConversational: boolean, matchName: string|null }}
 */
export function detectConversational(question, history) {
    if (!question || typeof question !== "string") {
        return { isConversational: false, matchName: null };
    }
    const q = question.trim();
    if (!q) return { isConversational: false, matchName: null };
    const qLower = q.toLowerCase();
    const hasHistory = Array.isArray(history) && history.length > 0;

    // G1: pronomina -nya / anafora kuat -> topik by reference -> RAG
    if (hasNyaPronoun(q)) return { isConversational: false, matchName: null };
    if (STRONG_ANAPHORA.test(qLower)) return { isConversational: false, matchName: null };

    // G2/G3: kata kerja pencari-dokumen / entitas / cara-bagaimana -> RAG
    const toks = tokenizeQ(qLower);
    if (toks.some((t) => SEEKING_VERBS.has(t))) return { isConversational: false, matchName: null };
    if (HS_REGEX.test(q) || CURRENCY_REGEX.test(q) || PERCENT_REGEX.test(q)) {
        return { isConversational: false, matchName: null };
    }
    if (/\b(bagaimana|gimana)\b.*\bcara\b/i.test(qLower)) return { isConversational: false, matchName: null };

    // Sisa kata substansi = token di luar kelas kata sosial
    const substance = toks.filter((t) => !SOCIAL_WORDS.has(t));

    if (substance.length === 0) {
        // Tanpa substansi. Sinyal sosial -> percakapan (walau ada history).
        if (SOCIAL_SIGNAL.test(qLower)) {
            return { isConversational: true, matchName: classifySubtype(qLower) };
        }
        // Samar tanpa sinyal sosial + ada history -> follow-up topik -> RAG
        if (hasHistory && (VAGUE_FOLLOWUP.test(qLower) || /\b(itu|ini)\b/i.test(qLower))) {
            return { isConversational: false, matchName: null };
        }
        return { isConversational: true, matchName: classifySubtype(qLower) };
    }

    // G5: substansi cocok kosakata korpus (adaptif) / domain inti -> RAG
    const vocab = getDomainUnion();
    const hitsSubstr = (tok) => {
        if (vocab.has(tok)) return true;
        if (tok.length >= 6) {
            for (const v of vocab) {
                if (v.length >= 6 && (v.includes(tok) || tok.includes(v))) return true;
            }
        }
        return false;
    };
    if (substance.some(hitsSubstr)) return { isConversational: false, matchName: null };

    // Substansi tanpa kaitan korpus/domain (kamu lucu, asik banget) -> obrolan
    return { isConversational: true, matchName: classifySubtype(qLower) };
}
