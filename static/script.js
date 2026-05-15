
document.addEventListener("DOMContentLoaded", () => {
    console.log("JS LOADED");

    initClock();
    initDepth();
    initCanvas();
    initROVImage();
});



// CLOCK
function initClock() {
    setInterval(() => {
        const now = new Date();
        const el = document.getElementById("datetime");
        if (el) {
            el.innerText = now.toLocaleString();
        }
    }, 1000);
}



// DEPTH SIMULATION
function initDepth() {
    setInterval(() => {
        const el = document.getElementById("depth-fill");
        if (el) {
            let val = Math.random() * 100;
            el.style.height = val + "%";
        }
    }, 1000);
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
function toggleCam(id, el) {
    const img = document.getElementById("cam" + id);

    if (!img) return;

    if (el.checked) {
        img.src = "/video";
        img.classList.add("active");
    } else {
        img.src = "";
        img.classList.remove("active");
    }
}

function captureCam(id) {
    const img = document.getElementById("cam" + id);

    if (!img || !img.src) {
        alert("Camera belum ON!");
        return;
    }

    const link = document.createElement("a");
    link.href = img.src;
    link.download = "capture_cam" + id + ".jpg";
    link.click();
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


// PID
function sendPID() {
    const kp = parseFloat(document.getElementById("kp").value).toFixed(4);
    const ki = parseFloat(document.getElementById("ki").value).toFixed(4);
    const kd = parseFloat(document.getElementById("kd").value).toFixed(4);

    document.getElementById("kp-last").innerText = "Last: " + kp;
    document.getElementById("ki-last").innerText = "Last: " + ki;
    document.getElementById("kd-last").innerText = "Last: " + kd;

    addLog(`[PID] Kp=${kp} Ki=${ki} Kd=${kd}`);
}

function syncPID(slider, id) {
    const value = parseFloat(slider.value).toFixed(4);
    document.getElementById(id).value = value;
}


// LOG
function addLog(text) {
    const box = document.getElementById("logBox");

    const line = document.createElement("div");
    const time = new Date().toLocaleTimeString();

    line.innerText = `[${time}] ${text}`;

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
    addLog("IMU OK | DEPTH 1.23m | PWM UPDATED");
}