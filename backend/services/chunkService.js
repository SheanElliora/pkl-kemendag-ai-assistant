export function createChunks(
    pages,
    chunkSize = 1500,
    overlap = 300
){


    const chunks = [];



    for(const page of pages){


        const text =
        page.text;



        let start = 0;



        while(start < text.length){



            let end =
            start + chunkSize;



            if(end > text.length){

                end = text.length;

            }



            const chunkText =
            text.substring(
                start,
                end
            );



            if(chunkText.trim().length > 0){


                chunks.push({

                    page:
                    page.page,


                    text:
                    chunkText.trim()

                });


            }



            // pindah posisi dengan aman
            start =
            start + chunkSize - overlap;



            // proteksi agar tidak looping
            if(start >= text.length){

                break;

            }


        }


    }



    console.log(
        "Jumlah chunk:",
        chunks.length
    );



    return chunks;

}