
// INIT APP (PASTIKAN DOM SIAP)
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

    if (!canvas) {
        console.warn("Canvas tidak ditemukan ⚠️");
        return;
    }

    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");

    let x = 0;
    let y = 0;

    // === SET SIZE DARI CONTAINER ===
    function resizeCanvas() {
        const rect = parent.getBoundingClientRect();

        canvas.width = rect.width;
        canvas.height = rect.height;

        // reset posisi ke tengah
        x = canvas.width / 2;
        y = canvas.height / 2;
    }

    resizeCanvas();

    // auto resize kalau window berubah
    window.addEventListener("resize", resizeCanvas);

    function draw() {
        // background
        ctx.fillStyle = "#04080f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // titik
        ctx.fillStyle = "cyan";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // gerakan random
        x += (Math.random() - 0.5) * 10;
        y += (Math.random() - 0.5) * 10;

        // biar gak keluar frame
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