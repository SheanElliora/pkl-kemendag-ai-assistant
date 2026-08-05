import { searchDocuments } from "./services/retrieverService.js";


const result =
await searchDocuments(
    "Apa peluang ekspor tekstil Indonesia ke Nigeria?"
);


console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);