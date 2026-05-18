let serverTime = 0;

const camTimeouts = {};
const camStates = {};
const activeStreams = {};

let activeFullscreenCam = null;

let lastQR = null;
let lastQRTime = 0;

let ws = null;
let reconnectTimeout = null;

let DEPTH_CONFIG = {
    pool: 300,
    danger: 200,
    setpoint: 150
};

let depthData = {
    depth: 0,
};

let TRAJ_CONFIG = {
    x: 500,
    y: 500
};

let trajPath = [];

let joystick = null;

let currentMode = "KEYBOARD";
let modeCooldown = false;

let isRecording = false;
let hasRecording = false;
let replayPlaying = false;

let sessionLoaded = false;


// INIT
document.addEventListener("DOMContentLoaded", async () => {
    console.log("JS LOADED");
    bindEvents();
    await initApp();
});


async function initApp() {
    await loadConfig();
    await loadSession();
    await loadPorts();

    initWebSocket();

    initDepthCanvas();
    initTrajCanvas();

    initROVImage();
    initModeSystem();
    initJoystick();

    updateDepthInfo();
    updateTrajInfo();

    sessionLoaded = true;
}


// BIND EVENTS
function bindEvents() {
    // FULLSCREEN
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

    // SERIAL
    document.getElementById("connectBtn").addEventListener("click", connectSerial);
    document.getElementById("disconnectBtn").addEventListener("click", disconnectSerial);
    document.getElementById("refreshPortsBtn").addEventListener("click", refreshPorts);

    // CAMERA
    document.getElementById("captureCam1Btn").addEventListener("click", () => captureCam(1));
    document.getElementById("captureCam2Btn").addEventListener("click", () => captureCam(2));
    document.getElementById("fullscreenBtn1").addEventListener("click", () => openFullscreenCam(1));
    document.getElementById("fullscreenBtn2").addEventListener("click", () => openFullscreenCam(2));

    // PID
    document.getElementById("applyPidBtn").addEventListener("click", sendPID);
    document.getElementById("resetPidBtn").addEventListener("click", resetPID);

    // QR
    document.getElementById("clearQRBtn").addEventListener("click", clearQRHistory);

    // LOG
    document.getElementById("clearLogBtn").addEventListener("click", clearLog);
    document.getElementById("copyLogBtn").addEventListener("click", copyLog);
    document.getElementById("testLogBtn").addEventListener("click", fakeLog);

    // ADVANCED
    document.getElementById("snapshotBtn").addEventListener("click", takeSnapshot);
    document.getElementById("resetSessionBtn").addEventListener("click", resetSession);
    document.getElementById("emergencyBtn").addEventListener("click", emergencyStop);

    // RECORD
    document.getElementById("recordBtn").addEventListener("click", startRecording);
    document.getElementById("stopRecordBtn").addEventListener("click", stopRecording);
    document.getElementById("replayBtn").addEventListener("click", replayRecording);

    // AUTO SNAPSHOT
    document.getElementById("autoSnapshot").addEventListener("change", toggleAutoSnapshot);
}


// HELPERS
function getJSON(url) {
    return fetch(url).then(r => r.json());
}

function postJSON(url, body = {}) {
    return fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    }).then(r => r.json());
}

function cooldownButton(btn, time = 1000) {
    if (!btn) return;
    btn.classList.add("cooldown");
    btn.disabled = true;

    setTimeout(() => {
        btn.classList.remove("cooldown");
        btn.disabled = false;
    }, time);
}

function isButtonLocked(btn) {
    return (
        btn.disabled ||
        btn.classList.contains("cooldown")
    );
}


// CONFIG
async function loadConfig() {
    try {
        const cfg = await getJSON("/config");
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
    } catch (err) {
        console.error("[CONFIG]", err);
    }
}


// SESSION
async function loadSession() {
    try {
        const state = await getJSON("/session");
        applySession(state);
        console.log("[SESSION] LOADED");
    } catch (err) {
        console.error("[SESSION] FAILED", err);
    }
}


async function saveSession(data) {
    try {
        await postJSON("/session", data);
    } catch (err) {
        console.error("[SESSION SAVE]", err);
    }
}


function applySession(state) {
    if (!state) return;

    // MODE
    currentMode = state.mode || "KEYBOARD";
    document.getElementById("mode").innerText = `● MODE: ${currentMode}`;

    document.querySelectorAll(".mode-btn").forEach(btn => {
            btn.classList.remove("active");

            if (
                btn.innerText.trim() === currentMode
            ) {
                btn.classList.add("active");
            }
        });


    // SERIAL
    if (state.serial) {
        if (state.serial.connected) {
            document.getElementById("status").innerText = `● SERIAL: ONLINE (${state.serial.port})`;
        } else {
            document.getElementById("status").innerText = "◌ SERIAL: OFFLINE";
        }
    }


    // PID
    if (state.pid) {
        document.getElementById("kp").value = state.pid.kp;
        document.getElementById("ki").value = state.pid.ki;
        document.getElementById("kd").value = state.pid.kd;

        const sliders = document.querySelectorAll(".pid-slider");

        sliders[0].value = state.pid.kp;
        sliders[1].value = state.pid.ki;
        sliders[2].value = state.pid.kd;

        document.getElementById("kp-last").innerText = `Last: ${state.pid.kp}`;
        document.getElementById("ki-last").innerText = `Last: ${state.pid.ki}`;
        document.getElementById("kd-last").innerText = `Last: ${state.pid.kd}`;
    }


    // TRAJECTORY
    if (Array.isArray(state.trajectory)) {
        trajPath = [...state.trajectory];
    }


    // QR
    if (state.qr) {
        const main = state.qr.main;
        document.getElementById("qrMainSide").innerText = main.side;
        document.getElementById("qrMainRaw").innerText = main.raw;
        document.getElementById("qrMainTime").innerText = main.time;
        const historyBox = document.getElementById("qrHistoryBox");

        historyBox.innerHTML = "";

        if (Array.isArray(state.qr.history)) {
            state.qr.history.forEach(item => {
                const div = document.createElement("div");

                div.classList.add("qr-item");

                div.innerHTML = `
                    <span class="qr-time">
                        ${item.time || "--"}
                    </span>

                    <span class="qr-sep">
                        -
                    </span>

                    <span class="qr-text">
                        ${item.side || "--"}
                    </span>
                `;

                historyBox.appendChild(div);
            });
        }
    }


    // LOGS
    if (Array.isArray(state.logs)) {
        const box = document.getElementById("logBox");
        box.innerHTML = "";

        state.logs.forEach(log => {
            addLog(log);
        });
    }


    // RECORD
    if (state.record) {
        isRecording = state.record.isRecording;
        hasRecording = state.record.hasRecording;
        replayPlaying = state.record.replayPlaying;

        syncRecordUI();
    }


    // ADVANCED
    if (state.advanced) {
        document.getElementById("autoSnapshot").checked = !!state.advanced.autoSnapshot;
        const emergencyBtn = document.getElementById("emergencyBtn");

        if (state.advanced.emergency) {
            emergencyBtn.classList.add("active");
        } else {
            emergencyBtn.classList.remove("active");
        }
    }


    // CAMERA
    if (state.camera) {
        if (state.camera["1"]) {
            const sw = document.querySelectorAll(".switch input")[0];

            sw.checked = true;
            toggleCam(1, sw, true);
        }

        if (state.camera["2"]) {
            const sw =document.querySelectorAll(".switch input")[1];

            sw.checked = true;
            toggleCam(2, sw, true);
        }
    }
}


// WEBSOCKET
function initWebSocket() {
    const protocol = location.protocol === "https:"? "wss": "ws";

    ws = new WebSocket(`${protocol}://${location.host}/ws`);
    ws.onopen = () => {console.log("[WS] CONNECTED");};
    ws.onmessage = (event) => {const msg = JSON.parse(event.data);handleTelemetry(msg);};

    ws.onclose = () => {
        console.log("[WS] CLOSED");

        setTimeout(() => {
            initWebSocket();
        }, 2000);
    };

    ws.onerror = (err) => {
        console.error("[WS ERROR]", err);
        ws.close();
    };
}


function handleTelemetry(msg) {
    if (!msg) return;

    if (msg.timestamp) {
        serverTime = msg.timestamp * 1000;
    }

    if (msg.datetime) {
        document.getElementById("datetime").innerText = msg.datetime;
    }

    if (msg.telemetry) {
        const data = msg.telemetry;

        document.getElementById("t_setpoint").innerText = `SETPOINT: ${DEPTH_CONFIG.setpoint}`;
        document.getElementById("t_height").innerText = `HEIGHT: ${data.depth}`;
        document.getElementById("t_heading").innerText = `HEADING: ${data.heading}`;
        document.getElementById("t_pressure").innerText = `PRESSURE: ${data.pressure}`;

        if (Array.isArray(data.pwm)) {

            data.pwm.forEach((val, i) => {
                const el = document.getElementById(`t_pwm${i + 1}`);

                if (el) {
                    el.innerText = `PWM${i + 1}: ${val}`;
                }
            });
        }

        depthData.depth = data.depth;
        updateDepthInfo();
    }

    if (msg.trajectory) {
        trajPath.push(msg.trajectory);
        if (trajPath.length > 500) {
            trajPath.shift();
        }
    }

    if (msg.session) {
        updateSessionRealtime(msg.session);
    }
}


function updateSessionRealtime(state) {
    if (!state) return;

    // SERIAL STATUS
    if (state.serial) {
        if (state.serial.connected) {
            document.getElementById("status")
                .innerText =
                `● SERIAL: ONLINE (${state.serial.port})`;

        } else {
            document.getElementById("status")
                .innerText =
                "◌ SERIAL: OFFLINE";
        }
    }

    // RECORD
    if (state.record) {
        isRecording = state.record.isRecording;
        hasRecording = state.record.hasRecording;
        replayPlaying = state.record.replayPlaying;

        syncRecordUI();
    }

    // QR
    if (state.qr) {
        document.getElementById("qrMainSide")
            .innerText =
            state.qr.main.side;

        document.getElementById("qrMainRaw")
            .innerText =
            state.qr.main.raw;

        document.getElementById("qrMainTime")
            .innerText =
            state.qr.main.time;
    }
}


// SERIAL
async function loadPorts() {
    try {
        const data = await getJSON("/serial/ports");
        const select = document.querySelector(".port-select");

        select.innerHTML = "";

        if (
            !data.ports || data.ports.length === 0
        ) {
            const opt =document.createElement("option");

            opt.text = "NO DEVICE";
            select.appendChild(opt);

            updateSerialButtons();
            return;
        }

        data.ports.forEach(port => {
            const opt = document.createElement("option");

            opt.value = port;
            opt.text = port;

            select.appendChild(opt);
        });
        updateSerialButtons();
    } catch (err) {
        console.error("[PORTS]", err);
    }
}


async function connectSerial() {
    const btn = document.getElementById("connectBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);

    const port = document.querySelector(".port-select").value;

    if (
        !port || port === "NO DEVICE"
    ) {
        return;
    }

    try {
        const res = await postJSON("/serial/connect", { port });

        if (res.success) {
            addLog(`[SERIAL] CONNECTED ${port}`);
        } else {
            addLog(`[SERIAL] FAILED`);
        }

    } catch (err) {
        console.error(err);
    }
}


async function disconnectSerial() {
    const btn = document.getElementById("disconnectBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);

    try {
        await fetch("/serial/disconnect", {
            method: "POST"
        });
        addLog("[SERIAL] DISCONNECTED");
    } catch (err) {
        console.error(err);
    }
}


async function refreshPorts() {
    const btn = document.getElementById("refreshPortsBtn");

    if (isButtonLocked(btn)) return;

    cooldownButton(btn, 1000);
    await loadPorts();
}


function updateSerialButtons() {
    const select = document.querySelector(".port-select");
    const connectBtn = document.getElementById("connectBtn");
    const stopBtn = document.getElementById("disconnectBtn");
    const noDevice = !select.value || select.value === "NO DEVICE";

    connectBtn.disabled = noDevice;
    stopBtn.disabled = noDevice;
}


// CAMERA
function setCameraButtons(id, enabled) {
    const card = document.querySelectorAll(".camera-card")[id - 1];
    if (!card) return;

    const captureBtn = card.querySelector(".capture");
    const fullscreenBtn = card.querySelector(".fullscreen-btn");

    captureBtn.disabled = !enabled;
    fullscreenBtn.disabled = !enabled;
}


async function toggleCam(id, el, fromSession = false) {
    const img = document.getElementById("cam" + id);
    const box = img.closest(".camera-box");
    const placeholder = box.querySelector(".camera-placeholder span");
    const camIndex = id - 1;

    if (el.checked) {
        camStates[id] = "loading";
        placeholder.innerText = "CONNECTING...";

        img.src = `/camera/${camIndex}?t=${Date.now()}`;
        img.onload = async () => {

            camStates[id] = "active";
            box.classList.add("active");
            setCameraButtons(id, true);
            placeholder.innerText = "";

            if (!fromSession) {
                await saveSession({
                    camera: {
                        [id]: true
                    }
                });
            }
        };

        img.onerror = () => {
            camStates[id] = "error";
            placeholder.innerText = "CAMERA NOT FOUND";

            setCameraButtons(id, false);
            el.checked = false;
            img.src = "";
        };

    } else {
        img.src = "";
        camStates[id] = "idle";
        box.classList.remove("active");
        placeholder.innerText = "CAMERA OFFLINE";

        setCameraButtons(id, false);

        try {
            await fetch(
                `/camera/${camIndex}/off`,
                { method: "POST" }
            );

        } catch (err) {
            console.error(err);
        }

        if (!fromSession) {
            await saveSession({
                camera: {
                    [id]: false
                }
            });
        }
    }
}


async function captureCam(id) {
    const btn = document.querySelectorAll(".capture")[id - 1];

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 700);

    try {
        const res =
            await fetch(
                `/capture/${id - 1}`,
                {
                    method: "POST"
                }
            );

        const result = await res.json();

        if (result.success) {
            addLog(`[CAPTURE] CAM ${id}`);

        } else {
            addLog(`[CAPTURE] FAILED CAM ${id}`);
        }

    } catch (err) {
        console.error(err);
    }
}


function openFullscreenCam(id) {
    const source = document.getElementById("cam" + id);
    if (!source.src) return;

    const overlay = document.getElementById("fullscreenOverlay");
    const fullscreenImage = document.getElementById("fullscreenImage");
    const fullscreenTitle = document.getElementById("fullscreenTitle");

    fullscreenImage.src = source.src;
    fullscreenTitle.innerText =`CAMERA ${id} FULLSCREEN`;
    
    overlay.classList.add("active");
    activeFullscreenCam = id;
    document.body.style.overflow = "hidden";
}


function closeFullscreenCam() {
    document.getElementById("fullscreenOverlay").classList.remove("active");
    document.body.style.overflow = "";
    activeFullscreenCam = null;
}


// QR
function clearQRHistory() {
    const btn = document.getElementById("clearQRBtn");
    if (isButtonLocked(btn)) return;

    cooldownButton(btn, 400);
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

    resize();

    window.addEventListener(
        "resize",
        resize
    );

    function draw() {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, w, h);

        const depth = depthData.depth;
        const pool = DEPTH_CONFIG.pool;
        const danger = DEPTH_CONFIG.danger;
        const setpoint = DEPTH_CONFIG.setpoint;
        const depthY = (depth / pool) * h;
        const dangerY = (danger / pool) * h;
        const spY = (setpoint / pool) * h;

        // DEPTH
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, depthY);
        ctx.lineTo(w, depthY);
        ctx.stroke();

        // DANGER
        ctx.strokeStyle = "red";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, dangerY);
        ctx.lineTo(w, dangerY);
        ctx.stroke();

        // SETPOINT
        ctx.strokeStyle = "#22c55e";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, spY);
        ctx.lineTo(w, spY);
        ctx.stroke();
    }

    setInterval(draw, 100);
}


function updateDepthInfo() {
    const box = document.querySelector(".depth-info-bottom");
    if (!box) return;
    const depth = depthData.depth;

    box.querySelector(".d-num")
        .innerText = depth;

    box.querySelector(".h-num")
        .innerText =
        DEPTH_CONFIG.pool;

    box.querySelector(".sp-num")
        .innerText =
        DEPTH_CONFIG.setpoint;

    const card = document.querySelector(".depth-card");
    const dangerText = box.querySelector(".danger-text");
    const dNum = box.querySelector(".d-num");

    if (
        depth >= DEPTH_CONFIG.danger
    ) {
        card.classList.add("danger");
        dangerText.style.opacity = "1";
        dNum.classList.add("danger");

    } else {
        card.classList.remove("danger");
        dangerText.style.opacity = "0";
        dNum.classList.remove("danger");
    }
}


// TRAJECTORY
function initTrajCanvas() {
    const canvas = document.getElementById("trajCanvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }

    function cmToPx(x, y) {
        return {
            x:
                (x / TRAJ_CONFIG.x)
                * canvas.width,

            y:
                (y / TRAJ_CONFIG.y)
                * canvas.height
        };
    }

    function drawGrid() {
        ctx.strokeStyle = "#1f2937";

        for (
            let x = 0;
            x < canvas.width;
            x += 40
        ) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        for (
            let y = 0;
            y < canvas.height;
            y += 40
        ) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function drawPath() {
        if (trajPath.length < 2) return;
        ctx.beginPath();

        trajPath.forEach((p, i) => {
            const pos = cmToPx(p.x, p.y);

            if (i === 0) {
                ctx.moveTo(
                    pos.x,
                    pos.y
                );

            } else {
                ctx.lineTo(
                    pos.x,
                    pos.y
                );
            }
        });

        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawRobot() {
        if (trajPath.length === 0) return;

        const last = trajPath[trajPath.length - 1];
        const pos = cmToPx(last.x, last.y);

        ctx.beginPath();
        ctx.arc(
            pos.x,
            pos.y,
            6,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ef4444";
        ctx.fill();
    }

    function render() {
        resizeCanvas();
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        drawGrid();
        drawPath();
        drawRobot();

        requestAnimationFrame(render);
    }
    render();
}


function updateTrajInfo() {
    const x =(TRAJ_CONFIG.x / 100);
    const y =(TRAJ_CONFIG.y / 100);

    document.getElementById("trajInfo")
        .innerText =
        `${x} x ${y} meter`;
}


// ROV
function initROVImage() {
    const img = document.getElementById("rov-img");
    const placeholder = document.getElementById("rov-placeholder");

    img.onload = () => {
        img.style.display = "block";
        placeholder.style.display = "none";
    };

    img.onerror = () => {
        img.style.display = "none";
        placeholder.style.display = "block";
    };
}


// MODE
function initModeSystem() {
    const modeButtons = document.querySelectorAll(".mode-btn");
    const modeText = document.getElementById("mode");

    modeButtons.forEach(btn => {
        btn.addEventListener(
            "click",
            async () => {
                if (modeCooldown) return;
                const selected = btn.innerText.trim();

                if (
                    selected === currentMode
                ) return;

                modeCooldown = true;

                modeButtons.forEach(b => {
                    b.classList.remove(
                        "active"
                    );
                });

                btn.classList.add("active");
                currentMode = selected;
                modeText.innerText = `● MODE: ${selected}`;

                await saveSession({
                    mode: selected
                });

                setTimeout(() => {
                    modeCooldown = false;
                }, 700);
            }
        );
    });
}


// JOYSTICK
function initJoystick() {
    const statusEl =
        document.getElementById(
            "joystickStatus"
        );

    window.addEventListener(
        "gamepadconnected",
        (e) => {
            joystick = e.gamepad;
            statusEl.innerText = `● JOYSTICK CONNECTED : ${joystick.id}`;
            statusEl.classList.add("active");

            addLog(`[JOY] CONNECTED ${joystick.id}`);
            pollJoystick();
        }
    );

    window.addEventListener(
        "gamepaddisconnected",
        () => {
            joystick = null;
            statusEl.innerText = "◌ JOYSTICK DISCONNECTED";
            statusEl.classList.remove("active");

            addLog("[JOY] DISCONNECTED");
        }
    );
}


function pollJoystick() {
    function update() {
        if (!joystick) return;
        requestAnimationFrame(update);
    }
    update();
}


// PID
async function sendPID() {
    const btn = document.getElementById("applyPidBtn");
    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);

    const kp = parseFloat(document.getElementById("kp").value);
    const ki = parseFloat(document.getElementById("ki").value);
    const kd = parseFloat(document.getElementById("kd").value);

    document.getElementById("kp-last").innerText = `Last: ${kp}`;
    document.getElementById("ki-last").innerText = `Last: ${ki}`;
    document.getElementById("kd-last").innerText = `Last: ${kd}`;

    await saveSession({
        pid: {
            kp,
            ki,
            kd
        }
    });

    addLog(`[PID] Kp=${kp} Ki=${ki} Kd=${kd}`);
}


function syncPID(slider, id) {
    document.getElementById(id).value = parseFloat(slider.value).toFixed(4);
}


async function resetPID() {
    const btn = document.getElementById("resetPidBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);

    ["kp", "ki", "kd"]
        .forEach(id => {
            document.getElementById(id)
                .value = "0.0000";
        });

    document.querySelectorAll(".pid-slider")
        .forEach(slider => {
            slider.value = "0.0000";
        });

    await saveSession({
        pid: {
            kp: 0,
            ki: 0,
            kd: 0
        }
    });

    addLog("[PID] RESET");
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
    const btn = document.getElementById("clearLogBtn");
    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 500);

    document.getElementById("logBox").innerHTML = "";
}


function copyLog() {
    const btn = document.getElementById("copyLogBtn");
    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 500);

    navigator.clipboard.writeText(
        document.getElementById("logBox")
            .innerText
    );
}


function fakeLog() {
    const btn = document.getElementById("testLogBtn");
    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 500);

    addLog("[INFO] IMU OK | DEPTH OK | PWM OK");
}


// RECORD
function syncRecordUI() {
    const recordBtn = document.getElementById("recordBtn");
    const stopBtn = document.getElementById("stopRecordBtn");
    const replayBtn = document.getElementById("replayBtn");


    // RECORDING
    if (isRecording) {
        recordBtn.classList.add(
            "recording"
        );

        recordBtn.innerHTML = `
            <i class="fa-solid fa-circle"></i>
            RECORDING...
        `;

    } else {
        recordBtn.classList.remove(
            "recording"
        );

        recordBtn.innerHTML = `
            <i class="fa-solid fa-circle"></i>
            START RECORD
        `;
    }

    // STOP
    stopBtn.disabled = !isRecording;

    // REPLAY
    replayBtn.disabled =
        !hasRecording || replayPlaying;


    if (replayPlaying) {
        replayBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            PLAYING...
        `;

    } else {
        replayBtn.innerHTML = `
            <i class="fa-solid fa-play"></i>
            REPLAY
        `;
    }
}


async function startRecording() {
    if (isRecording) return;

    const btn = document.getElementById("recordBtn");
    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 800);

    isRecording = true;
    hasRecording = false;

    syncRecordUI();

    await saveSession({
        record: {
            isRecording: true,
            hasRecording: false,
            replayPlaying: false
        }
    });
    addLog("[REC] STARTED");
}


async function stopRecording() {
    if (!isRecording) return;

    const btn = document.getElementById("stopRecordBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);

    isRecording = false;
    hasRecording = true;

    syncRecordUI();

    await saveSession({
        record: {
            isRecording: false,
            hasRecording: true,
            replayPlaying: false
        }
    });
    addLog("[REC] SAVED");
}


async function replayRecording() {
    if (!hasRecording) return;
    if (replayPlaying) return;

    const btn = document.getElementById("replayBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 5000);

    replayPlaying = true;
    syncRecordUI();

    await saveSession({
        record: {
            isRecording,
            hasRecording,
            replayPlaying: true
        }
    });

    addLog("[REPLAY] STARTED");

    setTimeout(async () => {
        replayPlaying = false;
        syncRecordUI();

        await saveSession({
            record: {
                isRecording,
                hasRecording,
                replayPlaying: false
            }
        });
        addLog("[REPLAY] FINISHED");
    }, 5000);
}


// ADVANCED
async function toggleAutoSnapshot(e) {
    await saveSession({advanced: {autoSnapshot: e.target.checked}});
}


async function takeSnapshot() {
    const btn = document.getElementById("snapshotBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 1000);
    addLog("[SNAPSHOT] CAPTURED");
}


async function resetSession() {
    const btn = document.getElementById("resetSessionBtn");

    if (isButtonLocked(btn)) return;
    cooldownButton(btn, 2000);

    try {
        await fetch("/session/reset", {
            method: "POST"
        });

        trajPath = [];
        document.getElementById("logBox").innerHTML = "";
        document.getElementById("qrHistoryBox").innerHTML = "";

        await loadSession();
        addLog("[SYSTEM] RESET");

    } catch (err) {
        console.error(err);
    }
}


async function emergencyStop() {
    const btn = document.getElementById("emergencyBtn");
    if (isButtonLocked(btn)) return;

    cooldownButton(btn, 3000);
    btn.classList.add("active");

    await saveSession({
        advanced: {
            emergency: true
        }
    });

    addLog("[EMERGENCY] STOP");
}