let serverTime = 0;

const camTimeouts = {};
let activeFullscreenCam = null;

let lastQR = null;
let lastQRTime = 0;

let ws = null;

let joystick = null;
let currentMode = "AUTO";
let modeCooldown = false;

document.addEventListener("DOMContentLoaded", () => {
    console.log("JS LOADED");

    loadConfig();
    initCanvas();
    initWebSocket();
    initROVImage();
    initModeSystem();
    initJoystick();

    setCameraButtons(1, false);
    setCameraButtons(2, false);
});

// FULLSCREEN EVENTS
document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("fullscreenOverlay");
    const content = document.getElementById("fullscreenContent");

    overlay.addEventListener("click", (e) => {
        if (!content.contains(e.target)) {
            closeFullscreenCam();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeFullscreenCam();
        }
    });

});


// CONFIG
function loadConfig() {
    fetch("/config")
        .then(res => res.json())
        .then(cfg => {

            document.title = cfg.title_tag;

            document.getElementById("univ").innerText = cfg.university;
            document.getElementById("title").innerText = "◈   " + cfg.title + "   ◈";
            document.getElementById("subtitle").innerText = cfg.subtitle;
            document.getElementById("team").innerText = cfg.team;

        })
        .catch(err => console.error("Config error:", err));
}




// TRAJECTORY CANVAS
function initCanvas() {
    const canvas = document.getElementById("trajCanvas");
    if (!canvas) return;

    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");

    let x = 0;
    let y = 0;

    let resizeTimeout;

    function resizeCanvas() {
        const rect = parent.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        canvas.width = rect.width;
        canvas.height = rect.height;

        x = canvas.width / 2;
        y = canvas.height / 2;
    }

    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
    }

    window.addEventListener("load", resizeCanvas);
    window.addEventListener("resize", handleResize);

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(parent);

    resizeCanvas();

    function draw() {
        ctx.fillStyle = "#04080f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "cyan";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        x += (Math.random() - 0.5) * 10;
        y += (Math.random() - 0.5) * 10;

        x = Math.max(0, Math.min(canvas.width, x));
        y = Math.max(0, Math.min(canvas.height, y));
    }

    setInterval(draw, 100);
}


// CAMERA CONTROL
function setCameraButtons(id, enabled) {
    const card = document.querySelectorAll(".camera-card")[id - 1];
    if (!card) return;

    const captureBtn = card.querySelector(".capture");
    const fullscreenBtn = card.querySelector(".fullscreen-btn");
    captureBtn.disabled = !enabled;
    fullscreenBtn.disabled = !enabled;
}

function toggleCam(id, el) {
    const img = document.getElementById("cam" + id);
    const box = img.closest(".camera-box");
    const placeholder = box.querySelector(".camera-placeholder span");

    if (!img || !box) return;

    const camIndex = id - 1;
    if (camTimeouts[id]) {
        clearTimeout(camTimeouts[id]);
        camTimeouts[id] = null;
    }

    img.onload = null;
    img.onerror = null;
    img.dataset.errorHandled = "false";

    el.disabled = true;
    setTimeout(() => el.disabled = false, 500);

    if (el.checked) {
        setCameraButtons(id, false);
        img.dataset.state = "loading";

        placeholder.innerText = "CONNECTING...";
        box.classList.remove("active");

        img.src = `/camera/${camIndex}`;
        img.classList.add("active");

        camTimeouts[id] = setTimeout(() => {
            if (img.dataset.state !== "active") {
                console.log(`Camera ${id} timeout`);
                setCameraButtons(id, false);

                img.src = "";
                img.classList.remove("active");

                placeholder.innerText = "CAMERA NOT FOUND";
                box.classList.remove("active");

                el.checked = false;
                img.dataset.state = "error";
            }
        }, 10000);

        img.onload = () => {
            img.dataset.state = "active";
            setCameraButtons(id, true);
            sendLogToBackend(`[CAM] Camera ${id} ONLINE`);

            clearTimeout(camTimeouts[id]);
            camTimeouts[id] = null;

            box.classList.add("active");
        };

        img.onerror = () => {
            if (img.dataset.errorHandled === "true") return;

            setCameraButtons(id, false);
            img.dataset.errorHandled = "true";
            img.dataset.state = "error";

            sendLogToBackend(`[CAM] Camera ${id} FAILED`);

            clearTimeout(camTimeouts[id]);
            camTimeouts[id] = null;

            img.src = "";
            img.classList.remove("active");
            el.checked = false;

            placeholder.innerText = "CAMERA NOT FOUND";
            box.classList.remove("active");
        };

    }

    else {
        img.dataset.state = "idle";
        setCameraButtons(id, false);

        img.src = "";
        img.classList.remove("active");

        placeholder.innerText = "CAMERA OFFLINE";
        box.classList.remove("active");
        sendLogToBackend(`[CAM] Camera ${id} OFFLINE`);
    }
}

async function captureCam(id) {
    const btn = document.querySelectorAll(".capture")[id - 1];
    try {

        btn.disabled = true;
        const response = await fetch(`/capture/${id - 1}`, {
            method: "POST"
        });

        const result = await response.json();
        if (!result.success) {
            sendLogToBackend(`[CAPTURE] FAILED CAM ${id}`);
            return;
        }
    }

    catch (err) {
        console.error(err);
        sendLogToBackend(`[CAPTURE] ERROR CAM ${id}`);
    }

    finally {
        setTimeout(() => {
            btn.disabled = false;
        }, 500);
    }
}

function openFullscreenCam(id) {
    const sourceImg = document.getElementById("cam" + id);

    // CAMERA OFF
    if (!sourceImg || !sourceImg.src) {
        return;
    }

    const overlay = document.getElementById("fullscreenOverlay");
    const fullscreenImg = document.getElementById("fullscreenImage");

    // COPY STREAM
    fullscreenImg.src = sourceImg.src;

    // SHOW POPUP
    overlay.classList.add("active");
    activeFullscreenCam = id;
    document.body.style.overflow = "hidden";
}


function closeFullscreenCam() {
    const overlay = document.getElementById("fullscreenOverlay");
    overlay.classList.remove("active");
    activeFullscreenCam = null;
    document.body.style.overflow = "";
}


function updateQRSystem(qrData) {
    if (!qrData) return;

    const now = serverTime;
    const text = `${qrData.side} | ${qrData.raw}`;
    const MAX_HISTORY = 20;
    
    const nowDate = new Date(serverTime);
    const hh = String(nowDate.getHours()).padStart(2, '0');
    const mm = String(nowDate.getMinutes()).padStart(2, '0');
    const ss = String(nowDate.getSeconds()).padStart(2, '0');
    const time2 = `${mm}:${ss}`;
    const timeStr = `${hh}:${mm}:${ss}`;

    const historyBox = document.getElementById("qrHistoryBox");
    const item = document.createElement("div");
    item.classList.add("qr-item");

    if (text === lastQR) {
        item.classList.add("same");
    } else {
        item.classList.add("new");
    }

    item.innerHTML = `
        <span class="qr-time">${time2}</span>
        <span class="qr-sep">-</span>
        <span class="qr-text">${qrData.side}</span>
    `;

    historyBox.prepend(item);
    historyBox.scrollLeft = 0;
    historyBox.scrollTop = historyBox.scrollHeight;
    
    while (historyBox.children.length > MAX_HISTORY) {
        historyBox.removeChild(historyBox.lastChild);
    }

    // ===== MAIN LOGIC =====
    const isFirst = !lastQR;
    const isDifferent = text !== lastQR;
    const isTimeout = (now - lastQRTime) > 120000;

    if (isFirst || isDifferent || isTimeout) {

        document.getElementById("qrMainSide").innerText = "SISI - " + qrData.side;
        document.getElementById("qrMainRaw").innerText = qrData.raw;
        document.getElementById("qrMainTime").innerText =
            "Updated: " + timeStr;

        lastQR = text;
        lastQRTime = now;
    }
}

function clearQRHistory() {
    document.getElementById("qrHistoryBox").innerHTML = "";
}




// WEBSOCKET
function initWebSocket() {
    ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const data = msg.telemetry;

        // ambilwaktu
        if (msg.timestamp) {
            serverTime = msg.timestamp * 1000; // convert ke ms
        }

        // DATETIME
        document.getElementById("datetime").innerText = msg.datetime;

        // QRSYSTEM
        if (msg.qr) {
            updateQRSystem(msg.qr);
        }

        // TELEMETRY
        document.getElementById("t_setpoint").innerText = "SETPOINT: " + data.setpoint;
        document.getElementById("t_height").innerText = "HEIGHT: " + data.depth;
        document.getElementById("t_heading").innerText = "HEADING: " + data.heading;
        document.getElementById("t_pressure").innerText = "PRESSURE: " + data.pressure;

        // PWM
        data.pwm.forEach((val, i) => {
            document.getElementById(`t_pwm${i+1}`).innerText = `PWM${i+1}: ${val}`;
        });

        // DEPTH BAR
        document.getElementById("depth-fill").style.height =
            (data.depth / 300 * 100) + "%";

        // STATUS
        document.getElementById("status").innerText = "● SERIAL: ONLINE";

        if (msg.log) {
            addLog(msg.log);
        }
    };

    ws.onclose = () => {
        document.getElementById("status").innerText = "◌ SERIAL: OFFLINE";
    };
}

function sendLogToBackend(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "log",
            message: text
        }));
    } else {
        console.log("WS belum connect");
    }
}

// ROV IMAGE HANDLER
function initROVImage() {
    const rovImg = document.getElementById("rov-img");
    const rovText = document.getElementById("rov-placeholder");

    if (!rovImg || !rovText) {
        console.error("Element ROV tidak ditemukan");
        return;
    }

    // console.log("Cek gambar:", rovImg.src);

    rovImg.style.display = "none";
    rovText.style.display = "block";

    function showImage() {
        rovImg.style.display = "block";
        rovText.style.display = "none";
    }

    function showPlaceholder() {
        rovImg.style.display = "none";
        rovText.style.display = "block";
    }

    if (rovImg.complete) {
        if (rovImg.naturalWidth !== 0) {
            showImage();
        } else {
            showPlaceholder();
        }
    }

    rovImg.onload = showImage;
    rovImg.onerror = showPlaceholder;
}



// OPERATIONS
function initModeSystem() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const modeText = document.getElementById("mode");

    modeButtons.forEach(btn => {
        btn.addEventListener("click", () => {

            if (modeCooldown) return;
            const selectedMode = btn.innerText.trim();
            if (selectedMode === currentMode) return;

            modeCooldown = true;
            modeButtons.forEach(b => {
                b.disabled = true;
            });

            modeButtons.forEach(b => {
                b.classList.remove("active");
            });

            btn.classList.add("active");
            currentMode = selectedMode;
            modeText.innerText = `● MODE: ${currentMode}`;
            sendLogToBackend(`[MODE] ${currentMode}`);

            setTimeout(() => {
                modeCooldown = false;
                modeButtons.forEach(b => {
                    b.disabled = false;
                });
            }, 1000);

        });

    });

}

// JOYSTICK
function initJoystick() {

    const statusEl = document.getElementById("joystickStatus");
    window.addEventListener("gamepadconnected", (e) => {
        joystick = e.gamepad;
        console.log("Joystick connected:", joystick);

        statusEl.innerText =
            `● JOYSTICK CONNECTED : ${joystick.id}`;

        statusEl.classList.add("active");
        addLog(`[JOY] Connected : ${joystick.id}`);

        pollJoystick();
    });

    window.addEventListener("gamepaddisconnected", () => {

        joystick = null;

        statusEl.innerText =
            "● JOYSTICK DISCONNECTED";

        statusEl.classList.remove("active");
        addLog("[JOY] Disconnected");
    });
}

function pollJoystick() {
    function update() {

        if (!joystick) return;

        const gamepads = navigator.getGamepads();
        const gp = gamepads[joystick.index];

        if (!gp) {
            requestAnimationFrame(update);
            return;
        }

        // ANALOG
        const lx = gp.axes[0].toFixed(2);
        const ly = gp.axes[1].toFixed(2);

        const rx = gp.axes[2].toFixed(2);
        const ry = gp.axes[3].toFixed(2);

        const btnA = gp.buttons[0].pressed;
        const btnB = gp.buttons[1].pressed;

        requestAnimationFrame(update);
    }

    update();
}


// PID
function sendPID() {
    const kp = parseFloat(document.getElementById("kp").value).toFixed(4);
    const ki = parseFloat(document.getElementById("ki").value).toFixed(4);
    const kd = parseFloat(document.getElementById("kd").value).toFixed(4);

    const text = `[PID] Kp=${kp} Ki=${ki} Kd=${kd}`;
    sendLogToBackend(text)
}

function syncPID(slider, id) {
    const value = parseFloat(slider.value).toFixed(4);
    document.getElementById(id).value = value;
}


// LOG
function addLog(text) {
    const box = document.getElementById("logBox");
    const line = document.createElement("div");
    
    line.innerText = text;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function clearLog() {
    document.getElementById("logBox").innerHTML = "";
}

function copyLog() {
    navigator.clipboard.writeText(document.getElementById("logBox").innerText);
}

function fakeLog() {
    sendLogToBackend("[INFO] IMU OK | DEPTH 1.23m | PWM UPDATED");
}