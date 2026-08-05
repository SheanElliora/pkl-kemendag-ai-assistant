import { searchDocuments } from "./services/retrieverService.js";


const result =
await searchDocuments(
    "Model machine learning apa yang dipilih sebagai model terbaik dalam penelitian tersebut?"
);


console.log("\n=================");
console.log("HASIL DOCUMENT");
console.log("=================");


result.documents.forEach((doc,index)=>{

    console.log("\n----------------");
    console.log("HASIL", index+1);

    console.log(doc);

});


console.log("\n=================");
console.log("METADATA");
console.log("=================");


console.log(result.metadata);