import OpenAI from "openai";


const client = new OpenAI({

    apiKey: process.env.OPENROUTER_API_KEY,

    baseURL:
    "https://openrouter.ai/api/v1",

    timeout: 60000

});



function buildPrompt(question, context) {

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

- Gunakan bahasa Indonesia yang formal.
- Jawaban maksimal 2 paragraf.
- Jangan menyebut kata "CONTEXT".
- Jangan mengatakan "berdasarkan pengetahuan saya".
- Jangan memberikan saran di luar isi dokumen.
- Jika pertanyaan menanyakan "siapa", sebutkan nama pihaknya terlebih dahulu lalu jelaskan.
- Jika pertanyaan menanyakan "apa", jelaskan poin-poin pentingnya.
- Beri nomor kutipan untuk setiap fakta. Letakkan [n] tepat akhir kalimat atau klaim yang bersumber dari file tersebut, sesuai urutan "FILE:" pada CONTEXT (file pertama = [1], file kedua = [2], dst.). Contoh: "Produk tekstil Indonesia dikenal baik di Nigeria [1]."
- Gunakan nomor kutipan HANYA untuk klaim yang benar-benar berasal dari file itu.
- Jika jawaban berupa kalimat "Informasi tersebut tidak ditemukan dalam dokumen yang tersedia.", jangan menyertakan kutipan apa pun.

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
    model
){


const prompt = buildPrompt(question, context);



const completion =
await client.chat.completions.create({

    model:
    model ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-4o-mini",


    temperature:0.2,

    max_tokens:1024,


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
    model
){

const prompt = buildPrompt(question, context);

const stream =
await client.chat.completions.create({

    model:
    model ||
    process.env.OPENROUTER_MODEL ||
    "openai/gpt-4o-mini",

    temperature:0.2,

    max_tokens:1024,

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