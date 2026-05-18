from fastapi import FastAPI, WebSocket, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse
from starlette.websockets import WebSocketDisconnect

from pyzbar.pyzbar import decode as qr_decode

from collections import deque
from datetime import datetime
from pathlib import Path

import serial.tools.list_ports
import serial

import asyncio
import threading
import random
import json
import time
import cv2
import re


# =============== APP ===============
app = FastAPI()

app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/static", StaticFiles(directory="static"), name="static")

shutdown_event = threading.Event()


# =============== SESION STATE ===============
session_state = {
    # BASIC
    "mode": "KEYBOARD",

    "serial": {
        "connected": False,
        "port": None
    },

    "camera": {
        "1": False,
        "2": False
    },

    # PID
    "pid": {
        "kp": 0.0,
        "ki": 0.0,
        "kd": 0.0
    },

    # TRAJECTORY
    "trajectory": [],

    # QR
    "qr": {
        "main": {
            "side": "WAITING",
            "raw": "WAITING SCAN...",
            "time": "--"
        },
        "history": []
    },

    # LOG
    "logs": [],

    # RECORD
    "record": {
        "isRecording": False,
        "hasRecording": False,
        "replayPlaying": False
    },

    # ADVANCE
    "advanced": {
        "autoSnapshot": False,
        "emergency": False
    }
}


# =============== CONFIG ===============
TITLE_TAG = "SEADIVER TEAM"

TITLE = "ROV GROUND CONTROL STATION"
SUB_TITLE = "REMOTELY OPERATED VEHICLE · MONITORING & CONTROL"
UNIVERSITY = "UNIVERSITAS NEGERI SURABAYA"
TEAM_NAME = "SEADIVER TEAM"

POOL_DEPTH = 300
DANGER_DEPTH = 180
SETPOINT_DEPTH = 150

TRAJECTORY_X = 500
TRAJECTORY_Y = 500

VALID_QR = ["A", "B", "C", "D"]
QR_SCAN_COOLDOWN = 1.5
QR_PUBLISH_INTERVAL = 120


# =============== ROOT ===============
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
        "team": TEAM_NAME,

        "pool_depth": POOL_DEPTH,
        "danger_depth": DANGER_DEPTH,
        "setpoint_depth": SETPOINT_DEPTH,

        "traj_x": TRAJECTORY_X,
        "traj_y": TRAJECTORY_Y
    }


# =============== SESION API ===============
@app.get("/session")
def get_session():
    return session_state


@app.post("/session")
async def update_session(req: Request):
    data = await req.json()
    merge_dict(session_state, data)
    return {
        "success": True
    }


def merge_dict(target, source):
    for key, value in source.items():
        if (
            key in target
            and isinstance(target[key], dict)
            and isinstance(value, dict)
        ):
            merge_dict(target[key], value)
        else:
            target[key] = value


# =============== LOG SYSTEM ===============
log_buffer = deque(maxlen=300)

def add_log(message):
    now = datetime.now()
    timestamp = now.strftime("%H:%M:%S")
    final_log = f"[{timestamp}] {message}"
    print(final_log)
    session_state["logs"].append(final_log)
    log_buffer.append(final_log)

    if len(session_state["logs"]) > 300:
        session_state["logs"].pop(0)

@app.post("/log")
async def create_log(req: Request):
    data = await req.json()
    message = data.get("message", "").strip()

    if not message:
        return {
            "success": False
        }

    add_log(message)
    return {
        "success": True
    }

@app.post("/log/clear")
def clear_logs():
    session_state["logs"] = []
    log_buffer.clear()

    print("[INFO] CLEARED")
    return {
        "success": True
    }


# =============== SERIAL SYSTEM ===============
serial_conn = None
serial_running = False

def list_serial_ports():
    ports = serial.tools.list_ports.comports()
    return [p.device for p in ports]

def send_serial(data: str):
    global serial_conn

    try:
        if serial_conn and serial_conn.is_open:
            serial_conn.write((data + "\n").encode())
            return True

    except Exception as e:
        add_log(f"[SERIAL] SEND FAILED {e}")

    return False


@app.get("/serial/ports")
def get_ports():
    return {
        "ports": list_serial_ports()
    }


@app.post("/serial/connect")
async def serial_connect(req: Request):
    global serial_conn
    global serial_running
    data = await req.json()
    port = data.get("port")

    if not port:
        return {
            "success": False
        }

    try:

        serial_conn = serial.Serial(
            port,
            115200,
            timeout=1
        )

        serial_running = True
        session_state["serial"]["connected"] = True
        session_state["serial"]["port"] = port

        add_log(f"[SERIAL] CONNECTED {port}")
        return {
            "success": True
        }

    except Exception as e:
        add_log(f"[SERIAL] FAILED {e}")
        return {
            "success": False
        }


@app.post("/serial/disconnect")
def serial_disconnect():
    global serial_conn
    global serial_running
    serial_running = False

    if serial_conn:
        serial_conn.close()

    serial_conn = None
    session_state["serial"]["connected"] = False
    session_state["serial"]["port"] = None

    add_log("[SERIAL] DISCONNECTED")
    return {
        "success": True
    }


# =============== CAMERA SYSTEM ===============
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
        if self.cap is None:
            return None

        ok, frame = self.cap.read()

        if not ok:
            return None

        frame = cv2.resize(frame, (640, 480))
        return frame

    def release(self):
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None


cams = {
    0: Camera(0),
    1: Camera(1)
}


@app.get("/camera/{cam_id}")
def stream_camera(cam_id: int):
    cam = cams.get(cam_id)

    if cam is None:
        return {"error": "Camera not found"}

    cam.open()

    session_state["camera"][str(cam_id + 1)] = True
    add_log(f"[CAM] CAMERA {cam_id + 1} ONLINE")

    async def generate():
        try:
            while not shutdown_event.is_set():
                frame = cam.read()
                
                if frame is None:
                    await asyncio.sleep(0.1)
                    continue

                frame = process_qr(frame, cam_id)
                ok, buffer = cv2.imencode(".jpg", frame)

                if not ok:
                    await asyncio.sleep(0.1)
                    continue

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + buffer.tobytes()
                    + b"\r\n"
                )

                await asyncio.sleep(0.03)

        except asyncio.CancelledError:
            print(f"[CAM] STREAM {cam_id+1} CANCELLED")

        finally:
            cam.release()
            session_state["camera"][str(cam_id + 1)] = False
            add_log(f"[CAM] CAMERA {cam_id + 1} OFFLINE")

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.post("/camera/{cam_id}/off")
def stop_camera(cam_id: int):
    cam = cams.get(cam_id)
    if cam:
        cam.release()

    session_state["camera"][str(cam_id + 1)] = False
    add_log(f"[CAM] CAMERA {cam_id + 1} OFFLINE")
    return {
        "success": True
    }


# =============== CAPTURE ===============
CAPTURE_DIR = Path("data/capture")
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/capture/{cam_id}")
def capture_camera(cam_id: int):
    cam = cams.get(cam_id)
    if cam is None:

        return {
            "success": False
        }

    cam.open()
    frame = cam.read()
    if frame is None:

        return {
            "success": False
        }

    filename = datetime.now().strftime(
        f"cam{cam_id+1}_%d%m%Y_%H%M%S.jpg"
    )

    save_path = CAPTURE_DIR / filename
    cv2.imwrite(str(save_path), frame)
    add_log(f"[CAPTURE] {filename}")
    return {
        "success": True
    }


# =============== WEBSOCKET ===============
robot_pos = {
    "x": TRAJECTORY_X // 2,
    "y": TRAJECTORY_Y // 2
}


def update_robot():
    robot_pos["x"] += random.randint(-20, 20)
    robot_pos["y"] += random.randint(-20, 20)

    robot_pos["x"] = max(
        0,
        min(TRAJECTORY_X, robot_pos["x"])
    )

    robot_pos["y"] = max(
        0,
        min(TRAJECTORY_Y, robot_pos["y"])
    )

    point = {
        "x": robot_pos["x"],
        "y": robot_pos["y"]
    }

    session_state["trajectory"].append(point)
    if len(session_state["trajectory"]) > 500:
        session_state["trajectory"].pop(0)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    add_log("[WS] CONNECTED")
    try:
        while True:
            update_robot()
            telemetry = {
                "depth": random.randint(0, 300),
                "heading": random.randint(0, 360),
                "pressure": random.randint(900, 1100),

                "pwm": [
                    random.randint(1000, 2000)
                    for _ in range(6)
                ]
            }

            payload = {
                "telemetry": telemetry,
                "trajectory": session_state["trajectory"][-1],

                "datetime":
                    datetime.now().strftime(
                        "%A, %d %b %Y - %H:%M:%S"
                    ),

                "timestamp": time.time(),
                "session": session_state
            }

            await ws.send_json(payload)
            await asyncio.sleep(0.3)

    except WebSocketDisconnect:
        add_log("[WS] DISCONNECTED")


# =============== QR SYSTEM ===============
qr_state = {
    "last_scan_time": {},
    "last_publish_time": {},
    "last_main_result": None,
    "last_invalid_raw": None
}


def process_qr(frame, cam_id):
    now = time.time()
    try:

        last_scan = qr_state["last_scan_time"].get(cam_id, 0)
        if (now - last_scan) < QR_SCAN_COOLDOWN:
            return frame

        qr_state["last_scan_time"][cam_id] = now
        decoded = qr_decode(frame)

        if not decoded:
            return frame

        for obj in decoded:

            raw = (
                obj.data
                .decode("utf-8")
                .strip()
                .upper()
            )

            if raw not in VALID_QR:
                if raw != qr_state.get("last_invalid_raw"):
                    qr_state["last_invalid_raw"] = raw
                    add_log(f"[QR] INVALID QRCODE: {short_text(raw)}")
                continue

            current_time = datetime.now().strftime("%H:%M:%S")
            points = obj.polygon

            if len(points) >= 4:
                for i in range(len(points)):
                    p1 = points[i]
                    p2 = points[(i + 1) % len(points)]

                    cv2.line(
                        frame,
                        (p1.x, p1.y),
                        (p2.x, p2.y),
                        (0, 255, 0),
                        3
                    )

            cv2.putText(
                frame,
                f"SIDE {raw}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                3
            )

            history_item = {
                "side": raw,
                "time": current_time
            }

            session_state["qr"]["history"].insert(0, history_item)
            session_state["qr"]["history"] = (session_state["qr"]["history"][:30])
            last_main = qr_state["last_main_result"]
            last_publish = qr_state["last_publish_time"].get(raw, 0)

            is_different = raw != last_main
            cooldown_passed = (now - last_publish) >= QR_PUBLISH_INTERVAL
            should_publish = (is_different or cooldown_passed)

            if should_publish:
                qr_state["last_main_result"] = raw
                qr_state["last_publish_time"][raw] = now

                session_state["qr"]["main"] = {
                    "side": raw,
                    "raw": f"CAM {cam_id+1} | SIDE {short_text(raw)}",
                    "time": current_time
                }

                add_log(f"[QR] SIDE {raw} DETECTED FROM CAM {cam_id+1}")
                send_serial(f"QR:{raw}")
            break

    except Exception as e:
        print("[QR ERROR]", e)

    return frame

def short_text(text, max_len=10):
    if len(text) > max_len:
        return text[:max_len] + "..."
    return text

@app.post("/qr/clear")
def clear_qr_history():
    session_state["qr"]["history"] = []
    session_state["qr"]["main"] = {
        "side": "WAITING",
        "raw": "WAITING SCAN...",
        "time": "--"
    }

    qr_state["last_main_result"] = None
    add_log("[QR] HISTORY CLEARED")
    return {
        "success": True
    }



# =============== RESET SESION ===============
@app.post("/session/reset")
def reset_session():
    global qr_state

    session_state["trajectory"] = []
    session_state["logs"] = []

    session_state["qr"] = {
        "main": {
            "side": "WAITING",
            "raw": "WAITING SCAN...",
            "time": "--"
        },
        "history": []
    }

    session_state["record"] = {
        "isRecording": False,
        "hasRecording": False,
        "replayPlaying": False
    }

    session_state["camera"] = {
        "1": False,
        "2": False
    }

    qr_state = {
        "last_scan_time": 0,
        "last_publish_time": {},
        "last_main_result": None
    }

    add_log("[SYSTEM] SESSION RESET")

    return {
        "success": True
    }


# =============== SHUTDOWN ===============
@app.on_event("shutdown")
def shutdown_server():
    print("[SERVER] SHUTDOWN")

    for cam in cams.values():
        cam.release()

    shutdown_event.set()