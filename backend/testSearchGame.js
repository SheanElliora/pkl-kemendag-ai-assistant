import { searchDocuments } from "./services/retrieverService.js";


const question =
"Bagaimana perkembangan industri game di Jepang?";


const result =
await searchDocuments(question);



console.log("\n=================");
console.log("HASIL DOCUMENT");
console.log("=================");



result.documents.forEach((doc,index)=>{


    console.log("\n----------------");
    console.log(
        "HASIL",
        index+1
    );


    console.log(doc);


});



console.log("\n=================");
console.log("METADATA");
console.log("=================");


console.log(result.metadata);