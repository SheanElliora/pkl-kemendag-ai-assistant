import { askRAG } from "./services/ragService.js";


const question =
    "Apa peluang ekspor tekstil Indonesia ke Nigeria?";


const result =
    await askRAG(question);



console.log(
    "\n================================"
);

console.log(
    "PERTANYAAN:"
);

console.log(
    question
);



console.log(
    "\n=== JAWABAN AI ===\n"
);


console.log(
    result.answer
);



console.log(
    "\n=== SUMBER DOKUMEN ===\n"
);



result.sources.forEach((source, index)=>{


    console.log(
        `Sumber ${index+1}`
    );


    console.log(
        "Dokumen:",
        source.filename
    );


    console.log(
        "Halaman:",
        source.page
    );


    console.log(
        "-------------------"
    );


});