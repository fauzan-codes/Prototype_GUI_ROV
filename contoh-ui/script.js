const BASE_CAMERA_URL = window.location.origin;

const CAMERA_CONFIG = {
    front: `${BASE_CAMERA_URL}/camera/front/stream`,
    bottom: `${BASE_CAMERA_URL}/camera/bottom/stream`
};

document.addEventListener("DOMContentLoaded", () => {
    setSystemStatus(true);

    initDashboard();
});

/* ================= SYSTEM STATUS ================= */
function setSystemStatus(isOnline) {
    const el = document.getElementById("system-status");
    const text = document.getElementById("status-text");

    if (isOnline) {
        el.classList.add("online");
        el.classList.remove("offline");
        text.textContent = "System Online";
    } else {
        el.classList.add("offline");
        el.classList.remove("online");
        text.textContent = "System Offline";
    }
}

/* ================= DASHBOARD ================= */
function initDashboard() {
    Camera("front");
    Camera("bottom");

    telemetry();
    timer();
}

/* ================= CAMERA ================= */
function Camera(name) {
    const img = document.getElementById(`${name}-camera`);
    const toggle = document.getElementById(`${name}-toggle`);
    const badge = document.getElementById(`${name}-badge`);
    const placeholder = document.getElementById(`${name}-placeholder`);

    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            img.src = CAMERA_CONFIG[name];
            img.style.display = "block";
            placeholder.style.display = "none";

            badge.textContent = "LIVE";
            badge.className = "live-badge live";
        } else {
            img.src = "";
            img.style.display = "none";
            placeholder.style.display = "flex";

            badge.textContent = "OFFLINE";
            badge.className = "live-badge offline";
        }
    });
}

/* ================= TELEMETRY ================= */
function telemetry() {
    const ws = new WebSocket(`ws://${location.host}/ws/telemetry`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        document.querySelector(".battery-value").textContent = data.battery + "%";
        document.querySelector(".depth-value").textContent = data.depth + " m";
        document.querySelector(".movement-value").textContent = data.movement;

        document.querySelector(".battery-progress").style.width = data.battery + "%";
    };

    ws.onopen = () => setSystemStatus(true);
    ws.onclose = () => setSystemStatus(false);
}

/* ================= TIMER ================= */
function timer() {
    let sec = 0;
    let interval = null;

    const display = document.getElementById("time-display");

    function format() {
        const h = String(Math.floor(sec / 3600)).padStart(2, "0");
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
    }

    document.getElementById("btn-start").onclick = () => {
        interval = setInterval(() => {
            sec++;
            display.textContent = format();
        }, 1000);
    };

    document.getElementById("btn-stop").onclick = () => {
        clearInterval(interval);
    };

    document.getElementById("btn-reset").onclick = () => {
        clearInterval(interval);
        sec = 0;
        display.textContent = "00:00:00";
    };
}