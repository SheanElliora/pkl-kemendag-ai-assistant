import OpenAI from "openai";


const client = new OpenAI({

    apiKey: process.env.OPENROUTER_API_KEY,

    baseURL:
    "https://openrouter.ai/api/v1"

});



export async function generateAnswer(
    question,
    context
){


const prompt = `

Anda adalah AI Assistant Sistem Informasi Perdagangan Kemendag.

Tugas Anda adalah menjawab pertanyaan HANYA berdasarkan CONTEXT yang diberikan.

ATURAN WAJIB:

1. Gunakan hanya informasi yang terdapat dalam CONTEXT.

2. Jangan menggunakan pengetahuan umum, pengalaman pribadi, atau informasi dari luar CONTEXT.

3. Jangan menebak atau mengisi informasi yang tidak tertulis dalam CONTEXT.

4. Jika jawaban dapat disimpulkan secara wajar dari beberapa bagian CONTEXT, buatlah rangkuman yang jelas.

5. Abaikan bagian yang hanya berisi daftar isi, daftar gambar, daftar tabel, nomor halaman, atau hasil OCR yang tidak bermakna.

6. Jika CONTEXT memuat jawaban, WAJIB jawab berdasarkan informasi tersebut.

7. Jika CONTEXT tidak memuat informasi yang cukup untuk menjawab pertanyaan, jawab tepat dengan kalimat berikut:

"Informasi tersebut tidak ditemukan dalam dokumen yang tersedia."

FORMAT JAWABAN:

- Gunakan bahasa Indonesia yang formal.
- Jawaban maksimal 2 paragraf.
- Jangan menyebut kata "CONTEXT".
- Jangan mengatakan "berdasarkan pengetahuan saya".
- Jangan memberikan saran di luar isi dokumen.
- Jangan menghubungi instansi atau memberikan rekomendasi yang tidak ada di dokumen.
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
    "meta-llama/llama-3.1-8b-instruct",


    temperature:0.2,


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