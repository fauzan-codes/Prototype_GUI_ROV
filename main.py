from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
import asyncio
import random
import cv2
import threading



# ============================== CAMERAS ==============================
cameras = {
    0: cv2.VideoCapture(0),
    1: cv2.VideoCapture(1)
}

for cam in cameras.values():
    cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)




# ============================== CONFIG ==============================
TITLE_TAG = "SEADIVER TEAM"

TITLE = "ROV GROUND CONTROL STATION"
SUB_TITLE = "REMOTELY OPERATED VEHICLE  ·  MONITORING & CONTROL"
UNIVERSITY = "UNIVERSITAS NEGERI SURABAYA"
TEAM_NAME = "SEADIVER TEAM"

DANGER_DEPTH = 200  #cm
POOL_DEPTH = 300    #cm

TRAJECTORY_X = 5000 #cm
TRAJECTORY_Y = 5000 #cm


app = FastAPI()
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============================== ROOT ==============================
@app.get("/")
def index():
    return FileResponse("static/index.html")

@app.get("/config")
def get_config():
    return {
        "title_tag": TITLE_TAG,
        "title": TITLE,
        "subtitle": SUB_TITLE,
        "university": UNIVERSITY,
        "team": TEAM_NAME
    }


# ============================== CAMERA SYSTEM ==============================
class Camera:
    def __init__(self, src):
        self.src = src
        self.cap = None
        self.lock = threading.Lock()

    def open(self):
        with self.lock:
            if self.cap is None:
                self.cap = cv2.VideoCapture(self.src)

    def read(self):
        if self.cap is None or not self.cap.isOpened():
            return None

        success, frame = self.cap.read()
        if not success:
            return None

        frame = cv2.resize(frame, (640, 480))
        return frame

    def release(self):
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None


# INIT 2 CAMERA
cams = {
    0: Camera(0),  # Front
    1: Camera(1)   # Bottom
}


def generate_frames(cam_id: int):
    cam = cams.get(cam_id)

    if cam is None:
        return

    cam.open()

    error_logged = False

    while True:
        frame = cam.read()

        if frame is None:
            if not error_logged:
                print(f"[ERROR] Camera {cam_id} not available")
                error_logged = True

            break

        error_logged = False

        _, buffer = cv2.imencode(
            '.jpg', frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        )

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' +
            buffer.tobytes() +
            b'\r\n'
        )


@app.get("/camera/{cam_id}")
def video(cam_id: int):
    if cam_id not in cams:
        return {"error": "Camera not found"}

    return StreamingResponse(
        generate_frames(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ============================== WEBSOCKET ==============================
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    while True:
        data = {
            "setpoint": random.randint(0, 300),
            "depth": random.randint(0, 300),
            "heading": random.randint(0, 360),
            "pressure": random.randint(900, 1100),
            "pwm": [random.randint(1000, 2000) for _ in range(6)]
        }

        await ws.send_json(data)
        await asyncio.sleep(0.1)