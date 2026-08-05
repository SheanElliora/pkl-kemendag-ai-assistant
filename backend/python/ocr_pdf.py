import sys
from pdf2image import convert_from_path
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang="en")

pdf_path = sys.argv[1]

pages = convert_from_path(pdf_path)

hasil_text = []

for page in pages:

    results = ocr.ocr(page, cls=True)

    if results:

        for line in results[0]:

            hasil_text.append(line[1][0])

print("\n".join(hasil_text))