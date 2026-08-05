import { searchDocuments } from "./services/retrieverService.js";


const result = await searchDocuments(
    "Apa topik utama dalam dokumen TEST?"
);


console.log("\n====================");
console.log("HASIL RETRIEVER");
console.log("====================");


result.metadata.forEach((item,index)=>{

    console.log(
        index+1,
        item.filename,
        "page:",
        item.page,
        "distance:",
        result.distances[index]
    );

});