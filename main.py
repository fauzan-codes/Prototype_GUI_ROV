from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from starlette.websockets import WebSocketDisconnect
from pyzbar.pyzbar import decode as qr_decode
from collections import deque
from datetime import datetime
from pathlib import Path
import asyncio
import random
import threading
import time
import json
import cv2
import re
import os


qr_result = {
    "data": None,
    "last_scan_time": 0,
    "last_log_time": 0, 
    "last_raw": None,
    "last_side": None,
    "updated": False,

    "last_invalid_time": 0,
    "last_invalid_raw": None,

    "source": None 
}

latest_frames = {
    0: None,
    1: None
}
frame_lock = threading.Lock()

log_buffer = deque(maxlen=100)


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
shutdown_event = threading.Event()
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/static", StaticFiles(directory="static"), name="static")

# folder
CAPTURE_DIR = Path("data/capture")
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)


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

        if frame.shape[1] != 640:
            frame = cv2.resize(frame, (640, 480))
        return frame
    
    def capture(self):
        frame = self.read()
        if frame is None:
            return None
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
qr_thread = None

def qr_worker():
    print("[QR] Worker started")

    while not shutdown_event.is_set():
        try:
            with frame_lock:
                frames = {
                    cam_id: frame.copy()
                    for cam_id, frame in latest_frames.items()
                    if frame is not None
                }

            if not frames:
                time.sleep(0.2)
                continue

            now = time.time()

            if now - qr_result["last_scan_time"] < 2:
                time.sleep(0.1)
                continue

            qr_result["last_scan_time"] = now

            # prioritas camera 1
            for cam_id in sorted(frames.keys()):
                frame = frames[cam_id]

                small = cv2.resize(frame, (320, 240))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                codes = qr_decode(gray)

                for code in codes:
                    raw = code.data.decode('utf-8', errors='ignore').strip()
                    if not raw:
                        continue

                    side = extract_side(raw)

                    if side is None:
                        last_invalid_raw = qr_result.get("last_invalid_raw")
                        last_invalid_time = qr_result.get("last_invalid_time", 0)

                        if raw != last_invalid_raw or (now - last_invalid_time > 120):
                            add_log(f"[QR][CAM {cam_id}] INVALID | {safe_text(raw)}")
                            qr_result["last_invalid_raw"] = raw
                            qr_result["last_invalid_time"] = now
                        continue

                    # prioritas logic
                    current_source = qr_result.get("source")

                    allow_update = False

                    if cam_id == 0:
                        allow_update = True

                    elif cam_id == 1:
                        if current_source != 0:
                            allow_update = True

                    if not allow_update:
                        continue

                    qr_result["data"] = {
                        "side": side,
                        "raw": raw,
                        "cam": cam_id
                    }

                    qr_result["updated"] = True
                    qr_result["source"] = cam_id

                    last_side = qr_result.get("last_side")
                    last_log_time = qr_result["last_log_time"]

                    if last_side != side:
                        add_log(f"[QR][CAM {cam_id}] DETECTED {side} | {safe_text(raw)}")
                        qr_result["last_side"] = side
                        qr_result["last_raw"] = raw
                        qr_result["last_log_time"] = now

                    elif now - last_log_time > 120:
                        add_log(f"[QR][CAM {cam_id}] DETECTED {side} | {safe_text(raw)}")
                        qr_result["last_log_time"] = now

        except Exception as e:
            print("[QR WORKER ERROR]", e)

        time.sleep(0.1)


def generate_frames(cam_id: int):
    cam = cams.get(cam_id)

    if cam is None:
        return

    cam.open()
    error_logged = False

    try:
        while not shutdown_event.is_set():
            start = time.time()
            frame = cam.read()

            with frame_lock:
                latest_frames[cam_id] = frame

            if frame is None:
                if not error_logged:
                    print(f"[ERROR] Camera {cam_id} not available")
                    error_logged = True
                break
            error_logged = False

            if frame is None:
                if not error_logged:
                    print(f"[ERROR] Camera {cam_id} not available")
                    error_logged = True

                break

            error_logged = False
            try:
                _, buffer = cv2.imencode(
                    '.jpg',
                    frame,
                    [int(cv2.IMWRITE_JPEG_QUALITY), 70]
                )

                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' +
                    buffer.tobytes() +
                    b'\r\n'
                )

                elapsed = time.time() - start
                delay = max(0, 0.05 - elapsed)
                time.sleep(delay)

            except Exception:
                print(f"[INFO] Client disconnected cam {cam_id}")
                break

    
    finally:
        print(f"[INFO] Releasing camera {cam_id}")
        cam.release()


def safe_text(text, max_len=25):
    return text[:max_len] + "..." if len(text) > max_len else text

def extract_side(raw):
    u = raw.upper().strip()

    valid_map = {
        "A": "A",
        "B": "B",
        "C": "C",
        "D": "D",
        "SIDE A": "A",
        "SIDE B": "B",
        "SIDE C": "C",
        "SIDE D": "D",
        "SIDE-A": "A",
        "SIDE-B": "B",
        "SIDE-C": "C",
        "SIDE-D": "D",
        "SIDE_A": "A",
        "SIDE_B": "B",
        "SIDE_C": "C",
        "SIDE_D": "D",
        "SISI A": "A",
        "SISI B": "B",
        "SISI C": "C",
        "SISI D": "D",
        "SISI-A": "A",
        "SISI-B": "B",
        "SISI-C": "C",
        "SISI-D": "D",
        "SISI_A": "A",
        "SISI_B": "B",
        "SISI_C": "C",
        "SISI_D": "D",
    }

    if u in valid_map:
        return valid_map[u]

    match = re.search(r'\b(A|B|C|D)\b', u)
    if match:
        return match.group(1)

    return None


@app.get("/camera/{cam_id}")
def video(cam_id: int):
    if cam_id not in cams:
        return {"error": "Camera not found"}

    return StreamingResponse(
        generate_frames(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.on_event("startup")
def start_qr_worker():
    global qr_thread
    qr_thread = threading.Thread(target=qr_worker, daemon=True)
    qr_thread.start()


@app.post("/capture/{cam_id}")
def capture_camera(cam_id: int):
    cam = cams.get(cam_id)

    if cam is None:
        return {
            "success": False,
            "message": "Camera not found"
        }

    cam.open()
    frame = cam.capture()
    if frame is None:
        return {
            "success": False,
            "message": "Failed to capture image"
        }

    date_str = datetime.now().strftime("%d-%m-%Y")
    existing_files = list(
        CAPTURE_DIR.glob(f"capture_cam{cam_id + 1}_{date_str}_*.jpg")
    )

    next_number = len(existing_files) + 1
    filename = (
        f"capture_cam{cam_id + 1}_"
        f"{date_str}_"
        f"{next_number:03d}.jpg"
    )

    save_path = CAPTURE_DIR / filename
    cv2.imwrite(str(save_path), frame)
    add_log(f"[CAPTURE] Saved {filename}")

    return {
        "success": True,
        "filename": filename,
        "path": str(save_path)
    }


# ============================== WEBSOCKET ==============================
def add_log(message):
    now = datetime.now()
    timestamp = now.strftime("%H:%M:%S")
    final_log = f"[{timestamp}] {message}"
    print(final_log)
    log_buffer.append(final_log)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            msg = None

            try:
                recv = await asyncio.wait_for(ws.receive_text(), timeout=0.01)
                msg = json.loads(recv)
            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                print("[WS] Client disconnected")
                break

            if msg:
                if msg.get("type") == "pid":
                    add_log(f"[PID] Kp={msg.get('kp')} Ki={msg.get('ki')} Kd={msg.get('kd')}")

                elif msg.get("type") == "log":
                    add_log(msg.get("message"))

            data = {
                "setpoint": random.randint(0, 300),
                "depth": random.randint(0, 300),
                "heading": random.randint(0, 360),
                "pressure": random.randint(900, 1100),
                "pwm": [random.randint(1000, 2000) for _ in range(6)]
            }

            log = log_buffer.popleft() if log_buffer else None

            now = datetime.now()
            timestamp = time.time()

            qr_payload = None
            if qr_result["updated"]:
                qr_payload = qr_result["data"]
                qr_result["updated"] = False

            await ws.send_json({
                "telemetry": data,
                "log": log,
                "datetime": now.strftime("%A, %d %b %Y - %H:%M:%S"),
                "timestamp": timestamp,
                "qr": qr_payload
            })

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        print("[WS] Disconnected safely")


# ============================== SHUTDOWN ==============================
@app.on_event("shutdown")
def shutdown_server():

    print("[INFO] Shutdown initiated")

    shutdown_event.set()

    for cam_id, cam in cams.items():
        print(f"[INFO] Force release camera {cam_id}")
        cam.release()

    print("[INFO] All cameras released")