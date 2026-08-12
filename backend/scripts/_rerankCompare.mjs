import { AutoTokenizer, AutoModel } from "@xenova/transformers";

const pairs = [
    { q: "Berapa rentang harga eceran lampu dekorasi di Nigeria?", docs: [
        "Struktur harga eceran produk berkisar antara NGN 50,000 - NGN 2,400,000 per piece",
        "Margin importir besar 10-25% pada harga beli, pedagang pasar 20-40%",
        "Nigeria sebagai negara berpenduduk terbesar di Afrika menawarkan potensi permintaan tekstil"
    ]},
    { q: "Berapa jumlah dokumen Wikipedia yang dipakai sebagai memori non-parametrik?", docs: [
        "The non-parametric memory is a Wikipedia dump from December 2018 divided into 21M documents",
        "Penjualan konsol luring turun dari 73,4% menjadi 45,5%",
        "The Legend of Zelda Tears of the Kingdom sold 1.9 million units"
    ]},
    { q: "Apa jenis game yang populer di Jepang?", docs: [
        "Jepang memiliki pasar game seluler terbesar di dunia, dominasi konsol genggam",
        "Restoran India cukup umum di seluruh Jepang dengan harga 700-2000 yen",
        "Jepang tercatat importir HS 901890 terbesar keenam dunia"
    ]}
];

async function scores(modelName, pair, queryTransform) {
    const tok = await AutoTokenizer.from_pretrained(modelName);
    const mdl = await AutoModel.from_pretrained(modelName, { quantized: true });
    const q = queryTransform(pair.q);
    const encodings = [];
    for (const d of pair.docs) {
        encodings.push(await tok._encode_plus(q, d, { add_special_tokens: true, truncation: true, max_length: 512 }));
    }
    const maxLen = Math.min(512, Math.max(...encodings.map(e => e.input_ids.length)));
    const ids = [], masks = [];
    encodings.forEach(e => {
        const r = new Array(maxLen).fill(0), m = new Array(maxLen).fill(0);
        for (let j = 0; j < maxLen; j++) { if (j < e.input_ids.length) { r[j] = e.input_ids[j]; m[j] = 1; } }
        ids.push(r); masks.push(m);
    });
    const { Tensor } = await import("@xenova/transformers");
    const out = await mdl({
        input_ids: new Tensor("int64", new BigInt64Array(ids.flat().map(x => BigInt(x))), [encodings.length, maxLen]),
        attention_mask: new Tensor("int64", new BigInt64Array(masks.flat().map(x => BigInt(x))), [encodings.length, maxLen])
    });
    const logits = Array.from(out.logits.data);
    if (out.logits.dims[1] === 1) return logits.map(l => 1 / (1 + Math.exp(-l)));
    return logits; // 2-class: skor klas 1
}

for (const p of pairs) {
    console.log("\n### Q:", p.q);
    const enQ = {
        "Berapa rentang harga eceran lampu dekorasi di Nigeria?": "What is the retail price range of decoration lights in Nigeria?",
        "Berapa jumlah dokumen Wikipedia yang dipakai sebagai memori non-parametrik?": "How many Wikipedia documents are used as non-parametric memory?",
        "Apa jenis game yang populer di Jepang?": "What types of games are popular in Japan?"
    }[p.q];
    console.log("  bge-reranker-base (query ID):", await scores("Xenova/bge-reranker-base", p, q => q));
    console.log("  bge-reranker-base (query EN):", await scores("Xenova/bge-reranker-base", p, q => enQ));
    console.log("  ms-marco (query EN):", await scores("Xenova/ms-marco-MiniLM-L-6-v2", p, q => enQ));
    console.log("  ms-marco (query ID):", await scores("Xenova/ms-marco-MiniLM-L-6-v2", p, q => q));
}
console.log("\nDONE");
