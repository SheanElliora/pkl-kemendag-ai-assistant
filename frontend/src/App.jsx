import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import "./App.css";

const styles = `
@keyframes bounce {

  0%, 100% {
    transform: translateY(0);
    opacity:0.3;
  }

  50% {
    transform: translateY(-5px);
    opacity:1;
  }

}
`;

export default function App() {


  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState('');

  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const suggestions = [
    "Bagaimana persepsi pasar Nigeria terhadap produk tekstil Indonesia?",
    "Bagaimana pasar game yang ada di Jepang sekarang?",
    "Bagaimana perkembangan industri restoran di Jepang?"
  ];

  function useSuggestion(text){

    setInput(text);

  }

  async function sendMessage() {


    const text = input.trim();


    if (!text || loading) return;



    setMessages((prev)=>[

      ...prev,

      {
        role:"user",
        text:text
      }

    ]);



    setInput('');

    setLoading(true);



    try {


      const res = await fetch('/api/chat', {

        method:'POST',

        headers:{

          'Content-Type':'application/json'

        },

        body:JSON.stringify({

          message:text

        })

      });



      const data = await res.json();



      setMessages((prev)=>[

        ...prev,

        {

          role:"bot",

          text:
            data.answer ??
            data.reply ??
            data.error ??
            "Tidak ada jawaban.",


          sources:
            data.sources ?? []

        }

      ]);



    }

    catch(error){


      setMessages((prev)=>[

        ...prev,

        {

          role:"bot",

          text:
          "Terjadi kesalahan koneksi ke server.",

          sources:[]

        }

      ]);


    }



    setLoading(false);


  }

  async function uploadDocument(e){


  const file = e.target.files[0];


  if(!file) return;



  const formData = new FormData();


  formData.append(
    "file",
    file
  );



  setUploading(true);



  try{


    const res = await fetch(
      "/api/upload",
      {

        method:"POST",

        body:formData

      }
    );



    const data =
    await res.json();



    alert(
      data.message
    );


  }
  catch(error){


    console.error(error);


    alert(
      "Upload gagal."
    );


  }



  setUploading(false);


}



  return (
    

    <div
style={{
height:"100vh",
background:
"linear-gradient(180deg,#eef5fb,#ffffff)",
padding:"35px",
fontFamily:'"Inter", sans-serif',
boxSizing:"border-box",
overflow:"hidden",
}}
>


      <div

style={{

maxWidth:"1100px",

margin:"auto",

background:"#f1f5f9a5",

borderRadius:"20px",

boxShadow:"0 10px 30px rgba(0,0,0,0.08)",

overflow:"hidden"

}}

>



        {/* HEADER */}

<div

style={{

background:
"linear-gradient(135deg, #004a8f, #0072bc)",

color:"white",

padding:"18px",

display:"flex",

alignItems:"center",

justifyContent:"space-between",

gap:"20px"

}}

>

<div

style={{

display:"flex",

alignItems:"center",

gap:"20px",

flex:1

}}

></div>

<img

src="/logo kemendag.png"

alt="Logo Kemendag"

style={{

width:"70px",

height:"70px",

objectFit:"cover",

background:"white",

borderRadius:"10px",

padding:"0"

}}

/>


<div>


<h2

style={{

margin:0,

fontSize:"20px",

fontWeight:"700"

}}

>

AI Document Intelligence

</h2>


<p

style={{

margin:"5px 0 0",

fontSize:"14px",

opacity:0.9

}}

>

Document Intelligence System - Kemendag

</p>


</div>

      <button

style={{

background:"rgba(255,255,255,0.15)",

color:"white",

border:"1px solid rgba(255,255,255,0.5)",

padding:"10px 16px",

borderRadius:"10px",

cursor:"pointer",

fontWeight:"600",

fontSize:"14px"

}}

>

🗑 Clear Chat

</button>


        </div>





        {/* CHAT AREA */}

        <div

style={{

height:"calc(100vh - 300px)",

overflowY:"auto",

padding:"20px",

background:"#eef2f756"

}}

>

        {
messages.length === 0 && (

<div>

<div
style={{
textAlign:"center",
marginBottom:"50px"
}}
>

<h2
style={{
margin:0,
fontSize:"28px",
fontWeight:"700",
color:"#004a8f"
}}
>
AI Assistant
</h2>

<p
style={{
marginTop:"12px",
fontSize:"15px",
color:"#475569",
lineHeight:"1.8"
}}
>
Sistem siap membantu menjawab pertanyaan berdasarkan dokumen yang telah diunggah.
<br />
Silakan pilih contoh pertanyaan atau ketik pertanyaan Anda.
</p>

</div>



<h4
style={{
marginBottom:"15px",
color:"#1e293b",
fontWeight:"600"
}}
>
Contoh Pertanyaan
</h4>

{

suggestions.map((item,index)=>(

<button

key={index}

onClick={()=>useSuggestion(item)}

style={{

display:"block",

width:"100%",

textAlign:"left",

marginBottom:"12px",

padding:"14px",

borderRadius:"12px",

border:"1px solid #dbeafe",

background:"#ffffff",

cursor:"pointer",

fontSize:"14px",

color:"#334155",

boxShadow:

"0 2px 6px rgba(0,0,0,0.05)"

}}

>

{item}

</button>


))

}


</div>

)
}


        {

          messages.map((m,index)=>(


            <div

style={{

display:"flex",

justifyContent:

m.role==="user"

?

"flex-end"

:

"flex-start",

gap:"12px",

padding:"10px 18px",

background:"transparent"

}}

>



              <div

style={{

maxWidth:"85%",

background:

m.role==="user"

?

"#dbeafe"

:

"#f8fafc",

border:

"none",

padding:"14px 20px",

borderRadius:

m.role==="user"

?

"18px 18px 4px 18px"

:

"18px 18px 18px 4px",

boxShadow:

"0 2px 6px rgba(0,0,0,0.08)"

}}

              >


                <b

style={{

fontSize:"14px",

color:

m.role==="user"

?

"#004a8f"

:

"#111827"

}}

>

{

m.role==="user"

?

"Anda"

:

"AI Document Intelligence"

}

</b>



                <div style={{
marginTop:"10px",
lineHeight:"1.6"
}}>


                {

                  m.role==="user"

                  ?

                  m.text

                  :

                  <ReactMarkdown>

                    {m.text}

                  </ReactMarkdown>

                }


                </div>





                {


                m.role==="bot"

                &&

                m.sources

                &&

                m.sources.length>0

                &&


                (

                  <div

                    style={{

                      marginTop:"15px",

                      paddingTop:"10px",

                      borderTop:"1px solid #ddd",

                      fontSize:"13px"

                    }}

                  >


                    <b>

                      📚 Sumber Referensi

                    </b>



                    {

Object.entries(

  m.sources.reduce(

    (acc,source)=>{


      if(!acc[source.filename]){

        acc[source.filename] = [];

      }


      acc[source.filename].push(source.page);


      return acc;


    },

    {}

  )

)

.map(([filename,pages])=>(


<div

key={filename}

style={{

marginTop:"8px"

}}

>

📄 {filename}

<br/>

Halaman relevan:

{

[...new Set(pages)]

.slice(0,5)

.join(", ")

}


</div>


))

}



                  </div>


                )


                }



              </div>


            </div>


          ))

        }



        {
loading &&

(

<div

style={{

padding:"10px",

color:"#64748b",

fontStyle:"italic"

}}

>

AI sedang mencari informasi dokumen       

<span className="dot dot1">
●
</span>

<span className="dot dot2">
●
</span>

<span className="dot dot3">
●
</span>

</div>

)

}



        </div>





        {/* INPUT AREA */}

        <div

          style={{

            display:"flex",

            gap:"10px",

            padding:"15px",

            borderTop:"1px solid #ddd"

          }}

        >


          <input

            value={input}


            onChange={(e)=>

              setInput(e.target.value)

            }


            onKeyDown={(e)=>

              e.key==="Enter"

              &&

              sendMessage()

            }


            placeholder="Tanyakan informasi perdagangan..."


            style={{

flex:1,

padding:"14px 16px",

borderRadius:"12px",

border:"1px solid #cbd5e1",

fontSize:"14px",

outline:"none"

}}

          />



          <label

style={{

background:"#eef2f756",

color:"#004a8f",

border:"1px solid #004a8f",

padding:"0 18px",

borderRadius:"12px",

cursor:"pointer",

display:"flex",

alignItems:"center",

fontWeight:"600"

}}

>

{
uploading

?

"⏳ Unggah..."

:

"📄 Unggah Dokumen"

}


<input

type="file"

accept=".pdf"

onChange={uploadDocument}

style={{

display:"none"

}}

/>


</label>



<button

onClick={sendMessage}

style={{

background:"#004a8f",

color:"white",

border:"none",

padding:"0 25px",

borderRadius:"12px",

cursor:"pointer",

fontWeight:"600"

}}

>

Kirim

</button>



        </div>


      </div>


    </div>


  );

}