import OpenAI from "openai";


const client = new OpenAI({

    apiKey: process.env.OPENROUTER_API_KEY,

    baseURL:
    "https://openrouter.ai/api/v1",

    timeout: 60000

});



function buildPrompt(question, context, history) {

const historyBlock =
(history && history.length > 0)
    ? `

RIWAYAT PERCAKAPAN (tanya-jawab sebelumnya):

${history.map((h) => `- ${h.role === "user" ? "PENGGUNA" : "ASISTEN"}: ${h.content}`).join("\n")}

Gunakan riwayat di atas hanya sebagai konteks lanjutan (mis. pertanyaan rujukan seperti "sebutkan yang kedua tadi", "di atas", "terakhir"). Jangan pernah menyebutkan riwayat ini sebagai sumber; kutipan [n] tetap merujuk FILE: pada CONTEXT.

`
    : "";

return `

Anda adalah AI Assistant Sistem Informasi Perdagangan Kemendag.

Tugas Anda adalah menjawab pertanyaan berdasarkan CONTEXT yang diberikan.

ATURAN WAJIB:

1. Jawab HANYA berdasarkan informasi dalam CONTEXT. Jangan menambah pengetahuan luar.

2. Jika CONTEXT memuat informasi yang relevan (meskipun tersebar atau menggunakan istilah yang berbeda), gunakan dan rangkum dengan jelas.

3. Jika CONTEXT memuat topik atau negara yang berhubungan tapi tidak persis menjawab, JANGAN langsung bilang tidak ada. Bantu dengan POIN-POIN yang tersedia (mis. jenis produk, sektor terkait), lalu jelaskan keterbatasannya secara singkat. Contoh: dokumen yang menyebut jenis alat medis di Jepang TETAP memuat jawaban untuk pertanyaan "alat medis apa saja yang diimpor Jepang", walaupun kata "impor" tidak tertulis eksplisit — rangkum jenis alat tersebut.

4. Abaikan bagian yang hanya berisi daftar isi, daftar gambar, daftar tabel, nomor halaman, atau hasil OCR yang tidak bermakna.

5. Jangan terlalu cepat menyimpulkan bahwa informasi tidak ada. Periksa kata kunci yang serupa terlebih dahulu, termasuk istilah umum atau sejenis (mis. "impor" ↔ "perdagangan luar negeri", "alat medis" ↔ "instrumen/peralatan kesehatan").

6. Jika benar-benar tidak ada satupun bagian CONTEXT yang berkaitan dengan pertanyaan, jawab tepat dengan kalimat:

"Informasi tersebut tidak ditemukan dalam dokumen yang tersedia."

7. Kalimat "Informasi tersebut tidak ditemukan dalam dokumen yang tersedia." HANYA diizinkan jika keseluruhan CONTEXT sama sekali tidak membahas topik yang ditanyakan. Jika CONTEXT menyentuh topik/negara yang sama walau dengan istilah berbeda, wajib menjawab dengan fakta yang ada beserta kutipannya.

FORMAT JAWABAN:

- Jawab LANGSUNG inti pertanyaan pada kalimat pertama, tanpa kalimat pembuka atau basa-basi.
- HANYA tampilkan informasi yang benar-benar menjawab pertanyaan. JANGAN menambahkan detail, konteks, atau topik lain yang tidak ditanyakan. Contoh: jika yang ditanya REGULASI ekspor, jangan ikut menjelaskan metode pembayaran, tarif bea, harga, atau data pasar; jika yang ditanya NILAI IMPOR, beri angkanya dan jangan menjelaskan prosedur lain.
- PERHATIKAN KATA KUNCI PERTANYAAN: jawab sesuai aspek yang diminta. Pertanyaan "regulasi"/"persyaratan" → hanya aturan, kewajiban, dan prosedur wajib. Pertanyaan "harga"/"nilai" → hanya angka. Pertanyaan "pembayaran" → hanya metode transaksi. Hal di luar aspek itu JANGAN disertakan.
- Jawaban RINGKAS: idealnya 3-5 poin penting, maksimal sekitar 120 kata.
- Gunakan daftar bernomor (1. 2. 3.) atau bullet untuk rincian, bukan paragraf panjang.
- Jika pertanyaan menanyakan "siapa", sebutkan nama pihaknya terlebih dahulu lalu jelaskan singkat.
- Jika pertanyaan menanyakan angka/nilai, berikan angkanya langsung beserta satuannya.
- Gunakan bahasa Indonesia yang formal.
- Jangan menyebut kata "CONTEXT".
- Jangan mengatakan "berdasarkan pengetahuan saya".
- Jangan memberikan saran di luar isi dokumen.
- Beri nomor kutipan [n] untuk setiap fakta. Letakkan [n] tepat akhir kalimat atau klaim yang bersumber dari file tersebut, sesuai urutan "FILE:" pada CONTEXT (file pertama = [1], file kedua = [2], dst.). Contoh: "Tarif bea masuk HS 901890 sebesar 0% [4]."
- Gunakan nomor kutipan HANYA untuk klaim yang benar-benar berasal dari file itu.
- Jika jawaban berupa kalimat "Informasi tersebut tidak ditemukan dalam dokumen yang tersedia.", jangan menyertakan kutipan apa pun.

${historyBlock}
CONTEXT:

${context}

PERTANYAAN:

${question}

Jawaban:

`;

}


export async function generateAnswer(
    question,
    context,
    model,
    history
){


const prompt = buildPrompt(question, context, history);



const completion =
await client.chat.completions.create({

    model:
    model ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-4o-mini",


    temperature:0.2,

    max_tokens:512,


    messages:[

        {
            role:"user",
            content:prompt
        }

    ]

});


return completion
.choices[0]
.message
.content;


}


// =====================================================
// Streaming: hasil jawaban dikirim bertahap (SSE chunk)
// Dipakai route /api/chat untuk efek "mengetik".
// =====================================================

export async function generateAnswerStream(
    question,
    context,
    model,
    history
){

const prompt = buildPrompt(question, context, history);

const stream =
await client.chat.completions.create({

    model:
    model ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-4o-mini",

    temperature:0.2,

    max_tokens:512,

    stream:true,

    messages:[

        {
            role:"user",
            content:prompt
        }

    ]

});

return stream;

}


// =====================================================
// Terjemahkan error API ke pesan yang ramah dipahami
// pengguna akhir (ditampilkan langsung di chatbot).
// =====================================================

export function translateLLMError(error) {

    const status =
    error?.status;

    const msg =
    String(error?.message || error || "");

    const isCredits =
    status === 402 ||
    /credits|billing|quota|payment|insufficient/i.test(msg);

    const isRateLimit =
    status === 429 ||
    /rate limit|too many requests/i.test(msg);

    if (isCredits) {

        return "Saldo/kredit API (OpenRouter) hampir atau sudah habis. " +
        "Tidak dapat memproses permintaan. Silakan isi ulang kredit di " +
        "https://openrouter.ai/settings/credits lalu coba lagi.";

    }

    if (isRateLimit) {

        return "Terlalu banyak permintaan dalam waktu singkat. " +
        "Silakan tunggu beberapa saat lalu coba lagi.";

    }

    return "Terjadi kesalahan saat menghubungi model AI: " +
    msg.slice(0, 300);

}