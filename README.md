# 📘 ROV Ground Control Station (GCS)
### Web-Based Monitoring & Control System (FastAPI + WebSocket)

---

# 🧭 0. Persiapan Awal (REAL WORLD SETUP)

## 🪑 Setup Meja Kerja (GSC_ROV_Competition - Web Version)

```text
[ Laptop (Browser UI) ]
        │
     (LAN Cable / Switch)
        │
[ Jetson / Mini PC di ROV (SERVER) ]
        │
 ├── Camera Front
 ├── Camera Bottom
 ├── Pixhawk (MAVLink / Serial)
 ├── Sensor Depth
 ├── IMU (Optional)
 └── Power System
```

---

## ✅ Checklist Hardware

- Laptop (Ground Control Station - Browser)
- Jetson / Mini PC (ROV - Server)
- 2 Kamera (Front & Bottom)
- Pixhawk (WAJIB untuk kontrol)
- Sensor Depth
- Kabel LAN / Switch / Router
- Joystick (opsional)

---

# 💻 1. Setup Software

## 🧰 Tools

- Python 3.10+
- VSCode / PyCharm

---

## 📁 Buat Project Folder

```
mkdir GCS_ROV_Web
cd GCS_ROV_Web
```

---

## 🐍 Virtual Environment

```
python -m venv venv
```

Activate:

```
venv\Scripts\activate
```

---

## 📦 Install Dependencies

```
pip install fastapi uvicorn opencv-python numpy websockets
```

(opsional)
```
pip install pymavlink
```

---

# 🧱 2. Struktur Project

```
GCS_ROV_Web/
│
├── main.py                # FastAPI server
│
├── core/
│   ├── camera.py         # Handle kamera
│   ├── stream.py         # MJPEG streaming
│   ├── websocket.py      # Realtime data
│   └── pixhawk.py        # MAVLink communication
│
├── vision/
│   └── qr_detector.py
│
├── static/
│   ├── index.html        # UI dashboard
│   ├── style.css
│   └── app.js
│
├── assets/
│   └── rov.png
│
└── logs/
```

---

# 🧩 3. Fitur Utama

## 🎥 Camera System
- Front Camera (MJPEG Stream)
- Bottom Camera (opsional)

## 🔳 QR Detection
- Posisi: A / B / C / D
- Status: Valid / Invalid

## 📏 Altitude / Depth
- Data realtime dari sensor

## 🧾 Informasi Umum
- Waktu realtime
- Status koneksi

## 🤖 Visual ROV
- Axis / indikator arah

## 🗺️ Trajectory
- Path tracking (Canvas)

## 📸 Logging
- Data logging (CSV / JSON)

## 🚨 Alarm
- Depth warning
- Error system

## 🎮 Mode Control
- Manual (keyboard / joystick browser)
- Autonomous (opsional)

---

# 🪜 4. Step-by-Step Development

---

## STEP 1 – FastAPI Basic Server

```
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "server running"}
```

Run:

```
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## STEP 2 – MJPEG Camera Stream (WAJIB)

```
from fastapi.responses import StreamingResponse
import cv2

cap = cv2.VideoCapture(0)

def generate_frames():
    while True:
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.resize(frame, (640, 360))

        _, buffer = cv2.imencode('.jpg', frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), 70])

        frame = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' +
               frame + b'\r\n')

@app.get("/video")
def video():
    return StreamingResponse(generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame")
```

---

## STEP 3 – WebSocket Realtime Data

```
from fastapi import WebSocket
import asyncio

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    while True:
        data = {
            "depth": 120,
            "qr": "A",
            "status": "connected"
        }
        await ws.send_json(data)
        await asyncio.sleep(0.05)
```

---

## STEP 4 – Frontend UI (Browser)

### index.html

```
<img src="http://IP_JETSON:8000/video">
```

### WebSocket JS

```
const ws = new WebSocket("ws://IP_JETSON:8000/ws");

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
};
```

---

## STEP 5 – QR Detection

```
detector = cv2.QRCodeDetector()
data, bbox, _ = detector.detectAndDecode(frame)
```

---

## STEP 6 – Pixhawk Communication

```
from pymavlink import mavutil

master = mavutil.mavlink_connection('/dev/ttyUSB0', baud=115200)
```

---

## STEP 7 – Control dari Browser

```
ws.send(JSON.stringify({
    type: "control",
    throttle: 0.5,
    yaw: 10
}));
```

---

## STEP 8 – Logging

```
import csv
```

---

## STEP 9 – Alarm System

```
if depth > threshold:
    trigger_alarm()
```

---

# 🔄 5. Alur Program

```
START
 ↓
SSH ke Jetson
 ↓
Jalankan FastAPI Server
 ↓
Laptop buka Browser
 ↓
Akses http://IP_JETSON:8000
 ↓
Stream kamera tampil
 ↓
WebSocket kirim data realtime
 ↓
User input (control)
 ↓
Kirim ke Jetson → Pixhawk
 ↓
Loop terus
```

---

# ⚠️ 6. Best Practice

✅ Gunakan:
- WebSocket (realtime)
- MJPEG untuk video
- Resize frame (640x360)
- FPS 10–20

❌ Hindari:
- Kirim raw frame via JSON
- Polling HTTP terus-menerus
- Render UI di Jetson
- Blocking loop

---

# 🚀 7. Strategi Development

### Phase 1
- FastAPI basic + dummy data

### Phase 2
- MJPEG camera

### Phase 3
- WebSocket data

### Phase 4
- QR detection

### Phase 5
- Pixhawk control

### Phase 6
- UI dashboard full

---

# 🔥 8. Tips Lomba

- Gunakan LAN (bukan internet)
- UI ringan & jelas
- Pastikan latency rendah
- Test di kondisi real

Tambahkan fitur:
- Connection indicator
- Auto reconnect
- Warning system
- Multi camera switch

---

# 🎯 9. Kesimpulan

Project ini adalah:

👉 Ground Control System (GCS) berbasis Web  
👉 Jetson sebagai **server (processing + data)**  
👉 Laptop sebagai **client (UI di browser)**  

Menggabungkan:

- Web Technology (HTML, JS)
- FastAPI (backend)
- WebSocket (realtime)
- Computer Vision (OpenCV)
- Robotics Control (Pixhawk)

---

## 🔥 Insight Utama

> ❌ Jangan render UI di Jetson  
> ✅ Pindahkan UI ke browser  

➡️ Hasil:
- Lebih ringan  
- Lebih realtime  
- Lebih stabil  