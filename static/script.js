// CLOCK
setInterval(() => {
    const now = new Date();
    document.getElementById("datetime").innerText =
        now.toLocaleString();
}, 1000);

// DEPTH SIMULATION
setInterval(() => {
    let val = Math.random() * 100;
    document.getElementById("depth-fill").style.height = val + "%";
}, 1000);

// TRAJECTORY CANVAS
const canvas = document.getElementById("trajCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 300;
canvas.height = 300;

let x = 150, y = 150;

function draw() {
    ctx.fillStyle = "#04080f";
    ctx.fillRect(0,0,300,300);

    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(x,y,5,0,Math.PI*2);
    ctx.fill();

    x += (Math.random() - 0.5) * 10;
    y += (Math.random() - 0.5) * 10;
}

function toggleCam(id, el) {
    const img = document.getElementById("cam" + id);

    if (el.checked) {
        img.src = "/video" + id;
        img.classList.add("active");
    } else {
        img.src = "";
        img.classList.remove("active");
    }
}

function captureCam(id) {
    const img = document.getElementById("cam" + id);

    if (!img.src) {
        alert("Camera belum ON!");
        return;
    }

    const link = document.createElement("a");
    link.href = img.src;
    link.download = "capture_cam" + id + ".jpg";
    link.click();
}

setInterval(draw, 100);