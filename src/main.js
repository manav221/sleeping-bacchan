import shootSound from "./assets/shoot.mp3";
import fireSound from "./assets/fire.mp3";
import fire2Sound from "./assets/fire2.mp3";
import aimmingSound from "./assets/aimming.mp3"
import killSound from "./assets/kill.mp3";
import mosquitoSound from './assets/mosquito.mp3';

const aimLine = document.querySelector(".aim-line");
const targets = document.querySelector(".targets");
const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startBtn = document.querySelector("#start-btn");

const MAX_ANGLE = 35; // degrees each side
const BULLET_SPEED = 800; // px/s
const COOLDOWN = 250; // ms between shots
const HIT_RADIUS = 30; // px
// const BITE_OFFSET = 90; // how far above the pivot a mosquito "bites"
const MAX_LIVES = 3;

let isHold = false;
let angle = 0;
let playing = false;
let score = 0;
let lives = MAX_LIVES;
let elapsed = 0;
let spawnTimer = 0;
let lastShot = 0;
let lastTime = 0;
let best = 0;
try {
    best = Number(localStorage.getItem("terimaaki-best")) || 0;
} catch { }

const bullets = [];
const mosquitoes = [];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const place = (el, x, y) => {
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
};

// Pivot = bottom-centre of the UNROTATED aim line, in viewport coords.
function getPivot() {
    const bed = aimLine.offsetParent.getBoundingClientRect();
    return {
        x: bed.left + aimLine.offsetLeft + aimLine.offsetWidth / 2,
        y: bed.top + aimLine.offsetTop + aimLine.offsetHeight,
    };
}

function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    livesEl.textContent = "❤️".repeat(lives) + "🖤".repeat(MAX_LIVES - lives);
}

// Sound

function makeSound(url, volume = 1) {
    const base = new Audio(url);
    base.preload = "auto";
    base.volume = volume;
    return () => {
        const s = base.cloneNode();
        s.volume = volume;
        s.play().catch(() => { });
    };
}

const KILL_SOUND = makeSound(killSound, 0.6);
const SHOOT_SOUND = makeSound(shootSound, 0.3);
const MOSQUITO_SOUND = makeSound(mosquitoSound, 0.1);
const FIRE_SOUND = makeSound(fireSound, 0.2);
const FIRE2Sound = makeSound(fire2Sound, 0.2);
const AIMMING_SOUND = makeSound(aimmingSound, 0.1);

//Aiming & shooting
function updateAim(e) {
    const p = getPivot();
    const a = Math.atan2(e.clientX - p.x, p.y - e.clientY) * (180 / Math.PI);
    angle = clamp(a, -MAX_ANGLE, MAX_ANGLE);
    aimLine.style.setProperty("--aim-line-angle", `${angle}deg`);
    aimLine.style.transform = `rotate(${angle}deg)`;
}

function shoot() {
    const now = performance.now();
    if (!playing || now - lastShot < COOLDOWN) return;
    lastShot = now;

    const p = getPivot();
    const r = (angle * Math.PI) / 180;
    const dx = Math.sin(r);
    const dy = -Math.cos(r);
    const muzzle = aimLine.offsetHeight * 0.066;

    const el = document.createElement("div");
    el.className = "bullet flying";
    document.body.append(el);

    const b = {
        el,
        x: p.x + dx * muzzle,
        y: p.y + dy * muzzle,
        vx: dx * BULLET_SPEED,
        vy: dy * BULLET_SPEED,
    };
    place(el, b.x, b.y);
    bullets.push(b);
    SHOOT_SOUND();
    Math.random() > 0.5 ? FIRE_SOUND() : FIRE2Sound();
}

document.addEventListener(
    "pointerdown",
    (e) => {
        if (e.target.closest("button")) return;
        isHold = true;
        document.body.classList.add("aiming");
        updateAim(e);
    },
    { capture: true }
);

document.addEventListener("pointermove", (e) => {
    if (isHold) updateAim(e);
});

document.addEventListener(
    "pointerup",
    () => {
        if (!isHold) return;
        isHold = false;
        document.body.classList.remove("aiming");
        shoot();
    },
    { capture: true }
);

document.addEventListener("pointercancel", () => {
    isHold = false;
    document.body.classList.remove("aiming");
});

function spawnMosquito() {
    const p = getPivot();
    const fromLeft = Math.random() < 0.5; // random direction
    const margin = window.innerWidth * 0.2; // 20% in from each edge
    const startX = fromLeft ? margin : window.innerWidth - margin;
    const endX = fromLeft ? window.innerWidth - margin : margin;
    const y = p.y * (0.2 + Math.random() * 0.4); // random height

    const el = document.createElement("div");
    el.className = "macchar";
    el.textContent = "🦟";
    targets.append(el);

    mosquitoes.push({
        el,
        startX,
        startY: y,
        endX,
        endY: y,
        dist: Math.abs(endX - startX),
        speed: (100 + Math.min(elapsed * 3, 200)) * 1,
        phase: Math.random() * Math.PI * 2,
        progress: 0,
        x: startX,
        y,
    });
}

function killMosquito(m) {
    m.el.textContent = "💥";
    m.el.classList.add("dead");
    setTimeout(() => m.el.remove(), 250);
    score += 10;
    updateHud();
    KILL_SOUND();
}

function bite() {
    lives--;
    updateHud();
    document.body.classList.remove("hurt");
    void document.body.offsetWidth; // restart animation
    document.body.classList.add("hurt");
    if (lives <= 0) gameOver();
}

function frame(t) {
    if (!playing) return;
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    elapsed += dt;

    if (mosquitoes.length === 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnMosquito();
            setTimeout(() => {
                MOSQUITO_SOUND();
            }, 300);
            spawnTimer = 0.5; // pause (seconds) before the next one appears
        }
    }

    // move mosquitoes
    for (let i = mosquitoes.length - 1; i >= 0; i--) {
        const m = mosquitoes[i];
        m.progress += (m.speed * dt) / m.dist;
        if (m.progress >= 1) {
            m.el.remove();
            mosquitoes.splice(i, 1);
            bite();
            if (!playing) return;
            continue;
        }
        const wobble = Math.sin(m.phase + elapsed * 2) * 15; // up/down bobbing
        m.x = m.startX + (m.endX - m.startX) * m.progress;
        m.y = m.startY + wobble;
        place(m.el, m.x, m.y);
    }

    // move bullets + collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        place(b.el, b.x, b.y);

        let spent = b.x < -20 || b.x > window.innerWidth + 20 || b.y < -20;

        if (!spent) {
            for (let j = mosquitoes.length - 1; j >= 0; j--) {
                const m = mosquitoes[j];
                if (Math.hypot(b.x - m.x, b.y - m.y) < HIT_RADIUS) {
                    mosquitoes.splice(j, 1);
                    killMosquito(m);
                    spent = true;
                    break;
                }
            }
        }

        if (spent) {
            b.el.remove();
            bullets.splice(i, 1);
        }
    }

    requestAnimationFrame(frame);
}

function clearField() {
    [...bullets, ...mosquitoes].forEach((o) => o.el.remove());
    bullets.length = 0;
    mosquitoes.length = 0;
    targets.querySelectorAll(".dead").forEach((el) => el.remove());
}

function startGame() {
    clearField();
    score = 0;
    lives = MAX_LIVES;
    elapsed = 0;
    spawnTimer = 0.5;
    playing = true;
    updateHud();
    overlay.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(frame);
}

function gameOver() {
    playing = false;
    isHold = false;
    document.body.classList.remove("aiming");
    if (score > best) {
        best = score;
        try {
            localStorage.setItem("terimaaki-best", String(best));
        } catch { }
    }
    overlayTitle.textContent = "Game over";
    overlayText.innerHTML = `Score: ${score}<br />Best: ${best}`;
    startBtn.textContent = "Play again";
    overlay.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);
updateHud();
