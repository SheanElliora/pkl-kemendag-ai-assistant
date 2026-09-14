import {
    AutoTokenizer,
    AutoModel,
    Tensor
} from "@xenova/transformers";

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

export async function rerankDocuments(
    query,
    docs
) {

    const { tokenizer: tok, model: mdl } =
    await getReranker();

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

    const out =
    await mdl({
        input_ids,
        attention_mask
    });

    const logits =
    Array.from(out.logits.data);

    return logits.map(
        logit => 1 / (1 + Math.exp(-logit))
    );

}
