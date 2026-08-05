import { searchDocuments } from "./services/retrieverService.js";


const result =
await searchDocuments(
    "Apa informasi tentang produk tekstil Nigeria?"
);



console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);