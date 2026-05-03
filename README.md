# 📘 ROV Ground Control Station (GCS)
### PyQt Monitoring & Control System for ROV Competition

---

# 🧭 0. Persiapan Awal (REAL WORLD SETUP)

## 🪑 Setup Meja Kerja (GSC_ROV_Competition)

```text
[ Laptop (GUI PyQt) ]
        │
     (LAN Cable / Switch)
        │
[ Mini PC di ROV ]
        │
 ├── Camera Front
 ├── Camera Bottom
 ├── Sensor Depth
 ├── IMU (Optional)
 └── Power System
 ```

---

## ✅ Checklist Hardware

 - Laptop (Ground Control Station)
 - Mini PC (ROV)
 - 2 Kamera (Front & Bottom)
 - Sensor Depth
 - Kabel LAN
 - Joystick (opsional tapi direkomendasikan)

---

# 💻 1. Setup Software

## 🧰 Tools

 - Python 3.10+
 - VSCode / PyCharm

## 📁 Buat Project Folder

```
mkdir GSC_ROV_Competition
cd GSC_ROV_Competition
```

## 🐍 Virtual Environmen

```
python -m venv venv
```

Activate:

```
venv\Scripts\activate
```

## 📦 Install Dependencies

```
pip install pyqt5 opencv-python numpy matplotlib pandas pygame
```

---

# 🧱 2. Struktur Project

```
GSC_ROV_Competition/
│
├── main.py
│
├── ui/
│   ├── main_window.py
│   ├── topbar.py
│   ├── camera_panel.py
│   ├── data_panel.py
│   ├── trajectory_panel.py
│   └── rov_model_panel.py
│
├── core/
│   ├── network.py
│   ├── data_handler.py
│   ├── logger.py
│   └── replay.py
│
├── vision/
│   └── qr_detector.py
│
├── control/
│   └── joystick.py
│
├── assets/
│   └── rov.png
│
└── logs/
```

---

# 🧩 3. Fitur Utama

## 🎥 Camera System
 - Front Camera
 - Bottom Camera

## 🔳 QR Detection
 - Posisi: A / B / C / D
 - Status: Valid / Invalid

## 📏 Altitude
 - Tinggi ROV dari dasar

## 🧾 Informasi Umum
 - Hari, tanggal, waktu
 - Nama tim
 - Nama universitas

## 🤖 Visual ROV
 - Gambar ROV
 - Axis XYZ

## 🗺️ Trajectory
 - Start
 - Path
 - End

## 📸 Logging
 - Screenshot
 - Data Logging

## ▶️ Replay
 - Video replay
 - Trajectory replay

## 🚨 Alarm
 - Kedalaman berbahaya
 - Error system

## 🎮 Mode Control
 - Manual (Keyboard / Joystick)
 - Autonomous

---

# 🪜 4. Step-by-Step Development

## STEP 1 – Basic Window

```
import sys
from PyQt5.QtWidgets import QApplication, QMainWindow

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ROV GCS")
        self.setGeometry(100, 100, 1200, 800)

app = QApplication(sys.argv)
window = MainWindow()
window.show()
sys.exit(app.exec_())
```

## STEP 2 – Layout Utama

Struktur layout:
```
TOPBAR
MAIN DISPLAY (Camera + QR)
DATA & VISUAL
FOOTER
```

Gunakan:
 - QVBoxLayout
 - QGridLayout

## STEP 3 – Top Bar (Realtime Info)

```
from datetime import datetime
from PyQt5.QtCore import QTimer
```

## STEP 4 – Camera Display

```
import cv2
cap = cv2.VideoCapture(0)
```

Convert ke PyQt:
 - QImage
 - QLabel
Gunakan QTimer untuk update frame

## STEP 5 – Network (LAN Communication)

Gunakan Socket (WAJIB)
```
import socket

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client.connect(("192.168.1.10", 5000))
```

## STEP 6 – Format Data

Gunakan JSON:
```
{
  "depth": 120,
  "qr": "A",
  "status": "valid",
  "position": [1.2, 3.4, 0.5]
}
```

## STEP 7 – QR Detection

```
detector = cv2.QRCodeDetector()
data, bbox, _ = detector.detectAndDecode(frame)
```

## STEP 8 – Altitude Display

```
self.label_depth.setText("120 cm")
```

## STEP 9 – Trajectory Map

Gunakan matplotlib:
```
ax.plot(x, y)
```

## STEP 10 – Joystick Control

Gunakan pygame:
```
import pygame
pygame.joystick.init()
```

## STEP 11 – Logging

```
import pandas as pd
df.to_csv("logs/data.csv")
```

## STEP 12 – Screenshot

```
QPixmap.grabWindow()
```

## STEP 13 – Replay System

```
for row in log:
    update_ui(row)
```

## STEP 14 – Alarm System

```
if depth > threshold:
    play_sound()
```

## STEP 15 – Mode Control

```
MODE: MANUAL
MODE: AUTO
```

--- 

# 🔄 5. Alur Program

```
START
 ↓
Connect ke ROV
 ↓
Ambil data sensor
 ↓
Ambil video stream
 ↓
Update UI
 ↓
User control input
 ↓
Kirim command ke ROV
 ↓
Loop terus
```

---

# ⚠️ 6. Best Practice

✅ Gunakan:
 - QTimer
 - Signal-Slot
 - Threading (camera & network)
❌ Hindari:
 - Blocking UI
 - Campur UI dengan logic

---

# 🚀 7. Strategi Development

Phase 1
 - UI + Dummy Data

Phase 2
 - Network (Socket)

Phase 3
 - Camera

Phase 4
 - Control

Phase 5
 - Advanced (QR, Replay, dll)

---

# 🔥 8. Tips Lomba

 - UI harus clean & informatif
 - Data real-time
 - Tidak lag
 - Tambahkan fitur unik:
     - Auto QR tracking
     - Compass visualization
     - Warning system
     - Replay timeline

---

# 🎯 9. Kesimpulan

Project ini adalah:

👉 Ground Control System (GCS) untuk ROV
👉 Menggabungkan:

 - GUI
 - Networking
 - Computer Vision
 - Robotics Control

