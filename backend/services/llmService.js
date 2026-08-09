import OpenAI from "openai";


const client = new OpenAI({

    apiKey: process.env.OPENROUTER_API_KEY,

    baseURL:
    "https://openrouter.ai/api/v1",

    timeout: 60000

});



export async function generateAnswer(
    question,
    context,
    model
){


const prompt = `

Anda adalah AI Assistant Sistem Informasi Perdagangan Kemendag.

Tugas Anda adalah menjawab pertanyaan berdasarkan CONTEXT yang diberikan.

ATURAN WAJIB:

1. Jawab HANYA berdasarkan informasi dalam CONTEXT. Jangan menambah pengetahuan luar.

2. Jika CONTEXT memuat informasi yang relevan (meskipun tersebar atau menggunakan istilah yang berbeda), gunakan dan rangkum dengan jelas.

3. Jika CONTEXT memuat topik yang berhubungan tapi tidak persis menjawab, tetap bantu dengan POIN-POIN yang tersedia lalu sebutkan keterbatasannya.

4. Abaikan bagian yang hanya berisi daftar isi, daftar gambar, daftar tabel, nomor halaman, atau hasil OCR yang tidak bermakna.

5. Jangan terlalu cepat menyimpulkan bahwa informasi tidak ada. Periksa kata kunci yang serupa terlebih dahulu.

6. Jika benar-benar tidak ada satupun bagian CONTEXT yang berkaitan dengan pertanyaan, jawab tepat dengan kalimat:

"Informasi tersebut tidak ditemukan dalam dokumen yang tersedia."

FORMAT JAWABAN:

- Gunakan bahasa Indonesia yang formal.
- Jawaban maksimal 2 paragraf.
- Jangan menyebut kata "CONTEXT".
- Jangan mengatakan "berdasarkan pengetahuan saya".
- Jangan memberikan saran di luar isi dokumen.
- Jika pertanyaan menanyakan "siapa", sebutkan nama pihaknya terlebih dahulu lalu jelaskan.
- Jika pertanyaan menanyakan "apa", jelaskan poin-poin pentingnya.

CONTEXT:

${context}

PERTANYAAN:

${question}

Jawaban:

`;



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