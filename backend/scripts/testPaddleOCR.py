from paddleocr import PaddleOCR

ocr = PaddleOCR(
    lang="en"
)

result = ocr.predict(
    "test.png"
)

print(result)