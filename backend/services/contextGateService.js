// ============================================================
// Context Gate — ringan, gratis, tanpa LLM
//
// Tujuan mentor "gate context": jaga jawaban tetap pada
// konteks yang sedang dibicarakan (mis. Jepang), tidak
// melebar kemana-mana saat user follow-up pakai kata
// ganti seperti "disana", "gamenya", "itu".
//
// Gate ini BEKERJA SEBELUM retrieval (ragService) dan
// HANYA memakai operasi string/token lokal — 0 token,
// 0 biaya, <1ms. LLM tetap hanya dipakai untuk
// generate jawaban akhir (llmService).
//
// Dua lapis gate:
//   Gate A (follow-up gate) : apakah Q2 butuh konteks Q1?
//   Gate B (grounding gate) : sudah ada di retrieverService
//   via DISTANCE_RATIO/OFFSET — tidak diduplikasi di sini.
//
// Jika Gate A terbuka, searchQuery = Q_now + " " + Q_prev
// (konteks terakhir) agar embedding mengandung entitas
// yang dirujuk pronoun (mis. "jepang"). Q asli tetap
// dikirim ke LLM sebagai PERTANYAAN.
// ============================================================

import fs from "fs";
import path from "path";
import { DOCS_FOLDER } from "../config.js";

// Anaphora / deiksis Indonesia yang menandakan rujukan balik
const ANAPHORA = /\b(disana|disitu|disini|di\s*sana|di\s*situ|di\s*sini|sana|situ|sini|tersebut|itu|di\s*atas|atas|sebelumnya|tadi|yang\s*tadi|yang\s*sebelumnya|terakhir|lanjutannya|barusan)\b/i;

// Kata dengan akhiran -nya (gamenya, harganya, modalnya) —
// hampir selalu merujuk entitas sebelumnya dalam konteks chat.
// Kecualikan kata umum "hanya" yang bukan pronomina.
const NYA_EXCEPT = new Set(["hanya", "tentunya", "semuanya", "sebenarnya"]);
const NYA_REGEX = /\b([a-z]{3,}nya)\b/i;

// Vague follow-up pendek
const VAGUE = /\b(gimana|bagaimana|kalau|kalo|terus|lanjut|trus|kenapa|kapan|siapa|dimana|berapa)\b/i;

// Stopwords — disalin ringkas dari retrieverService agar
// tokenisasi konsisten tanpa import silang.
const STOP3 = new Set([
  "dan","dari","apa","itu","ini","ada","atau",
  "the","and","for","was","are","but","not","you",
  "all","can","had","her","his","its","our","out",
  "who","may","per","dna","nas","hns","xbe"
]);
const STOPWORD_ANY_LENGTH = new Set([
  "yang","dengan","untuk","dari","dalam","pada","akan","tidak","juga",
  "dapat","harus","serta","sudah","lebih","saat","agar","supaya",
  "bagi","oleh","karena","sampai","antara","melalui","menjadi",
  "adalah","sebagai","bahwa","atau","namun","tentang","mengenai",
  "terkait","berdasarkan","membutuhkan","sistem","merupakan",
  "berapa","bagaimana","apakah","mengapa","kapan","dimana","mana",
  "tolong","bisa","untuk","sebutkan","jelaskan","apa","siapa",
  "digunakan","membangun","melakukan","terdapat","tersebut",
  "itu","ini","ada","dengan","sebuah","seluruh","semua","setiap",
  "beberapa","banyak","utama","umum","besar","kecil","tinggi",
  "rendah","baru","lama","sangat","kurang","cukup","hampir",
  "maka","saya","kami","kita","mereka","anda","kalian",
  "were","been","being","have","has","had","does","did","doing",
  "would","could","should","shall","will","may","might","must",
  "than","then","them","they","this","that","these","those",
  "which","whose","where","when","while","there","here","about",
  "into","over","under","again","further","once","only","other",
  "some","such","same","own","each","both","few","more","most",
  "because","through","during","before","after","above","below",
  "use","using","used","make","made","making","get","got",
  "take","took","know","known","see","saw","say","said","give",
  "given","come","came","think","tell","show","find","found"
]);

function tokenize(text) {
  if (!text) return [];
  return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(w => {
    return (w.length >= 2 && /^\d+$/.test(w))
      || (w.length >= 4 && !STOPWORD_ANY_LENGTH.has(w))
      || (w.length === 3 && !STOP3.has(w));
  });
}

function hasNyaPronoun(text) {
  const lower = String(text).toLowerCase();
  const matches = lower.match(/\b[a-z]{3,}nya\b/gi) || [];
  for (const m of matches) {
    if (!NYA_EXCEPT.has(m.toLowerCase())) return true;
  }
  return false;
}

function getLastUserContext(history) {
  if (!history || history.length === 0) return "";
  const users = [...history].reverse().filter(h => h.role === "user").map(h => String(h.content || "").trim()).filter(Boolean);
  if (users.length === 0) return "";
  for (const u of users) {
    if (tokenize(u).length >= 2) return u;
  }
  return users[0] || "";
}

// --- Selective injection UNIVERSAL: otomatis dari nama file dokumen ---
// Tidak hardcode negara/produk — sistem baca folder docs/ dan bangun peta
// token -> jumlah dokumen yang mengandungnya. Token yang muncul di >=2
// dokumen (mis. "jepang" di 3 file) dianggap konteks umum (negara/region),
// token yang hanya di 1 dokumen (mis. "restoran","game","kain") dianggap
// topik spesifik. Gate bawa konteks umum jika Q tidak punya, dan bawa topik
// lama hanya jika Q tidak punya topik baru (cegah kontaminasi).
const GENERIC_DOC_EXCLUDE = new Set([
  "data","laporan","informasi","pasar","nomor","tahun","jurnal","retrieval",
  "augmented","generation","market","intelligent","signed","lampiran","vol",
  "skm","c250i","permendag","perdagangan","kementerian","kemendag"
]);

let docKeywordCache = null;
let docKeywordCacheTime = 0;
const DOC_CACHE_TTL = 30 * 1000;

function buildDocKeywordMap() {
  const now = Date.now();
  if (docKeywordCache && (now - docKeywordCacheTime) < DOC_CACHE_TTL) {
    return docKeywordCache;
  }
  const tokenDocCount = new Map();
  const allTokens = new Set();
  try {
    const files = fs.readdirSync(DOCS_FOLDER);
    for (const f of files) {
      const base = path.parse(f).name.toLowerCase();
      const toks = base.split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOPWORD_ANY_LENGTH.has(t) && !STOP3.has(t) && !GENERIC_DOC_EXCLUDE.has(t));
      const uniq = new Set(toks);
      for (const t of uniq) {
        allTokens.add(t);
        tokenDocCount.set(t, (tokenDocCount.get(t) || 0) + 1);
      }
    }
  } catch {
    const fallback = ["jepang","japan","nigeria","indonesia","restoran","restaurant","game","gamer","kain","ankara","tekstil","textile","instrumen","medis","medical","decoration","lights","lampu","jurnal","journal","rag"];
    for (const t of fallback) tokenDocCount.set(t, 1);
  }
  // Negara / wilayah — universal fallback agar doc baru tetap terdeteksi sebagai konteks umum
  const COUNTRY_FALLBACK = ["jepang","japan","nigeria","indonesia","cina","tiongkok","china","korea","vietnam","thailand","amerika","usa","singapura","malaysia","jerman","belanda","australia"];
  for (const c of COUNTRY_FALLBACK) {
    if (!tokenDocCount.has(c)) tokenDocCount.set(c, 2); // anggap umum
    else if (tokenDocCount.get(c) < 2) tokenDocCount.set(c, 2);
    allTokens.add(c);
  }
  const general = [];
  const specific = [];
  for (const [tok, cnt] of tokenDocCount.entries()) {
    if (cnt >= 2) general.push(tok);
    else specific.push(tok);
  }
  docKeywordCache = { tokenDocCount, general, specific, allTokens: [...allTokens] };
  docKeywordCacheTime = now;
  return docKeywordCache;
}

function containsKeyword(textLower, list) {
  for (const kw of list) {
    if (textLower.includes(kw)) return true;
  }
  return false;
}
function extractKeywords(textLower, list) {
  const found = [];
  for (const kw of list) {
    if (textLower.includes(kw) && !found.includes(kw)) found.push(kw);
  }
  return found;
}

function buildInjection(prevText, currText) {
  const prevLower = String(prevText).toLowerCase();
  const currLower = String(currText).toLowerCase();
  const { general, specific } = buildDocKeywordMap();

  const hasGeneralCurr = containsKeyword(currLower, general);
  const hasSpecificCurr = containsKeyword(currLower, specific);

  const genPrev = extractKeywords(prevLower, general);
  const specPrev = extractKeywords(prevLower, specific);

  const inject = [];
  if (!hasGeneralCurr) inject.push(...genPrev);
  // Bawa topik lama hanya jika Q tidak punya topik baru
  if (!hasSpecificCurr && specPrev.length > 0) {
    inject.push(specPrev[0]);
  }
  // Fallback universal: jika tidak ada keyword doc yang terdeteksi, bawa token bermakna dari prev
  // (berguna untuk dokumen baru yang nama filenya belum mengandung keyword yang terdeteksi)
  if (inject.length === 0) {
    const prevTokens = tokenize(prevText);
    if (prevTokens.length > 0) {
      const currTokens = new Set(tokenize(currText));
      const extra = prevTokens.filter(t => !currTokens.has(t)).slice(0, 2);
      // hanya jika extra tersebut tidak generic (panjang >=4)
      const filtered = extra.filter(t => t.length >= 4);
      inject.push(...filtered.slice(0, 2));
    }
  }
  // Batasi 3 token agar query tidak bengkak
  return inject.slice(0, 3).join(" ");
}

/**
 * Gate keputusan: apakah pertanyaan butuh konteks sebelumnya?
 * @param {string} question
 * @param {Array<{role:string,content:string}>} history - 6 pesan terakhir dari chatHistoryService
 * @returns {{searchQuery:string, gateApplied:boolean, reason:string, contextUsed:string|null}}
 */
export function resolveContextualQuery(question, history) {
  const q = String(question || "").trim();
  if (!q) return { searchQuery: q, gateApplied: false, reason: "empty", contextUsed: null };
  if (!history || history.length === 0) {
    return { searchQuery: q, gateApplied: false, reason: "no_history", contextUsed: null };
  }

  const qLower = q.toLowerCase();
  const tokens = tokenize(q);

  const hasNya = hasNyaPronoun(q);
  // "apa itu X" (mis. "apa itu kain ankara?") bukan rujukan balik — itu pertanyaan definisi standalone.
  // Bedakan dengan "kalau yang itu gimana?" yang memang anaphora.
  let hasAnaphora = ANAPHORA.test(qLower);
  if (hasAnaphora && /^\s*apa\s+itu\s+[a-z]{3,}/.test(qLower)) {
    // cek apakah ada penanda lain selain "itu" (disana/tersebut/tadi) atau -nya
    const otherDeixis = /\b(disana|disitu|disini|di\s*sana|di\s*situ|di\s*sini|sana|situ|sini|tersebut|di\s*atas|sebelumnya|tadi|yang\s*tadi|terakhir|barusan)\b/i;
    const withoutItu = qLower.replace(/\bitu\b/gi, "");
    if (!otherDeixis.test(withoutItu) && !hasNya) {
      hasAnaphora = false;
    }
  }
  const isShort = tokens.length <= 4;
  const isVagueShort = isShort && VAGUE.test(qLower);
  const isLongButAnaphoric = tokens.length <= 8 && (hasAnaphora || hasNya);

  // Cek apakah Q sudah mengandung keyword dokumen (universal, efisien)
  const { general: _gen, specific: _spec } = buildDocKeywordMap();
  const hasSpecificCurr = containsKeyword(qLower, _spec);
  const hasGeneralCurr = containsKeyword(qLower, _gen);

  let shouldGate = false;
  let reason = "standalone";
  if (hasAnaphora) {
    shouldGate = true;
    reason = "anaphora:" + (qLower.match(ANAPHORA)?.[0] || "deiksis");
  } else if (hasNya) {
    shouldGate = true;
    const m = qLower.match(NYA_REGEX);
    reason = "nya:" + (m?.[0] || "pronoun");
  } else if (isVagueShort && !hasSpecificCurr) {
    // Hanya vague_short yang benar-benar tanpa topik spesifik (mis. "kalau di jepang gimana?")
    // Jika sudah ada topik spesifik seperti "kain ankara", itu standalone walau pendek
    shouldGate = true;
    reason = "vague_short:" + tokens.length;
  } else if (isLongButAnaphoric) {
    shouldGate = true;
    reason = "anaphora_long";
  }

  // Guard tambahan: jika sudah punya topik spesifik & tidak ada anaphora/nya, jangan gate
  if (!hasAnaphora && !hasNya && hasSpecificCurr && tokens.length <= 6) {
    // Mis. "siapa pemasok kain Ankara?" sudah eksplisit walau pendek
    shouldGate = false;
    reason = "explicit_specific";
  }

  // Guard: jika pertanyaan sudah sangat eksplisit & panjang (>12 token) dan
  // tidak ada anaphora/nya, anggap standalone walau ada history — cegah kontaminasi.
  if (!hasAnaphora && !hasNya && tokens.length >= 10) {
    shouldGate = false;
    reason = "explicit_long";
  }

  if (!shouldGate) {
    return { searchQuery: q, gateApplied: false, reason, contextUsed: null };
  }

  const context = getLastUserContext(history);
  if (!context) {
    return { searchQuery: q, gateApplied: false, reason: "no_context_text", contextUsed: null };
  }

  // Hindari duplikasi jika Q sudah mengandung konteks yang sama persis
  // (mis. user mengulang negara yang sama secara eksplisit)
  const ctxTokens = tokenize(context);
  const overlap = ctxTokens.filter(t => qLower.includes(t)).length;
  // Jika sudah overlap tinggi (>50% token konteks sudah ada di Q), tidak perlu gate
  if (ctxTokens.length > 0 && overlap / ctxTokens.length > 0.6) {
    return { searchQuery: q, gateApplied: false, reason: "already_contains_context", contextUsed: null };
  }

  // Ringan: gabung Q sekarang + keyword selektif dari konteks lama
  // Mis. Q="gamenya disana" + prev="regulasi restoran jepang" -> inject "jepang" saja (bukan "restoran")
  // Q="berapa modalnya?" + prev="regulasi restoran jepang" -> inject "jepang restoran"
  const injection = buildInjection(context, q);
  const searchQuery = injection ? q + " " + injection : q;
  // simpan konteks asli untuk log, tapi searchQuery hanya bawa keyword penting
  const clipped = context.length > 300 ? context.slice(0, 300) : context;

  return { searchQuery, gateApplied: true, reason, contextUsed: clipped, injection };
}

export default { resolveContextualQuery };
