# 🚀 Setup & Run (Linux Only, Tanpa Virtual Environment)

Panduan ini untuk menjalankan project dari nol sampai bisa diakses di browser.

---

# 1. Install Dependencies System

```bash
sudo apt update
sudo apt install python3 python3-pip libzbar0
```

---

# 2. Clone / Download Project

```bash
git clone <link repo>
cd <nama-folder-project>
```

atau kalau manual:

```bash
cd folder_project
```

---

# 3. Install Python Requirements

```bash
pip3 install -r requirements.txt
```

---

# 4. Struktur Minimal Project

Pastikan ada:

```
project/
│
├── main.py
├── requirements.txt
├── static/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── assets/
└── logs/
```

---

# 5. Setting Awal

## Kamera

Edit di kode:

```python
cv2.VideoCapture(0)  # kamera 1
cv2.VideoCapture(1)  # kamera 2
```

## Serial (Pixhawk / Arduino)

Cek port:

```bash
ls /dev/ttyUSB*
```

Lalu set di kode:

```python
serial.Serial('/dev/ttyUSB0', 115200)
```

---

# 6. Jalankan Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Kalau sukses:

```
Uvicorn running on http://0.0.0.0:8000
```

---

# 7. Akses Web UI

Di browser:

```
http://localhost:8000
```

atau dari device lain:

```
http://IP_SERVER:8000
```

Contoh:

```
http://192.168.1.10:8000
```

---

# 8. Endpoint Penting

## Stream Kamera

```
http://IP:8000/video
```

## WebSocket

```
ws://IP:8000/ws
```

---

# 9. Troubleshooting

## Kamera tidak terbaca

```bash
ls /dev/video*
```

Coba ganti index:

```python
cv2.VideoCapture(1)
```

---

## Serial tidak connect

```bash
sudo chmod 666 /dev/ttyUSB0
```

atau:

```bash
sudo usermod -aG dialout $USER
```

logout lalu login lagi.

---

## QR tidak jalan

Pastikan:

```bash
sudo apt install libzbar0
```

---

## Cara Cepat install libary

windows:
```bash
pip install -r requirements.txt

#atau

python -m pip install -r requirements.txt
```

Linux:
```bash
sudo apt update
sudo apt install python3 python3-pip
sudo apt install libzbar0

pip3 install -r requirements.txt
```

---

# 🎯 DONE

Kalau semua benar:

* Server jalan ✅
* Kamera tampil ✅
* WebSocket aktif ✅
* UI bisa diakses di browser ✅
