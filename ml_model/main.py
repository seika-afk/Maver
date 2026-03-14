

# app.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from tensorflow import keras
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

print("-------------API STARTED--------------")

# ---------------- LOAD MODEL ----------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.keras"

model = keras.models.load_model(MODEL_PATH)

# ---------------- FASTAPI ----------------

app = FastAPI(title="Math Solver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- LABELS ----------------

labels = {
    0:'0',1:'1',2:'2',3:'3',4:'4',
    5:'5',6:'6',7:'7',8:'8',9:'9',
    10:'+',11:'/',12:'*',13:'-'
}

class ImageData(BaseModel):
    dataURL: str


# ---------------- SAVE IMAGE ----------------

def img_save(data_url, save_path="image.png"):
    try:
        header, encoded = data_url.split(",",1)
        data = base64.b64decode(encoded)

        with open(save_path,"wb") as f:
            f.write(data)

        return save_path

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Data URL: {e}")


# ---------------- ROI PREPROCESS ----------------

def preprocess_roi(roi):

    h, w = roi.shape

    size = max(h, w)

    padded = np.zeros((size, size), dtype=np.uint8)

    x_offset = (size - w) // 2
    y_offset = (size - h) // 2

    padded[y_offset:y_offset+h, x_offset:x_offset+w] = roi

    roi = cv2.resize(padded,(32,32))

    roi = roi.astype("float32") / 255.0

    roi = np.expand_dims(roi, axis=-1)

    return roi


# ---------------- TRANSPARENT IMAGE FIX ----------------

def load_image_fix_transparency(image_path):

    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)

    if img is None:
        raise Exception("Image could not be read")

    # if RGBA
    if len(img.shape) == 3 and img.shape[2] == 4:

        alpha = img[:, :, 3]
        rgb = img[:, :, :3]

        white_bg = np.ones_like(rgb, dtype=np.uint8) * 255

        alpha = alpha[:, :, None] / 255.0

        img = rgb * alpha + white_bg * (1 - alpha)
        img = img.astype(np.uint8)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    return gray


# ---------------- SOLVER ----------------

def provide_solution(image_path, confidence_threshold=0.7):

    image = load_image_fix_transparency(image_path)

    cv2.imwrite("debug_input.png", image)

    # blur for better threshold
    blur = cv2.GaussianBlur(image,(5,5),0)

    _, binary = cv2.threshold(
        blur,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    cv2.imwrite("debug_binary.png", binary)

    contours,_ = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    contours = [c for c in contours if cv2.contourArea(c) > 20]

    print("Contours detected:", len(contours))

    if len(contours) == 0:
        return "",None

    contours = sorted(contours,key=lambda c: cv2.boundingRect(c)[0])

    debug = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)

    rois = []

    for c in contours:

        x,y,w,h = cv2.boundingRect(c)

        cv2.rectangle(debug,(x,y),(x+w,y+h),(0,255,0),2)

        pad = 5

        roi = binary[
            max(0,y-pad):y+h+pad,
            max(0,x-pad):x+w+pad
        ]

        roi = preprocess_roi(roi)

        rois.append(roi)

    cv2.imwrite("debug_boxes.png", debug)

    rois = np.array(rois)

    preds = model.predict(rois, verbose=0)

    pred_indices = np.argmax(preds,axis=1)
    confidences = np.max(preds,axis=1)

    pred_labels = []

    for idx,conf in zip(pred_indices,confidences):

        if conf < confidence_threshold:
            pred_labels.append(f"[?{labels[idx]}]")
        else:
            pred_labels.append(labels[idx])

    equation = "".join([p.strip("[]?") for p in pred_labels])

    try:
        value = eval(equation)
    except:
        value = None

    return equation,value


# ---------------- API ----------------

@app.post("/solve")
def solve_math_image(img: ImageData):

    print("-------------CALL RECEIVED--------------")

    path = img_save(img.dataURL)

    eqn,value = provide_solution(path)

    return {
        "equation": eqn,
        "value": value
    }


