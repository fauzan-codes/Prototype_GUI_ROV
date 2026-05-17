let serverTime = 0;

const camTimeouts = {};
const camStates = {};
const activeStreams = {};
let activeFullscreenCam = null;

let lastQR = null;
let lastQRTime = 0;

let ws = null;

let DEPTH_CONFIG = {
    pool: 300,
    danger: 200,
    setpoint: 0
};
let depthData = {
    depth: 0,
};

let TRAJ_CONFIG = {
    x: 5000,
    y: 5000
};
let trajPath = [];

let joystick = null;
let currentMode = "AUTO";
let modeCooldown = false;

document.addEventListener("DOMContentLoaded", () => {
    console.log("JS LOADED");

    loadConfig();
    loadPorts();
    initWebSocket();

    initDepthCanvas();
    updateDepthInfo();
    initTrajCanvas();
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


// COOLDOWN BUTTON
function cooldownButton(btn, time = 1000) {
    btn.disabled = true;
    setTimeout(() => {
        btn.disabled = false;
    }, time);
}


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

            DEPTH_CONFIG.pool = cfg.pool_depth;
            DEPTH_CONFIG.danger = cfg.danger_depth;
            DEPTH_CONFIG.setpoint = cfg.setpoint_depth;

            TRAJ_CONFIG.x = cfg.traj_x;
            TRAJ_CONFIG.y = cfg.traj_y;

            updateDepthInfo();
            updateTrajInfo();
        })
        .catch(err => console.error("Config error:", err));
}



// WEBSOCKET
function initWebSocket() {
    ws = new WebSocket("ws://localhost:8000/ws");

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const data = msg.telemetry;

        if (msg.timestamp) {
            serverTime = msg.timestamp * 1000;
        }

        document.getElementById("datetime").innerText = msg.datetime;

        if (msg.qr) {
            updateQRSystem(msg.qr);
        }

        // TELEMETRY
        document.getElementById("t_setpoint").innerText =
            "SETPOINT: " + DEPTH_CONFIG.setpoint;

        document.getElementById("t_height").innerText =
            "HEIGHT: " + data.depth;

        document.getElementById("t_heading").innerText =
            "HEADING: " + data.heading;

        document.getElementById("t_pressure").innerText =
            "PRESSURE: " + data.pressure;

        data.pwm.forEach((val, i) => {
            document.getElementById(`t_pwm${i+1}`).innerText = `PWM${i+1}: ${val}`;
        });

        // DEPTH
        depthData.depth = data.depth;
        updateDepthInfo();

        if (msg.trajectory) {
            trajPath.push(msg.trajectory);

            if (trajPath.length > 500) {
                trajPath.shift();
            }
        }
        
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


// SERIAL
function loadPorts() {
    fetch("/serial/ports")
        .then(res => res.json())
        .then(data => {
            const select = document.querySelector(".port-select");
            select.innerHTML = "";

            if (data.ports.length === 0) {
                const opt = document.createElement("option");
                opt.text = "NO DEVICE";
                select.appendChild(opt);

                updateSerialButtons();
                return;
            }

            data.ports.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p;
                opt.text = p;
                select.appendChild(opt);
            });

            updateSerialButtons();
        });
}

function connectSerial() {
    const btn = document.querySelector(".connect-btn");
    cooldownButton(btn, 1000);

    const port = document.querySelector(".port-select").value;

    fetch("/serial/connect", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({port})
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            console.log("[SERIAL] CONNECT SUCCESS");
        } else {
            console.log("[SERIAL] CONNECT FAILED");
        }
    });
}

function disconnectSerial() {
    const btn = document.querySelector(".stop-btn");
    cooldownButton(btn, 1000);

    fetch("/serial/disconnect", {method: "POST"})
    .then(() => {
        console.log("[SERIAL] DISCONNECT");
    });
}

function refreshPorts() {
    const btn = document.querySelector(".refresh-btn");
    cooldownButton(btn, 1000);

    loadPorts();
    console.log("[SERIAL] REFRESH PORT");
}

function updateSerialButtons() {
    const select = document.querySelector(".port-select");
    const connectBtn = document.querySelector(".connect-btn");
    const stopBtn = document.querySelector(".stop-btn");

    const value = select.value;

    const noDevice = !value || value === "NO DEVICE";

    connectBtn.disabled = noDevice;
    stopBtn.disabled = noDevice;
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

    if (!camStates[id]) {
        camStates[id] = "idle";
    }

    if (camStates[id] === "loading") {
        console.log(`Camera ${id} still loading`);
        el.checked = true;
        return;
    }

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
        if (camStates[id] === "active") {
            console.log(`Camera ${id} already active`);
            return;
        }

        camStates[id] = "loading";

        setCameraButtons(id, false);
        img.dataset.state = "loading";

        placeholder.innerText = "CONNECTING...";
        box.classList.remove("active");

        if (activeStreams[id]) {
            activeStreams[id].src = "";
            activeStreams[id] = null;
        }

        img.src = "";
        void img.offsetWidth;
        img.src = `/camera/${camIndex}`;
        activeStreams[id] = img;

        img.classList.add("active");

        camTimeouts[id] = setTimeout(() => {
            if (camStates[id] !== "active") {
                console.log(`Camera ${id} timeout`);
                camStates[id] = "error";
                setCameraButtons(id, false);

                img.src = "";
                img.classList.remove("active");
                placeholder.innerText = "CAMERA NOT FOUND";
                box.classList.remove("active");

                el.checked = false;
            }
        }, 10000);

        img.onload = () => {
            camStates[id] = "active";

            setCameraButtons(id, true);
            sendLogToBackend(`[CAM] Camera ${id} ONLINE`);

            clearTimeout(camTimeouts[id]);
            camTimeouts[id] = null;

            box.classList.add("active");
        };

        img.onerror = () => {
            if (img.dataset.errorHandled === "true") return;

            img.dataset.errorHandled = "true";
            camStates[id] = "error";

            setCameraButtons(id, false);
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

        camStates[id] = "idle";
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

    fullscreenImg.src = sourceImg.src; // COPY STREAM

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




// DEPTH
function initDepthCanvas() {
    const canvas = document.getElementById("depthCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    window.addEventListener("resize", resize);
    resize();

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const pool = DEPTH_CONFIG.pool;
        const danger = DEPTH_CONFIG.danger;

        const depth = depthData.depth;
        const sp = DEPTH_CONFIG.setpoint;

        // bg
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "#1f2937";
        ctx.strokeRect(0, 0, w, h);

        // depthline
        const depthY = (depth / pool) * h;

        ctx.strokeStyle = "#38bdf8";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, depthY);
        ctx.lineTo(w, depthY);
        ctx.stroke();

        // setdanger
        const dangerY = (danger / pool) * h;

        ctx.strokeStyle = "red";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, dangerY);
        ctx.lineTo(w, dangerY);
        ctx.stroke();

        // setpoint
        const spY = (sp / pool) * h;

        ctx.strokeStyle = "#22c55e";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, spY);
        ctx.lineTo(w, spY);
        ctx.stroke();

        // scale
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px Poppins";

        const step = pool / 5;

        for (let i = 0; i <= pool; i += step) {
            const y = (i / pool) * h;

            ctx.beginPath();
            ctx.moveTo(w - 8, y);
            ctx.lineTo(w, y);
            ctx.strokeStyle = "#64748b";
            ctx.stroke();

            ctx.fillText(i.toFixed(0), 2, y - 2);
        }
    }

    setInterval(draw, 100);
}

function updateDepthInfo() {
    const H = DEPTH_CONFIG.pool;
    const depth = depthData.depth;
    const sp = DEPTH_CONFIG.setpoint;
    const box = document.querySelector(".depth-info-bottom");

    box.querySelector(".d-num").innerText = depth;
    box.querySelector(".h-num").innerText = H;
    box.querySelector(".sp-num").innerText = sp;

    const dangerEl = box.querySelector(".danger-text");
    const card = document.querySelector(".depth-card");
    const dNum = box.querySelector(".d-num");

    if (depth >= DEPTH_CONFIG.danger) {
        dangerEl.style.opacity = "1";
        card.classList.add("danger");
        dNum.classList.add("danger");
    } else {
        dangerEl.style.opacity = "0";
        card.classList.remove("danger");
        dNum.classList.remove("danger");
    }
}



// Trajectory
function initTrajCanvas() {
    const canvas = document.getElementById("trajCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const parent = canvas.parentElement;

        const maxW = parent.clientWidth;
        const maxH = parent.clientHeight;

        const ratio = TRAJ_CONFIG.x / TRAJ_CONFIG.y;

        let width = maxW;
        let height = width / ratio;

        if (height > maxH) {
            height = maxH;
            width = height * ratio;
        }

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        canvas.width = width;
        canvas.height = height;
    }

    function cmToPx(x, y) {
        const px = (x / TRAJ_CONFIG.x) * canvas.width;
        const py = (y / TRAJ_CONFIG.y) * canvas.height;

        return { x: px, y: py };
    }

    function drawGrid() {
        const meterX = TRAJ_CONFIG.x / 100;
        const meterY = TRAJ_CONFIG.y / 100;

        let gridStep = 1;

        const maxMeter = Math.max(meterX, meterY);
        if (maxMeter <= 5) gridStep = 0.5;
        else if (maxMeter <= 10) gridStep = 1;
        else if (maxMeter <= 20) gridStep = 2;
        else if (maxMeter <= 50) gridStep = 5;
        else gridStep = 10;

        const pxPerMeterX = canvas.width / meterX;
        const pxPerMeterY = canvas.height / meterY;

        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 1;

        for (let x = 0; x <= meterX; x += gridStep) {
            const px = x * pxPerMeterX;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y <= meterY; y += gridStep) {
            const py = y * pxPerMeterY;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(canvas.width, py);
            ctx.stroke();
        }
    }

    function drawPath() {
        if (trajPath.length < 2) return;

        ctx.beginPath();

        trajPath.forEach((p, i) => {
            const pos = cmToPx(p.x, p.y);

            if (i === 0) {
                ctx.moveTo(pos.x, pos.y);
            } else {
                ctx.lineTo(pos.x, pos.y);
            }
        });

        ctx.strokeStyle = "#22c55e"; // hijau
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawRobot() {
        if (trajPath.length === 0) return;

        const last = trajPath[trajPath.length - 1];
        const pos = cmToPx(last.x, last.y);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);

        ctx.fillStyle = "#ef4444";
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function render() {
        resizeCanvas();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid();
        drawPath();
        drawRobot();

        requestAnimationFrame(render);
    }

    render();
}

function updateTrajInfo() {
    const meterX = (TRAJ_CONFIG.x / 100).toFixed(1);
    const meterY = (TRAJ_CONFIG.y / 100).toFixed(1);

    const cleanX = meterX.endsWith(".0") ? parseInt(meterX) : meterX;
    const cleanY = meterY.endsWith(".0") ? parseInt(meterY) : meterY;

    document.getElementById("trajInfo").innerText =
        `${cleanX} x ${cleanY} meter`;
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