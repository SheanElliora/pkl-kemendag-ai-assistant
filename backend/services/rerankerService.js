import {
    AutoTokenizer,
    AutoModel,
    Tensor
} from "@xenova/transformers";



// =====================================
// Reranker Cross-Encoder
//
// Model: bge-reranker-base
// Cross-encoder mengevaluasi pasangan
// (pertanyaan, dokumen) BERSAMA-sama,
// sehingga jauh lebih akurat daripada
// perbandingan embedding terpisah.
//
// Dipilih bge-reranker-base (bukan
// ms-marco-MiniLM-L-6-v2) karena model
// ini multilingual: skornya tetap tajam
// untuk pertanyaan berbahasa Indonesia,
// sedangkan ms-marco hampir selalu
// memberi skor ~0 sehingga tidak
// membedakan apa pun.
//
// Dipakai setelah pencarian awal Chroma
// untuk mengurutkan ulang kandidat paling
// relevan sebelum dikirim ke LLM.
// =====================================


const MODEL_NAME = "Xenova/bge-reranker-base";

const MAX_LENGTH = 512;

let tokenizer = null;
let model = null;



async function getReranker() {

    if (!tokenizer || !model) {

        console.log(
            "Loading reranker model (bge-reranker-base)..."
        );

        tokenizer =
        await AutoTokenizer.from_pretrained(MODEL_NAME);

        model =
        await AutoModel.from_pretrained(
            MODEL_NAME,
            {
                quantized: true,
                session_options: {
                    graph_optimization_level: 0
                }
            }
        );

        console.log(
            "Reranker model siap"
        );

    }

    return { tokenizer, model };

}



// =====================================
// Skor relevansi untuk daftar kandidat
//
// query  : teks pertanyaan user
// docs   : daftar teks dokumen yang akan
//          dinilai relevansinya
// return : array skor [0..1], semakin
//          besar semakin relevan.
// =====================================

export async function rerankDocuments(
    query,
    docs
) {

    const { tokenizer: tok, model: mdl } =
    await getReranker();


    // 1) Tokenisasi semua pasangan (query, doc)
    const encodings = [];

    for (const doc of docs) {

        const enc =
        await tok._encode_plus(
            query,
            doc,
            {
                add_special_tokens: true,
                truncation: true,
                max_length: MAX_LENGTH
            }
        );

        encodings.push(enc);

    }


    // 2) Padding agar semua pasangan sama panjang
    const maxLen =
    Math.min(
        MAX_LENGTH,
        Math.max(
            ...encodings.map(e => e.input_ids.length)
        )
    );


    const ids = new Array(encodings.length);
    const masks = new Array(encodings.length);

    encodings.forEach((enc, i) => {

        const idsRow = new Array(maxLen).fill(0);
        const maskRow = new Array(maxLen).fill(0);

        for (let j = 0; j < maxLen; j++) {

            if (j < enc.input_ids.length) {

                idsRow[j] = enc.input_ids[j];
                maskRow[j] = 1;

            }

        }

        ids[i] = idsRow;
        masks[i] = maskRow;

    });


    const flatIds = new BigInt64Array(
        ids.flat().map(x => BigInt(x))
    );

    const flatMasks = new BigInt64Array(
        masks.flat().map(x => BigInt(x))
    );


    const input_ids =
    new Tensor(
        "int64",
        flatIds,
        [encodings.length, maxLen]
    );

    const attention_mask =
    new Tensor(
        "int64",
        flatMasks,
        [encodings.length, maxLen]
    );


    // 3) Inferensi batch satu kali
    const out =
    await mdl({
        input_ids,
        attention_mask
    });


    // 4) Sigmoid logit tunggal -> skor relevansi
    const logits =
    Array.from(out.logits.data);

    return logits.map(
        logit => 1 / (1 + Math.exp(-logit))
    );

}