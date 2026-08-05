import fitz

pdf_path = "backend/docs/Nigeria_Martel Tekstil Kain Ankara.pdf"

doc = fitz.open(pdf_path)

print("Jumlah halaman:", len(doc))

for i, page in enumerate(doc):

    print(
        "Halaman",
        i+1,
        "| text:",
        len(page.get_text()),
        "| gambar:",
        len(page.get_images())
    )

    if i == 4:
        break