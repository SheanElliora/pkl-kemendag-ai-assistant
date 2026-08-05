import { useState } from 'react';
import ReactMarkdown from 'react-markdown';


export default function App() {

  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState('');



  async function sendMessage() {

    const text = input.trim();

    if (!text) return;


    // tampilkan pertanyaan user
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: text
      }
    ]);


    setInput('');



    try {


      const res = await fetch('/api/chat', {

        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          message: text
        })

      });



      const data = await res.json();



      console.log("Response backend:", data);



      // simpan jawaban + sources
      setMessages((prev) => [

        ...prev,

        {
          role: 'bot',

          text:
            data.answer ??
            data.reply ??
            data.error ??
            "Tidak ada jawaban.",


          sources:
            data.sources ?? []

        }

      ]);



    } catch (error) {


      console.error(
        "Error:",
        error
      );


      setMessages((prev)=>[

        ...prev,

        {
          role:'bot',

          text:
          "Terjadi kesalahan saat menghubungkan ke server.",

          sources:[]

        }

      ]);

    }

  }



  return (

    <div
      style={{
        maxWidth:480,
        margin:'40px auto',
        fontFamily:'sans-serif'
      }}
    >


      <h2>
        Chatbot Prototype
      </h2>



      <div

        style={{

          border:'1px solid #ccc',

          borderRadius:8,

          padding:12,

          height:320,

          overflowY:'auto'

        }}

      >


        {
          messages.map((m,i)=>(


            <div

              key={i}

              style={{

                textAlign:
                  m.role === 'user'
                  ? 'right'
                  : 'left',

                marginBottom:15

              }}

            >


              <b>

                {
                  m.role === 'user'
                  ? 'Anda'
                  : 'Bot'
                }

                :

              </b>


              {


                m.role === 'user'

                ?

                (

                  <span>
                    {m.text}
                  </span>

                )


                :


                (

                  <>

                    <ReactMarkdown>

                      {m.text}

                    </ReactMarkdown>



                    {


                      m.sources &&

                      m.sources.length > 0

                      &&

                      (

                        <div

                          style={{

                            marginTop:10,

                            padding:10,

                            borderTop:
                            '1px solid #ddd',

                            fontSize:12

                          }}

                        >


                          <b>
    Sumber Referensi
</b>



                          {

                            Object.entries(

    m.sources.reduce((acc, source) => {

        if (!acc[source.filename]) {

            acc[source.filename] = [];

        }

        acc[source.filename].push(source.page);

        return acc;

    }, {})

).map(([filename, pages]) => (

    <div
        key={filename}
        style={{
            marginTop: 8
        }}
    >

        📄 <b>{filename}</b>

        <br/>

        Halaman:

        {

            [...new Set(pages)]

                .sort((a, b) => a - b)

                .join(", ")

        }

    </div>

))

                          }


                        </div>

                      )


                    }


                  </>

                )


              }


            </div>


          ))

        }


      </div>





      <div

        style={{

          display:'flex',

          gap:8,

          marginTop:8

        }}

      >


        <input

          value={input}


          onChange={(e)=>
            setInput(e.target.value)
          }


          onKeyDown={(e)=>

            e.key === 'Enter'
            &&
            sendMessage()

          }


          style={{

            flex:1

          }}


          placeholder="Ketik pesan..."

        />



        <button

          onClick={sendMessage}

        >

          Kirim

        </button>


      </div>



    </div>

  );

}