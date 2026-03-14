from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from tensorflow import keras
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import pickle
import ast
import operator as op
import pytesseract

print("-------------API-------------------------------------STARTED--------------")
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.h5"
ENCODER_PATH = BASE_DIR / "label_encoder.pkl"
model = keras.models.load_model(MODEL_PATH, compile=False)


with open(ENCODER_PATH, "rb") as f:
    le = pickle.load(f)

labels = {i: label for i, label in enumerate(le.classes_)}

print("Label mapping:", labels)

symbol_map = {
    "add": "+",
    "sub": "-",
    "mul": "*",
    "div": "/"
}


app = FastAPI(title="Math Solver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageData(BaseModel):
    dataURL: str



operators = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv,
}

def safe_eval(expr):

    def eval_node(node):

        if isinstance(node, ast.Constant):
            return node.value

        elif isinstance(node, ast.BinOp):
            return operators[type(node.op)](
                eval_node(node.left),
                eval_node(node.right)
            )

        else:
            raise TypeError(node)

    node = ast.parse(expr, mode="eval").body
    return eval_node(node)


def img_save(data_url, save_path="image.png"):

    try:
        header, encoded = data_url.split(",",1)
        data = base64.b64decode(encoded)

        with open(save_path,"wb") as f:
            f.write(data)

        return save_path

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Data URL: {e}")


def preprocess_roi(roi):

    h, w = roi.shape
    size = max(h, w)

    padded = np.zeros((size, size), dtype=np.uint8)

    x_offset = (size - w) // 2
    y_offset = (size - h) // 2

    padded[y_offset:y_offset+h, x_offset:x_offset+w] = roi

    roi = cv2.resize(padded, (32, 32))

    roi = cv2.bitwise_not(roi)

    roi = roi.astype("float32") / 255.0

    roi = np.expand_dims(roi, axis=-1)

    return roi

def ocr_fallback(image):

    text = pytesseract.image_to_string(
        image,
        config="--psm 7 -c tessedit_char_whitelist=0123456789+-*/"
    )

    text = text.strip().replace(" ", "")

    try:
        value = safe_eval(text)
    except:
        value = None

    return text, value



def provide_solution(image_path, confidence_threshold=0.7):

    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    blur = cv2.GaussianBlur(image,(5,5),0)

    _, binary = cv2.threshold(
        blur,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    contours,_ = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    contours = [c for c in contours if cv2.contourArea(c) > 20]

    print("Contours detected:", len(contours))

    if len(contours) == 0:
        return ocr_fallback(image)

    contours = sorted(contours,key=lambda c: cv2.boundingRect(c)[0])

    rois = []

    for c in contours:

        x,y,w,h = cv2.boundingRect(c)

        pad = 5

        roi = binary[
            max(0,y-pad):y+h+pad,
            max(0,x-pad):x+w+pad
        ]

        roi = preprocess_roi(roi)

        rois.append(roi)

    rois = np.array(rois)

    preds = model.predict(rois, verbose=0)

    pred_indices = np.argmax(preds,axis=1)
    confidences = np.max(preds,axis=1)

    pred_labels = []

    for i,(idx,conf) in enumerate(zip(pred_indices,confidences)):

        raw_symbol = str(labels[idx])

        symbol = symbol_map.get(raw_symbol, raw_symbol)

        print(f"ROI {i} -> {symbol} ({conf:.2f})")

        if conf < confidence_threshold:
            print("Low confidence -> OCR fallback")
            return ocr_fallback(image)

        pred_labels.append(symbol)

    equation = "".join(pred_labels)

    try:
        value = safe_eval(equation)
    except:
        print("Evaluation failed -> OCR fallback")
        return ocr_fallback(image)

    return equation,value



@app.post("/solve")
def solve_math_image(img: ImageData):

    print("-------------CALL RECEIVED--------------")

    path = img_save(img.dataURL)

    eqn,value = provide_solution(path)

    return {
        "equation": eqn,
        "value": value
    }



def test_local_image():

    print("\n------ LOCAL TEST ------")

    image_path = "image.png"

    eqn, value = provide_solution(image_path)

    print("Detected Equation:", eqn)
    print("Result:", value)


#//////// MAIN FUNCTION : TO TEST THIS SHI
if __name__ == "__main__":

    test_local_image()

