export function retrieveChunks(
    documents,
    query,
    topK = 5
){

    const stopWords = [
        "apa",
        "yang",
        "dan",
        "dengan",
        "di",
        "ke",
        "dari",
        "itu",
        "ini"
    ];


    const keywords =
        query
        .toLowerCase()
        .split(" ")
        .filter(
            word =>
            !stopWords.includes(word)
        );


    let results = [];


    documents.forEach(doc => {

        doc.chunks.forEach(chunk => {

            const text =
                chunk.toLowerCase();


            let score = 0;


            keywords.forEach(word => {

                if(text.includes(word)){

                    if(
                        word === "china" ||
                        word === "tiongkok" ||
                        word === "ekspor" ||
                        word === "impor" ||
                        word === "perdagangan"
                    ){

                        score += 2;

                    }
                    else{

                        score += 1;

                    }

                }

            });


            let finalScore = score;


            // kurangi skor untuk bagian administratif
            if(
                text.includes("nota dinas") ||
                text.includes("tembusan") ||
                text.includes("nomor:")
            ){
                finalScore -= 2;
            }


            results.push({

                filename: doc.filename,

                text: chunk,

                score: finalScore

            });

        });

    });

    if(
        results.every(
            item => item.score === 0
        )
    ){

        return documents
            .flatMap(doc =>
                doc.chunks.map(chunk => ({
                    filename:doc.filename,
                    text:chunk,
                    score:0
                }))
            )
            .slice(0, topK);

    }   

    return results
        .filter(item => item.score >= 1)
        .sort(
            (a,b) =>
            b.score - a.score
        )
        .slice(0, topK);

}