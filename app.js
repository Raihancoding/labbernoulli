const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let simMode = "venturi";
let xp = 0;
let maxXP = 750;
let sfxEnabled = true;
let bgmPlaying = false;
let bgmStyle = "lofi";
let bgmInterval = null;
let bgmVolume = 0.45;
let stepBeat = 0;

// Status Eksperimen, Misi, PBL, Mitos & Evaluasi
let isUnlocked = false;
let missionsDone = { venturi: false, torricelli: false, airfoil: false, sprayer: false, pitot: false };
let pblSolved = { 1: false, 2: false, 3: false };
let mythFlipped = { 1: false, 2: false, 3: false, 4: false };
let poeDone = { venturi: false, torricelli: false, airfoil: false, sprayer: false, pitot: false };
let loggerRows = [];
let lastEvalScore = null;

// Data Pertanyaan POE (Predict-Observe-Explain) tiap Mode Lab
const poeConfig = {
    venturi: {
        q: "Jika luas leher sempit (A₂) diperkecil, bagaimana kelajuan (v₂) dan tekanan (P₂) di leher pipa?",
        btnA: "v₂ Naik & P₂ Turun",
        btnB: "v₂ Turun & P₂ Naik",
        correctA: true
    },
    torricelli: {
        q: "Jika kedalaman lubang (h₁) diperbesar 4 kali lipat, maka laju pancaran air (v) menjadi...",
        btnA: "2 kali lebih cepat",
        btnB: "4 kali lebih cepat",
        correctA: true
    },
    airfoil: {
        q: "Agar pesawat menghasilkan gaya angkat ke atas, bagaimana perbandingan laju udara di sayap?",
        btnA: "v₂ (atas) > v₁ (bawah)",
        btnB: "v₁ (bawah) > v₂ (atas)",
        correctA: true
    },
    sprayer: {
        q: "Mengapa cairan obat nyamuk di dalam botol bisa naik ke atas pipa hisap saat pompa ditekan?",
        btnA: "Tekanan di mulut pipa turun",
        btnB: "Tekanan di mulut pipa naik",
        correctA: true
    },
    pitot: {
        q: "Berapakah kelajuan gas tepat di mulut pipa manometer yang menghadap lurus menantang aliran (Titik Stagnasi)?",
        btnA: "Berhenti (v₂ = 0 m/s)",
        btnB: "Maksimum (v₂ = 2v₁)",
        correctA: true
    }
};

// =====================================================
// 0. SISTEM TOAST NOTIFICATION MELAYANG & XP MANAGER
// =====================================================
function showToast(icon, title, subtitle = "") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const item = document.createElement("div");
    item.className = "toast-item";
    item.innerHTML = `<span style="font-size:22px;">${icon}</span><div><div>${title}</div>${subtitle ? `<small style="color:#45e4bd;font-weight:600;">${subtitle}</small>` : ""}</div>`;
    container.appendChild(item);
    setTimeout(() => {
        item.style.opacity = "0";
        item.style.transform = "translateX(50px)";
        item.style.transition = "0.3s";
        setTimeout(() => item.remove(), 300);
    }, 3400);
}

function addXP(amount, reason = "") {
    xp = Math.max(0, xp + amount);
    document.getElementById("xp-counter").innerText = `${xp} XP`;
    const pct = Math.min(100, (xp / maxXP) * 100);
    document.getElementById("xp-bar").style.width = `${pct}%`;

    let rankText = "🌟 Pemula Fluida";
    if (xp >= 550) rankText = "🏆 Grandmaster Bernoulli";
    else if (xp >= 350) rankText = "🚀 Insinyur Aerodinamika";
    else if (xp >= 150) rankText = "🔬 Peneliti Fluida";
    document.getElementById("rank-badge").innerText = rankText;

    if (amount > 0 && reason) {
        showToast("✨", `+${amount} XP Diperoleh!`, reason);
    }
    updateLicenseCard();
}

// =====================================================
// 1. GENERATOR RADIO SYNTH MULTI-LAYER & EFEK SUARA FISIKA
// =====================================================
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

// Progresi Chord & Arpeggio untuk Lo-Fi Focus & Cyber Synthwave
const lofiChords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 349.23], // Fmaj7
    [196.00, 246.94, 293.66, 392.00]  // G6
];
const synthBass = [130.81, 130.81, 110.00, 110.00, 87.31, 87.31, 98.00, 98.00];
const synthArp = [523.25, 659.25, 783.99, 659.25, 440.00, 523.25, 659.25, 523.25];

function playBGMBeat() {
    if (!bgmPlaying || !audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const chordIdx = Math.floor(stepBeat / 4) % lofiChords.length;
        const chord = lofiChords[chordIdx];

        if (bgmStyle === "lofi") {
            // Lo-Fi Pad setiap awal bar + melodi lembut
            if (stepBeat % 2 === 0) {
                chord.forEach(freq => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freq, now);
                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.linearRampToValueAtTime(0.025 * bgmVolume, now + 0.15);
                    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.9);
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now);
                    osc.stop(now + 0.95);
                });
            }
            // Melodi bell pelan
            const melOsc = audioCtx.createOscillator();
            const melGain = audioCtx.createGain();
            melOsc.type = "sine";
            melOsc.frequency.setValueAtTime(chord[stepBeat % chord.length] * 2, now);
            melGain.gain.setValueAtTime(0.001, now);
            melGain.gain.linearRampToValueAtTime(0.04 * bgmVolume, now + 0.05);
            melGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
            melOsc.connect(melGain);
            melGain.connect(audioCtx.destination);
            melOsc.start(now);
            melOsc.stop(now + 0.48);
        } else {
            // Cyber Synthwave: Bassline + Fast Arpeggio
            const bOsc = audioCtx.createOscillator();
            const bGain = audioCtx.createGain();
            bOsc.type = "sawtooth";
            bOsc.frequency.setValueAtTime(synthBass[stepBeat % synthBass.length], now);
            bGain.gain.setValueAtTime(0.05 * bgmVolume, now);
            bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            bOsc.connect(bGain);
            bGain.connect(audioCtx.destination);
            bOsc.start(now);
            bOsc.stop(now + 0.24);

            const aOsc = audioCtx.createOscillator();
            const aGain = audioCtx.createGain();
            aOsc.type = "triangle";
            aOsc.frequency.setValueAtTime(synthArp[stepBeat % synthArp.length], now);
            aGain.gain.setValueAtTime(0.045 * bgmVolume, now);
            aGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            aOsc.connect(aGain);
            aGain.connect(audioCtx.destination);
            aOsc.start(now);
            aOsc.stop(now + 0.22);
        }
        stepBeat++;
    } catch (e) {}
}

function restartBGMTimer() {
    if (bgmInterval) clearInterval(bgmInterval);
    if (bgmPlaying) {
        const tempoMs = bgmStyle === "lofi" ? 520 : 260;
        playBGMBeat();
        bgmInterval = setInterval(playBGMBeat, tempoMs);
    }
}

function toggleBGM() {
    initAudio();
    bgmPlaying = !bgmPlaying;
    const btn = document.getElementById("bgm-btn");
    if (bgmPlaying) {
        btn.innerText = "🎵 Radio: ON";
        btn.style.color = "#45e4bd";
        restartBGMTimer();
    } else {
        btn.innerText = "🎵 Radio: OFF";
        btn.style.color = "#48d7ff";
        clearInterval(bgmInterval);
    }
}

function changeBGMStyle(style) {
    bgmStyle = style;
    stepBeat = 0;
    if (bgmPlaying) restartBGMTimer();
}

function changeBGMVolume(val) {
    bgmVolume = parseFloat(val) / 100;
}

function toggleSFX() {
    sfxEnabled = !sfxEnabled;
    document.getElementById("sfx-btn").innerText = sfxEnabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
    if (sfxEnabled) playSound("click");
}

function playSound(type) {
    if (!sfxEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === "click") {
            osc.frequency.setValueAtTime(580, now);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            osc.start(now);
            osc.stop(now + 0.07);
        } else if (type === "unlock") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            osc.frequency.setValueAtTime(1046.50, now + 0.24);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
            osc.start(now);
            osc.stop(now + 0.48);
        } else if (type === "spray" || type === "jet") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(type === "jet" ? 140 : 210, now);
            osc.frequency.linearRampToValueAtTime(type === "jet" ? 310 : 85, now + 0.28);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === "water") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(340, now);
            osc.frequency.exponentialRampToValueAtTime(680, now + 0.18);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === "wrong") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.setValueAtTime(135, now + 0.12);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        }
    } catch (e) {}
}

// =====================================================
// 2. LOGIKA PENGUNCIAN, POE HIPOTESIS & TROFI EKSPERIMEN
// =====================================================
function lockDependentVar() {
    isUnlocked = false;
    const st = document.getElementById("sim-mission-status");
    st.style.color = "#ff9f43";
    st.innerHTML = "🔒 Variabel Terikat: Belum Ditemukan (Jalankan Eksperimen!)";
}

function unlockExperiment() {
    isUnlocked = true;

    if (simMode === "torricelli") playSound("water");
    else if (simMode === "airfoil") playSound("jet");
    else if (simMode === "sprayer") {
        pumpBurst = 32;
        playSound("spray");
    } else {
        playSound("unlock");
    }

    const st = document.getElementById("sim-mission-status");
    st.style.color = "#45e4bd";
    st.innerHTML = "🔓 Variabel Terikat Ditemukan! Klik '📌 Catat Data ke Tabel' di bawah.";

    awardExperimentBadge(simMode);
}

function awardExperimentBadge(key) {
    if (missionsDone[key]) return;
    missionsDone[key] = true;

    const badgeNames = {
        venturi: "🔬 Ahli Venturimeter",
        torricelli: "🍾 Penakluk Torricelli",
        airfoil: "✈️ Insinyur Aerodinamika",
        sprayer: "🦟 Master Pompa Bernoulli",
        pitot: "🌬️ Navigator Pipa Pitot"
    };

    addXP(100, `Lencana Terbuka: ${badgeNames[key]}`);

    const bCard = document.getElementById(`badge-${key}`);
    if (bCard) {
        bCard.classList.add("unlocked");
        bCard.querySelector(".t-status").innerText = "✅ Terbuka (+100 XP)";
    }
    updateLicenseCard();
}

function updatePOEBox(mode) {
    const cfg = poeConfig[mode];
    document.getElementById("poe-question").innerText = cfg.q;
    document.getElementById("poe-btn-a").innerText = cfg.btnA;
    document.getElementById("poe-btn-b").innerText = cfg.btnB;
    const fb = document.getElementById("poe-feedback");
    if (poeDone[mode]) {
        fb.classList.remove("hidden");
        fb.style.color = "#45e4bd";
        fb.innerText = "✅ Hipotesis POE pada alat ini sudah terverifikasi (+25 XP)!";
    } else {
        fb.classList.add("hidden");
    }
}

function answerPOE(choseA) {
    const cfg = poeConfig[simMode];
    const isCorrect = (choseA === cfg.correctA);
    const fb = document.getElementById("poe-feedback");
    fb.classList.remove("hidden");

    if (isCorrect) {
        playSound("unlock");
        fb.style.color = "#45e4bd";
        fb.innerText = "✅ Prediksi Tepat! Buktikan langsung pada simulasi di kanan.";
        if (!poeDone[simMode]) {
            poeDone[simMode] = true;
            addXP(25, `Hipotesis POE ${simMode.toUpperCase()} Tepat`);
        }
    } else {
        playSound("wrong");
        fb.style.color = "#ff8a8a";
        fb.innerText = "❌ Kurang tepat! Ingat hubungan laju dan tekanan pada Asas Bernoulli.";
    }
}

// =====================================================
// 3. NAVIGASI TAB, KASUS DETEKTIF PBL & MITOS VS FAKTA
// =====================================================
function solvePBL(caseNum, isCorrect) {
    const box = document.getElementById(`pbl-ans-${caseNum}`);
    box.classList.remove("hidden");
    if (isCorrect) {
        playSound("unlock");
        box.style.background = "rgba(69, 228, 189, 0.16)";
        box.style.color = "#45e4bd";
        box.innerHTML = "✅ <strong>Hipotesis Tepat!</strong> Kelajuan fluida yang tinggi menghasilkan tekanan statis yang rendah, sehingga tekanan yang lebih besar mendorong benda ke area bertekanan rendah.";
        if (!pblSolved[caseNum]) {
            pblSolved[caseNum] = true;
            document.getElementById(`pbl-card-${caseNum}`).classList.add("solved");
            document.getElementById(`pbl-xp-${caseNum}`).innerText = "✅ +25 XP";
            addXP(25, `Menyelesaikan Kasus Detektif PBL #${caseNum}`);
        }
    } else {
        playSound("wrong");
        box.style.background = "rgba(255, 82, 82, 0.16)";
        box.style.color = "#ff8a8a";
        box.innerHTML = "❌ <strong>Kurang Tepat!</strong> Ingat prinsip Bernoulli: ketika aliran udara/air bergerak sangat cepat, tekanannya justru turun. Coba pilih analisis lainnya!";
    }
}

function flipMythCard(cardEl, num) {
    cardEl.classList.toggle("flipped");
    playSound("click");
    if (!mythFlipped[num]) {
        mythFlipped[num] = true;
        addXP(15, `Membongkar Fakta Fisika #${num}`);
    }
}

function openMainTab(tabId, btn) {
    playSound("click");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    if (btn) btn.classList.add("active");
}

function showSubMateri(subId, btn) {
    playSound("click");
    document.querySelectorAll(".materi-article").forEach(a => a.classList.remove("active"));
    document.querySelectorAll(".sub-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(subId).classList.add("active");
    if (btn) btn.classList.add("active");
}

function jumpToSub(subId) {
    const buttons = document.querySelectorAll(".sub-btn");
    const mapIdx = { "sub-asas": 0, "sub-pesawat": 1, "sub-nyamuk": 2, "sub-venturi": 3, "sub-pitot": 4, "sub-torricelli": 5 };
    showSubMateri(subId, buttons[mapIdx[subId]]);
    document.getElementById("bab-asas").scrollIntoView({ behavior: "smooth" });
}

function openGameMode(mode) {
    openMainTab("tab-game", document.getElementById("btn-tab-game"));
    switchSimMode(mode, document.getElementById(`gbtn-${mode}`));
}

function switchSimMode(mode, btn) {
    playSound("click");
    simMode = mode;
    lockDependentVar();
    updatePOEBox(mode);

    document.querySelectorAll(".gmode-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    ["venturi", "torricelli", "airfoil", "sprayer", "pitot"].forEach(m => {
        document.getElementById(`ctrl-${m}`).classList.add("hidden");
    });
    document.getElementById(`ctrl-${mode}`).classList.remove("hidden");

    const mText = document.getElementById("sim-mission-text");
    const cBox = document.getElementById("sim-challenge-box");

    if (mode === "venturi") {
        mText.innerHTML = "Atur <strong>A₁, A₂,</strong> dan <strong>h</strong>. Untuk membuka nilai <strong>kelajuan v₁ (🔒 ???)</strong>, seret <strong>Sensor 🎯</strong> ke dalam pipa atau klik tombol hijau di bawah!";
        cBox.innerHTML = "🎯 Tantangan: Seret Sensor 🎯 langsung ke leher pipa sempit untuk mengukur tekanan rendah!";
    } else if (mode === "torricelli") {
        mText.innerHTML = "Atur <strong>h₁</strong> dan <strong>h₂</strong> pada botol air. Klik <strong>Cabut Sumbat Botol</strong> untuk mengalirkan air dan menemukan nilai <strong>v serta x (🔒 ???)</strong>!";
        cBox.innerHTML = "🎯 Tantangan: Arahkan pancaran air tepat mengenai pot tanaman 🌱 hingga mekar menjadi 🌻 (100%)!";
    } else if (mode === "airfoil") {
        mText.innerHTML = "Atur <strong>v₁, v₂,</strong> dan <strong>Luas Sayap A</strong>. Klik <strong>Uji Terbangkan</strong> untuk melihat pesawat lepas landas dan membuka nilai <strong>Gaya Angkat F₁ − F₂ (🔒 ???)</strong>!";
        cBox.innerHTML = "🎯 Tantangan: Hasilkan Gaya Angkat minimal 1.000 kN agar pesawat kargo berhasil mengudara tinggi!";
    } else if (mode === "sprayer") {
        mText.innerHTML = "Atur kelajuan udara pompa <strong>v₂</strong>. Klik <strong>Tekan Pompa</strong> untuk menyemprot nyamuk dan membuka nilai <strong>Tinggi Kenaikan Cairan h (🔒 ???)</strong>!";
        cBox.innerHTML = "🎯 Tantangan: Tumbangkan seluruh 3 nyamuk 🦟 dengan satu kali semprotan bertekanan rendah!";
    } else if (mode === "pitot") {
        mText.innerHTML = "Atur selisih tinggi raksa <strong>h</strong> dan massa jenis gas <strong>ρ</strong>. Klik <strong>Buka Katup Gas</strong> untuk menemukan nilai <strong>Kelajuan Gas v₁ (🔒 ???)</strong>!";
        cBox.innerHTML = "🎯 Tantangan: Ukur aliran gas kecepatan tinggi hingga melampaui v₁ > 150 m/s!";
    }
}

// =====================================================
// 4. DATA LOGGER PRAKTIKUM (TABEL PENGAMATAN LKPD)
// =====================================================
let currentReading = { tool: "", input: "", output: "", note: "" };

function recordToLogger() {
    if (!isUnlocked) {
        playSound("wrong");
        showToast("🔒", "Jalankan Eksperimen Dulu!", "Variabel terikat masih terkunci. Klik tombol hijau terlebih dahulu.");
        return;
    }
    playSound("click");
    loggerRows.push({ ...currentReading });
    renderLoggerTable();
    showToast("📌", "Data Tercatat ke Tabel!", `${currentReading.tool}: ${currentReading.output}`);
}

function clearLogger() {
    playSound("click");
    loggerRows = [];
    renderLoggerTable();
}

function renderLoggerTable() {
    const tbody = document.getElementById("logger-tbody");
    if (loggerRows.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada data tercatat. Jalankan eksperimen lalu klik <strong>"📌 Catat Data ke Tabel"</strong>!</td></tr>`;
        return;
    }
    tbody.innerHTML = loggerRows.map((r, idx) => `
        <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td>${r.tool}</td>
            <td>${r.input}</td>
            <td><strong style="color:#45e4bd;">${r.output}</strong></td>
            <td>${r.note}</td>
        </tr>
    `).join("");
}

// =====================================================
// STATE SIMULASI CANVAS & SENSOR GESER
// =====================================================
let planeY = 355;
let clouds = [{ x: 150, y: 80, s: 1.1 }, { x: 480, y: 120, s: 0.8 }, { x: 760, y: 70, s: 1.2 }];
let plantTarget = { x: 428, watered: 0, bonusGiven: false };
let probe = { x: 140, y: 85, dragging: false };
let fluidDots = Array.from({ length: 110 }, () => ({ x: Math.random() * 880, yFrac: (Math.random() - 0.5) * 1.7 }));
let pumpBurst = 0;
let sprayMist = [];
let mosquitoes = [{ x: 620, y: 160, alive: true }, { x: 720, y: 210, alive: true }, { x: 670, y: 120, alive: true }];
let mosquitoBonusGiven = false;

function resetMosquitoes() {
    playSound("click");
    mosquitoes.forEach(m => m.alive = true);
    mosquitoBonusGiven = false;
}

canvas.addEventListener("mousedown", e => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top) * (canvas.height / r.height);
    if (simMode === "venturi" && Math.hypot(mx - probe.x, my - probe.y) < 32) probe.dragging = true;
});
canvas.addEventListener("mousemove", e => {
    if (!probe.dragging) return;
    const r = canvas.getBoundingClientRect();
    probe.x = Math.max(80, Math.min(800, (e.clientX - r.left) * (canvas.width / r.width)));
    probe.y = Math.max(60, Math.min(340, (e.clientY - r.top) * (canvas.height / r.height)));
    if (Math.abs(probe.y - 195) < 55) {
        if (!isUnlocked) unlockExperiment();
    }
});
window.addEventListener("mouseup", () => { probe.dragging = false; });

// =====================================================
// 1. SIMULASI VENTURIMETER (VARIABEL TERIKAT: v1)
// =====================================================
function renderVenturimeter() {
    const type = document.getElementById("sel-venturi-type").value;
    const a1_cm2 = parseFloat(document.getElementById("sl-ven-a1").value);
    const a2_cm2 = parseFloat(document.getElementById("sl-ven-a2").value);
    const h_cm = parseFloat(document.getElementById("sl-ven-h").value);

    document.getElementById("v-ven-a1").innerText = `${a1_cm2} cm²`;
    document.getElementById("v-ven-a2").innerText = `${a2_cm2} cm²`;
    document.getElementById("v-ven-h").innerText = `${h_cm} cm`;

    const A1 = a1_cm2 * 1e-4;
    const A2 = a2_cm2 * 1e-4;
    const h_m = h_cm / 100;
    const g = 10;
    const rho_water = 1000;
    const rho_merc = 13600;

    let v1_calc = 0;
    if (type === "mercury") {
        v1_calc = A2 * Math.sqrt((2 * (rho_merc - rho_water) * g * h_m) / (rho_water * (A1 * A1 - A2 * A2)));
    } else {
        v1_calc = A2 * Math.sqrt((2 * g * h_m) / (A1 * A1 - A2 * A2));
    }
    const v2_calc = (A1 / A2) * v1_calc;

    const centerY = 195;
    function pipeAt(x) {
        const gauss = Math.exp(-Math.pow((x - 440) / 130, 2));
        const rWide = Math.sqrt(a1_cm2) * 7.5;
        const rNeck = Math.sqrt(a2_cm2) * 7.5;
        const r = rWide - (rWide - rNeck) * gauss;
        const speed = isUnlocked ? (v1_calc + (v2_calc - v1_calc) * gauss) : 0.3;
        return { r, speed, gauss };
    }

    const pWide = pipeAt(220), pNeck = pipeAt(440);

    // Heatmap Tekanan Badan Pipa (Biru = P Tinggi, Oranye/Merah = P Rendah di Leher)
    for (let x = 60; x <= 820; x += 6) {
        const st = pipeAt(x);
        if (isUnlocked) {
            const red = Math.round(33 + st.gauss * 210);
            const green = Math.round(191 - st.gauss * 70);
            const blue = Math.round(255 - st.gauss * 170);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.28)`;
        } else {
            ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
        }
        ctx.fillRect(x, centerY - st.r, 7, st.r * 2);
    }

    fluidDots.forEach(pt => {
        const st = pipeAt(pt.x);
        pt.x += isUnlocked ? Math.max(1.2, st.speed * 1.1) : 0.25;
        if (pt.x > 820) pt.x = 60;
        ctx.beginPath();
        ctx.arc(pt.x, centerY + pt.yFrac * (st.r - 6), 3, 0, Math.PI * 2);
        ctx.fillStyle = isUnlocked ? "#45e4bd" : "#64748b";
        ctx.fill();
    });

    ctx.strokeStyle = "#48d7ff"; ctx.lineWidth = 3.5;
    [-1, 1].forEach(dir => {
        ctx.beginPath();
        for (let x = 60; x <= 820; x += 8) {
            const st = pipeAt(x);
            const y = centerY + dir * st.r;
            if (x === 60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    });

    if (type === "open") {
        const h1_px = 85, h2_px = Math.max(15, 85 - h_cm * 1.6);
        [{ x: 220, r: pWide.r, h: h1_px, lbl: "P₁ Tinggi (A₁)" }, { x: 440, r: pNeck.r, h: h2_px, lbl: `P₂ Rendah (Δh=${h_cm}cm)` }].forEach(m => {
            ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
            ctx.fillRect(m.x - 14, centerY - m.r - m.h, 28, m.h);
            ctx.strokeStyle = "#94a3b8"; ctx.strokeRect(m.x - 14, centerY - m.r - 100, 28, 100);
            ctx.fillStyle = "#eefaff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
            ctx.fillText(m.lbl, m.x, centerY - m.r - 108);
        });
    } else {
        const baseU = 375, shiftPx = Math.min(42, h_cm * 1.1);
        ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 20;
        ctx.beginPath(); ctx.moveTo(220, centerY + pWide.r); ctx.lineTo(220, baseU); ctx.lineTo(440, baseU); ctx.lineTo(440, centerY + pNeck.r); ctx.stroke();
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.moveTo(220, baseU - 32 + shiftPx); ctx.lineTo(220, baseU); ctx.lineTo(440, baseU); ctx.lineTo(440, baseU - 32 - shiftPx); ctx.stroke();
        ctx.fillStyle = "#fbbf24"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`Manometer Raksa (ρ' = 13.600 kg/m³) | Beda Tinggi h = ${h_cm} cm`, 330, baseU + 28);
    }

    // Sensor Probe 🎯
    const probeSt = pipeAt(probe.x);
    ctx.beginPath(); ctx.arc(probe.x, probe.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = isUnlocked ? "rgba(69, 228, 189, 0.35)" : "rgba(255, 159, 67, 0.35)";
    ctx.fill();
    ctx.strokeStyle = isUnlocked ? "#45e4bd" : "#ff9f43"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("🎯", probe.x, probe.y + 5);
    ctx.fillStyle = isUnlocked ? "#45e4bd" : "#ff9f43";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(isUnlocked ? `v lokal = ${probeSt.speed.toFixed(2)} m/s` : "Geser Sensor ke Pipa!", probe.x, probe.y - 24);

    document.getElementById("xray-formula-name").innerText =
        type === "mercury" ? "Rumus Venturi Raksa: v₁ = A₂ · √[ 2(ρ' − ρ)gh / (ρ(A₁² − A₂²)) ]" : "Rumus Venturi Tanpa Manometer: v₁ = A₂ · √[ 2gh / (A₁² − A₂²) ]";

    if (isUnlocked) {
        document.getElementById("xray-substitution").innerText =
            `🔓 DITEMUKAN: v₁ = ${v1_calc.toFixed(2)} m/s  (dan kelajuan di leher sempit v₂ = ${v2_calc.toFixed(2)} m/s)`;
        document.getElementById("t1-val").innerText = `${v1_calc.toFixed(2)} m/s`;
        document.getElementById("t2-val").innerText = `${v2_calc.toFixed(2)} m/s`;
        document.getElementById("t4-val").innerText = "TERBUKA ✅";

        currentReading = {
            tool: `Venturimeter (${type === "mercury" ? "Raksa" : "Pipa Tegak"})`,
            input: `A₁=${a1_cm2} cm², A₂=${a2_cm2} cm², h=${h_cm} cm`,
            output: `v₁ = ${v1_calc.toFixed(2)} m/s | v₂ = ${v2_calc.toFixed(2)} m/s`,
            note: "P₂ < P₁ di leher sempit"
        };
    } else {
        document.getElementById("xray-substitution").innerText =
            "🔒 v₁ = ??? m/s — Klik tombol '▶️ Alirkan Fluida & Temukan v₁!' atau seret Sensor 🎯 ke dalam pipa!";
        document.getElementById("t1-val").innerText = "🔒 ??? m/s";
        document.getElementById("t2-val").innerText = "🔒 ??? m/s";
        document.getElementById("t4-val").innerText = "TERKUNCI 🔒";
    }

    document.getElementById("t1-lbl").innerText = "🎯 KELAJUAN MASUK (v₁)";
    document.getElementById("t2-lbl").innerText = "KELAJUAN SEMPIT (v₂)";
    document.getElementById("t3-lbl").innerText = "RASIO LUAS (A₁ / A₂)";
    document.getElementById("t3-val").innerText = `${(a1_cm2 / a2_cm2).toFixed(1)}x`;
}

// =====================================================
// 2. SIMULASI BOTOL AIR TORRICELLI (VARIABEL TERIKAT: v & x)
// =====================================================
function randomizePlant() {
    playSound("click");
    plantTarget.x = Math.floor(Math.random() * 240) + 380;
    plantTarget.watered = 0;
    plantTarget.bonusGiven = false;
}

function renderTorricelliBottle() {
    const h1_cm = parseFloat(document.getElementById("sl-tor-h1").value);
    const h2_cm = parseFloat(document.getElementById("sl-tor-h2").value);
    const H_cm = h1_cm + h2_cm;

    document.getElementById("v-tor-h1").innerText = `${h1_cm.toFixed(1)} cm`;
    document.getElementById("v-tor-h2").innerText = `${h2_cm.toFixed(1)} cm`;

    const g = 10;
    const v_ms = Math.sqrt(2 * g * (h1_cm / 100));
    const x_cm = 2 * Math.sqrt(h1_cm * h2_cm);

    const floorY = 395, scale = 9.2;
    const bottleX = 140, bottleW = 102, bottleMaxH = 40 * scale;

    ctx.fillStyle = "#1e293b"; ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

    const bottleTopY = floorY - bottleMaxH;
    ctx.fillStyle = "#0284c7"; ctx.fillRect(bottleX + 31, bottleTopY - 30, 40, 12);
    ctx.strokeStyle = "rgba(186, 247, 255, 0.7)"; ctx.lineWidth = 3;
    ctx.strokeRect(bottleX + 33, bottleTopY - 18, 36, 18);

    const waterPx = H_cm * scale;
    ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
    ctx.fillRect(bottleX + 4, floorY - waterPx, bottleW - 8, waterPx);

    ctx.strokeStyle = "#bae6fd"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.roundRect(bottleX, bottleTopY, bottleW, bottleMaxH, [20, 20, 10, 10]); ctx.stroke();

    const holeY = floorY - h2_cm * scale;
    const startX = bottleX + bottleW;
    const landX = startX + x_cm * scale;

    ctx.fillStyle = "#48d7ff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`h₁ = ${h1_cm} cm`, bottleX - 42, floorY - waterPx + (h1_cm * scale) / 2);
    ctx.fillStyle = "#45e4bd";
    ctx.fillText(`h₂ = ${h2_cm} cm`, bottleX - 42, holeY + (h2_cm * scale) / 2);

    if (isUnlocked) {
        ctx.strokeStyle = "rgba(72, 215, 255, 0.85)"; ctx.lineWidth = 5;
        ctx.beginPath();
        for (let s = 0; s <= 1; s += 0.04) {
            const px = startX + (x_cm * scale) * s;
            const py = holeY + (h2_cm * scale) * (s * s);
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.fillStyle = "#ff9f43";
        ctx.fillText(`🎯 Jatuh di x = ${x_cm.toFixed(1)} cm`, landX, floorY + 24);

        if (Math.abs(landX - plantTarget.x) < 28 && plantTarget.watered < 100) {
            plantTarget.watered = Math.min(100, plantTarget.watered + 1.4);
            if (plantTarget.watered >= 100 && !plantTarget.bonusGiven) {
                plantTarget.bonusGiven = true;
                playSound("unlock");
                addXP(30, "Bunga Mekar 100%! Target Pancaran Tepat Sasaran");
            }
        }

        currentReading = {
            tool: "Botol Bocor Torricelli",
            input: `h₁=${h1_cm} cm, h₂=${h2_cm} cm`,
            output: `v = ${v_ms.toFixed(2)} m/s | x = ${x_cm.toFixed(1)} cm`,
            note: `Tinggi total H=${H_cm} cm`
        };
    } else {
        ctx.fillStyle = "#ff5252";
        ctx.fillRect(startX - 4, holeY - 6, 14, 12);
        ctx.fillStyle = "#ff9f43";
        ctx.fillText("🔒 Lubang Disumbat (Klik Cabut Sumbat!)", startX + 125, holeY + 4);
    }

    // Indikator Bunga & Progress Siram
    ctx.font = "32px sans-serif";
    ctx.fillText(plantTarget.watered >= 100 ? "🌻" : "🌱", plantTarget.x, floorY - 6);
    ctx.fillStyle = "#45e4bd"; ctx.font = "bold 11px sans-serif";
    ctx.fillText(`Siram: ${Math.round(plantTarget.watered)}%`, plantTarget.x, floorY - 42);

    document.getElementById("xray-formula-name").innerText = "Rumus Torricelli: v = √(2·g·h₁)  |  x = 2·√(h₁·h₂)";
    if (isUnlocked) {
        document.getElementById("xray-substitution").innerText =
            `🔓 DITEMUKAN: v = √(2 · 10 · ${(h1_cm/100).toFixed(2)} m) = ${v_ms.toFixed(2)} m/s  |  Jarak Pancaran x = 2√(${h1_cm} × ${h2_cm}) = ${x_cm.toFixed(1)} cm`;
        document.getElementById("t1-val").innerText = `${v_ms.toFixed(2)} m/s`;
        document.getElementById("t2-val").innerText = `${x_cm.toFixed(1)} cm`;
        document.getElementById("t4-val").innerText = "MEMANCAR 💧";
    } else {
        document.getElementById("xray-substitution").innerText =
            "🔒 v = ??? m/s dan x = ??? cm — Klik tombol '🍾 Cabut Sumbat Botol' untuk memulai percobaan!";
        document.getElementById("t1-val").innerText = "🔒 ??? m/s";
        document.getElementById("t2-val").innerText = "🔒 ??? cm";
        document.getElementById("t4-val").innerText = "DISUMBAT 🔒";
    }

    document.getElementById("t1-lbl").innerText = "🎯 LAJU PANCARAN (v)";
    document.getElementById("t2-lbl").innerText = "🎯 JARAK JATUH (x)";
    document.getElementById("t3-lbl").innerText = "TINGGI TOTAL AIR (H)";
    document.getElementById("t3-val").innerText = `${H_cm} cm`;
}

// =====================================================
// 3. SIMULASI PESAWAT TERBANG ASLI (VARIABEL TERIKAT: F1 - F2)
// =====================================================
function drawAirplaneBody(x, y, pitchDeg, lift_kn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((pitchDeg * Math.PI) / 180);

    ctx.fillStyle = "#0284c7";
    ctx.beginPath(); ctx.moveTo(-115, -5); ctx.lineTo(-145, -52); ctx.lineTo(-95, -5); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#eefaff";
    ctx.beginPath();
    ctx.moveTo(-140, -5); ctx.quadraticCurveTo(-20, -28, 95, -5); ctx.quadraticCurveTo(135, 5, 95, 18); ctx.lineTo(-130, 18);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#48d7ff"; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath(); ctx.moveTo(62, -14); ctx.lineTo(95, -4); ctx.lineTo(62, -2); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "#38bdf8";
    for (let wx = -75; wx <= 35; wx += 22) {
        ctx.beginPath(); ctx.arc(wx, -2, 4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.moveTo(-35, 6); ctx.quadraticCurveTo(5, -22, 45, 8); ctx.lineTo(-35, 10); ctx.closePath(); ctx.fill();

    // Panah Vektor Gaya Angkat F1 (Bawah) dan F2 (Atas)
    if (isUnlocked) {
        const arrowLen = Math.min(65, Math.max(20, Math.abs(lift_kn) * 0.04));
        ctx.strokeStyle = "#45e4bd"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(5, 42); ctx.lineTo(5, 42 - arrowLen); ctx.stroke();
        ctx.fillStyle = "#45e4bd"; ctx.font = "bold 11px sans-serif";
        ctx.fillText("⬆️ F₁ (Tekanan Bawah)", 5, 56);
    }

    ctx.restore();
}

function renderAirfoilGame() {
    const v1 = parseFloat(document.getElementById("sl-air-v1").value);
    const v2 = parseFloat(document.getElementById("sl-air-v2").value);
    const area = parseFloat(document.getElementById("sl-air-area").value);

    document.getElementById("v-air-v1").innerText = `${v1} m/s`;
    document.getElementById("v-air-v2").innerText = `${v2} m/s`;
    document.getElementById("v-air-area").innerText = `${area} m²`;

    const rho = 1.3;
    const lift_N = 0.5 * rho * area * (v2 * v2 - v1 * v1);
    const lift_kn = lift_N / 1000;

    ctx.fillStyle = "#07162c"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 390, canvas.width, 50);

    clouds.forEach(c => {
        c.x -= (isUnlocked ? v2 * 0.02 : 0.4) * c.s;
        if (c.x < -100) c.x = canvas.width + 80;
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.beginPath(); ctx.arc(c.x, c.y, 26 * c.s, 0, Math.PI * 2); ctx.fill();
    });

    const targetY = (isUnlocked && lift_kn > 0) ? Math.max(125, 355 - lift_kn * 0.12) : 355;
    planeY += (targetY - planeY) * 0.05;
    const pitch = (isUnlocked && lift_kn > 0) ? -10 : 0;

    drawAirplaneBody(380, planeY, pitch, lift_kn);

    ctx.fillStyle = "#eefaff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    if (isUnlocked) {
        ctx.fillStyle = lift_kn > 0 ? "#45e4bd" : "#ff5252";
        ctx.fillText(`🔓 Gaya Angkat (F₁ − F₂) = ${lift_N.toLocaleString("id-ID")} N (${lift_kn.toFixed(1)} kN)`, 380, planeY - 58);

        currentReading = {
            tool: "Gaya Angkat Pesawat",
            input: `v₁=${v1} m/s, v₂=${v2} m/s, A=${area} m²`,
            output: `F₁ − F₂ = ${lift_kn.toFixed(1)} kN (${lift_N.toLocaleString("id-ID")} N)`,
            note: lift_kn > 0 ? "Pesawat Terangkat ✈️" : "Tidak Terangkat"
        };
    } else {
        ctx.fillStyle = "#ff9f43";
        ctx.fillText("🔒 Pesawat Siap di Landasan (Klik Uji Terbangkan!)", 380, planeY - 58);
    }

    document.getElementById("xray-formula-name").innerText = "Rumus Gaya Angkat: F₁ − F₂ = ½ · ρ · A · (v₂² − v₁²)";
    if (isUnlocked) {
        document.getElementById("xray-substitution").innerText =
            `🔓 DITEMUKAN: F₁ − F₂ = ½ · (1,3) · (${area}) · (${v2}² − ${v1}²) = ${lift_N.toLocaleString("id-ID")} N (${lift_kn.toFixed(1)} kN)`;
        document.getElementById("t1-val").innerText = `${lift_kn.toFixed(1)} kN`;
        document.getElementById("t4-val").innerText = lift_kn > 0 ? "TERBANG ✈️" : "TIDAK NAIK";
    } else {
        document.getElementById("xray-substitution").innerText =
            "🔒 F₁ − F₂ = ??? N — Klik tombol '🚀 Uji Terbangkan & Hitung Gaya Angkat!'";
        document.getElementById("t1-val").innerText = "🔒 ??? kN";
        document.getElementById("t4-val").innerText = "TERKUNCI 🔒";
    }

    document.getElementById("t1-lbl").innerText = "🎯 GAYA ANGKAT (F₁ - F₂)";
    document.getElementById("t2-lbl").innerText = "LAJU ATAS (v₂)";
    document.getElementById("t3-lbl").innerText = "LAJU BAWAH (v₁)";
    document.getElementById("t2-val").innerText = `${v2} m/s`;
    document.getElementById("t3-val").innerText = `${v1} m/s`;
}

// =====================================================
// 4. SIMULASI PENYEMPROT NYAMUK (VARIABEL TERIKAT: h)
// =====================================================
function renderSprayer() {
    const v2 = parseFloat(document.getElementById("sl-spr-v2").value);
    const h_pipe_cm = parseFloat(document.getElementById("sl-spr-h").value);

    document.getElementById("v-spr-v2").innerText = `${v2} m/s`;
    document.getElementById("v-spr-h").innerText = `${h_pipe_cm.toFixed(1)} cm`;

    const maxRise_cm = (0.5 * 1.3 * v2 * v2) / (1000 * 10) * 450;
    const canSpray = isUnlocked && maxRise_cm >= h_pipe_cm;

    const botX = 230, botY = 245, botW = 120, botH = 135;
    ctx.fillStyle = "rgba(69, 228, 189, 0.45)";
    ctx.fillRect(botX + 4, botY + 42, botW - 8, botH - 46);
    ctx.strokeStyle = "#48d7ff"; ctx.lineWidth = 3; ctx.strokeRect(botX, botY, botW, botH);

    const pipeX = botX + botW / 2 - 6, nozzleY = 165;
    ctx.strokeStyle = "#94a3b8"; ctx.strokeRect(pipeX, nozzleY, 12, botY + 75 - nozzleY);

    const riseRatio = isUnlocked ? Math.min(1, maxRise_cm / h_pipe_cm) : 0.1;
    const colH = riseRatio * (botY + 42 - nozzleY);
    ctx.fillStyle = "#45e4bd"; ctx.fillRect(pipeX + 2, botY + 42 - colH, 8, colH);

    ctx.fillStyle = "#1e293b"; ctx.fillRect(80, 125, 220, 40);
    ctx.strokeStyle = "#48d7ff"; ctx.strokeRect(80, 125, 220, 40);

    if (pumpBurst > 0 && canSpray) {
        pumpBurst--;
        for (let i = 0; i < 5; i++) {
            sprayMist.push({ x: 310, y: 150 + (Math.random() - 0.5) * 14, vx: 8 + Math.random() * 5, vy: (Math.random() - 0.5) * 3 });
        }
    }

    sprayMist.forEach(m => {
        m.x += m.vx; m.y += m.vy;
        ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(69, 228, 189, 0.7)"; ctx.fill();
        mosquitoes.forEach(ny => {
            if (ny.alive && Math.hypot(m.x - ny.x, m.y - ny.y) < 34) ny.alive = false;
        });
    });

    if (mosquitoes.every(m => !m.alive) && !mosquitoBonusGiven) {
        mosquitoBonusGiven = true;
        playSound("unlock");
        addXP(30, "Ketiga Nyamuk Tumbang! Misi Pompa Bernoulli Sukses");
    }

    mosquitoes.forEach(ny => {
        ctx.font = "28px sans-serif";
        ctx.fillText(ny.alive ? "🦟" : "💫", ny.x, ny.y + Math.sin(Date.now() * 0.01) * 8);
    });

    document.getElementById("xray-formula-name").innerText = "Persamaan Penyemprot: g · h = ½ · v₂²";
    if (isUnlocked) {
        document.getElementById("xray-substitution").innerText =
            `🔓 DITEMUKAN: Tinggi Kenaikan Cairan h = ${maxRise_cm.toFixed(1)} cm (${canSpray ? "Melampaui pipa & menyemprot!" : "Belum cukup tinggi untuk menyemprot"})`;
        document.getElementById("t1-val").innerText = `${maxRise_cm.toFixed(1)} cm`;
        document.getElementById("t4-val").innerText = canSpray ? "MENYEMPROT 💨" : "KURANG CEPAT";

        currentReading = {
            tool: "Penyemprot Nyamuk",
            input: `v₂=${v2} m/s, Pipa=${h_pipe_cm} cm`,
            output: `h naik = ${maxRise_cm.toFixed(1)} cm`,
            note: canSpray ? "Menyemprot Kabut 💨" : "Gagal Menyemprot"
        };
    } else {
        document.getElementById("xray-substitution").innerText =
            "🔒 h = ??? cm — Klik tombol '💨 Tekan Pompa & Ukur Kenaikan h!'";
        document.getElementById("t1-val").innerText = "🔒 ??? cm";
        document.getElementById("t4-val").innerText = "TERKUNCI 🔒";
    }

    document.getElementById("t1-lbl").innerText = "🎯 TINGGI NAIK CAIRAN (h)";
    document.getElementById("t2-lbl").innerText = "LAJU UDARA POMPA (v₂)";
    document.getElementById("t3-lbl").innerText = "TINGGI PIPA BOTOL";
    document.getElementById("t2-val").innerText = `${v2} m/s`;
    document.getElementById("t3-val").innerText = `${h_pipe_cm} cm`;
}

// =====================================================
// 5. SIMULASI PIPA PITOT (VARIABEL TERIKAT: v1)
// =====================================================
function renderPitot() {
    const h_cm = parseFloat(document.getElementById("sl-pit-h").value);
    const rho_gas = parseFloat(document.getElementById("sl-pit-rho").value);

    document.getElementById("v-pit-h").innerText = `${h_cm.toFixed(1)} cm`;
    document.getElementById("v-pit-rho").innerText = `${rho_gas.toFixed(1)} kg/m³`;

    const rho_mercury = 13600, g = 10, h_m = h_cm / 100;
    const v_gas = Math.sqrt((2 * rho_mercury * g * h_m) / rho_gas);

    ctx.strokeStyle = "#48d7ff"; ctx.lineWidth = 4; ctx.strokeRect(100, 110, 680, 125);

    fluidDots.forEach(pt => {
        pt.x += isUnlocked ? v_gas * 0.015 : 0.4;
        if (pt.x > 770) pt.x = 105;
        ctx.fillStyle = isUnlocked ? "#38bdf8" : "#64748b";
        ctx.fillRect(pt.x, 172 + pt.yFrac * 32, 8, 2);
    });

    ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(430, 172); ctx.lineTo(500, 172); ctx.lineTo(500, 360); ctx.lineTo(320, 360); ctx.lineTo(320, 235); ctx.stroke();

    const shift = isUnlocked ? Math.min(50, h_cm * 2) : 0;
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(320, 312 - shift); ctx.lineTo(320, 360); ctx.lineTo(500, 360); ctx.lineTo(500, 312 + shift); ctx.stroke();

    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(isUnlocked ? `Selisih Tinggi Raksa h = ${h_cm} cm (Titik Stagnasi v₂ = 0)` : "🔒 Katup Gas Masih Tertutup", 410, 392);

    document.getElementById("xray-formula-name").innerText = "Rumus Pipa Pitot: v₁ = √(2 · ρ' · g · h / ρ)";
    if (isUnlocked) {
        document.getElementById("xray-substitution").innerText =
            `🔓 DITEMUKAN: v₁ = √((2 × 13.600 × 10 × ${h_m.toFixed(2)}) / ${rho_gas.toFixed(1)}) = ${v_gas.toFixed(1)} m/s`;
        document.getElementById("t1-val").innerText = `${v_gas.toFixed(1)} m/s`;
        document.getElementById("t4-val").innerText = "TERUKUR ✅";

        currentReading = {
            tool: "Tabung Pitot",
            input: `h=${h_cm} cm, ρ gas=${rho_gas} kg/m³`,
            output: `v₁ gas = ${v_gas.toFixed(1)} m/s`,
            note: "Titik stagnasi v₂ = 0"
        };
    } else {
        document.getElementById("xray-substitution").innerText =
            "🔒 v₁ = ??? m/s — Klik tombol '🌬️ Buka Katup Gas & Ukur Kelajuan v₁!'";
        document.getElementById("t1-val").innerText = "🔒 ??? m/s";
        document.getElementById("t4-val").innerText = "TERKUNCI 🔒";
    }

    document.getElementById("t1-lbl").innerText = "🎯 KELAJUAN GAS (v₁)";
    document.getElementById("t2-lbl").innerText = "SELISIH RAKSA (h)";
    document.getElementById("t3-lbl").innerText = "MASSA JENIS GAS (ρ)";
    document.getElementById("t2-val").innerText = `${h_cm} cm`;
    document.getElementById("t3-val").innerText = `${rho_gas} kg/m³`;
}

function animateLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (simMode === "venturi") renderVenturimeter();
    else if (simMode === "torricelli") renderTorricelliBottle();
    else if (simMode === "airfoil") renderAirfoilGame();
    else if (simMode === "sprayer") renderSprayer();
    else if (simMode === "pitot") renderPitot();
    requestAnimationFrame(animateLoop);
}

// =====================================================
// 5 SOAL EVALUASI DENGAN FITUR HINT & 50:50 BERBASIS XP
// =====================================================
const evaluationQuestions = [
    {
        q: "1. Perhatikan alat-alat berikut: (1) Pompa hidrolik, (2) Karburator, (3) Venturimeter, (4) Termometer. Alat-alat yang prinsip kerjanya berdasarkan Hukum Bernoulli adalah ....",
        opts: ["a. (1) dan (2)", "b. (1) dan (3)", "c. (1) dan (4)", "d. (2) dan (3)", "e. (2) dan (4)"],
        correct: 3,
        hint: "💡 Hint: Pompa hidrolik bekerja dengan Hukum Pascal (Fluida Statis), sedangkan alat yang melibatkan penyempitan aliran fluida bergerak adalah Karburator & Venturimeter.",
        explain: "Karburator dan Venturimeter bekerja berdasarkan Hukum Bernoulli."
    },
    {
        q: "2. Luas total sayap sebuah pesawat terbang 2 × 10⁵ cm² (20 m²). Udara mengalir pada bagian atas sayap dengan kecepatan 60 m/s dan pada bagian bawah sayap 50 m/s. Jika massa jenis udara = 1,29 kg/m³, maka berat pesawat adalah ....",
        opts: ["a. 11.490 N", "b. 12.190 N", "c. 13.290 N", "d. 14.190 N", "e. 15.490 N"],
        correct: 3,
        hint: "💡 Hint: Gunakan rumus F = ½ · ρ · A · (v₂² − v₁²) dengan ρ = 1,29 kg/m³, A = 20 m², dan (60² − 50²) = 1.100.",
        explain: "F = ½ · ρ · A · (v₂² − v₁²) = ½ · (1,29) · (20) · (60² − 50²) = 12,9 × 1.100 = 14.190 N."
    },
    {
        q: "3. Pada penampang sayap pesawat (A = atas sayap, B = bawah sayap), bagaimana keadaan kecepatan aliran udara (v) dan tekanan udara (P) hingga sayap pesawat memiliki gaya angkat ke atas?",
        opts: ["a. vA = vB dan PA = PB", "b. vA > vB dan PA < PB", "c. vA < vB dan PA > PB", "d. vA > vB dan PA > PB", "e. vA > vB dan PA = PB"],
        correct: 1,
        hint: "💡 Hint: Agar terdorong ke atas, tekanan di bawah (PB) harus lebih besar dari tekanan di atas (PA), yang berarti kelajuan di atas (vA) harus lebih cepat.",
        explain: "Agar pesawat terangkat ke atas, laju udara di atas sayap harus lebih besar (vA > vB) sehingga tekanan di atas lebih kecil (PA < PB)."
    },
    {
        q: "4. Dua pipa terhubung memiliki luas penampang berbeda. Kecepatan air pada penampang 1 sebesar 5 m/s dengan P₁ = 15.000 Pa, sedangkan pada penampang 2 kecepatannya 0,5 m/s dan posisinya 1 m lebih tinggi dari penampang 1 (g = 10 m/s²). Besar tekanan pada penampang 2 (P₂) adalah ....",
        opts: ["a. 10.175 Pa", "b. 12.375 Pa", "c. 14.575 Pa", "d. 16.775 Pa", "e. 18.975 Pa"],
        correct: 3,
        hint: "💡 Hint: Gunakan P₂ = P₁ + ½ρ(v₁² − v₂²) − ρg(h₂ − h₁) = 15.000 + 500(25 − 0,25) − 10.000(1).",
        explain: "Berdasarkan persamaan Bernoulli dengan beda ketinggian h₂ − h₁ = 1 m diperoleh P₂ = 16.775 Pa."
    },
    {
        q: "5. Tangki air memiliki lubang kebocoran dengan jarak lubang ke tanah H = 20 m dan jarak lubang ke permukaan air h = 5 m (g = 10 m/s²). Besar kecepatan air keluar dari bagian yang bocor (v) dan waktu yang diperlukan air sampai ke tanah (t) adalah ....",
        opts: ["a. v = 5 m/s dan t = 1 s", "b. v = 1 m/s dan t = 5 s", "c. v = 10 m/s dan t = 1,5 s", "d. v = 2 m/s dan t = 10 s", "e. v = 10 m/s dan t = 2 s"],
        correct: 4,
        hint: "💡 Hint: Laju keluar air v = √(2gh) dengan h = 5 m, sedangkan waktu jatuh bebas ke tanah t = √(2H/g) dengan H = 20 m.",
        explain: "v = √(2gh) = √(2 · 10 · 5) = 10 m/s, dan t = √(2H/g) = √(2 · 20 / 10) = 2 s."
    }
];

function initQuiz() {
    const container = document.getElementById("quiz-list");
    container.innerHTML = evaluationQuestions.map((item, qIdx) => `
        <div class="quiz-item">
            <div class="quiz-item-top">
                <h4>${item.q}</h4>
                <div class="lifeline-btns">
                    <button class="ll-btn" id="btn-hint-${qIdx}" onclick="useQuizHint(${qIdx})">💡 Hint (-50 XP)</button>
                    <button class="ll-btn" id="btn-5050-${qIdx}" onclick="useQuiz5050(${qIdx})">✂️ 50:50 (-50 XP)</button>
                </div>
            </div>
            <div id="hint-box-${qIdx}" class="quiz-hint-box hidden">${item.hint}</div>
            <div class="quiz-options" id="opts-${qIdx}">
                ${item.opts.map((opt, oIdx) => `
                    <label id="lbl-${qIdx}-${oIdx}">
                        <input type="radio" name="q${qIdx}" value="${oIdx}">
                        <span>${opt}</span>
                    </label>
                `).join("")}
            </div>
            <div id="fb-${qIdx}" class="quiz-feedback"></div>
        </div>
    `).join("");
}

function useQuizHint(qIdx) {
    if (xp < 50) {
        playSound("wrong");
        showToast("⚠️", "XP Belum Cukup!", "Kumpulkan minimal 50 XP dari kasus PBL atau Lab Virtual terlebih dahulu.");
        return;
    }
    playSound("click");
    addXP(-50);
    document.getElementById(`hint-box-${qIdx}`).classList.remove("hidden");
    document.getElementById(`btn-hint-${qIdx}`).disabled = true;
    showToast("💡", "Hint Rumus Terbuka!", "50 XP digunakan untuk membuka petunjuk pengerjaan.");
}

function useQuiz5050(qIdx) {
    if (xp < 50) {
        playSound("wrong");
        showToast("⚠️", "XP Belum Cukup!", "Kumpulkan minimal 50 XP dari kasus PBL atau Lab Virtual terlebih dahulu.");
        return;
    }
    playSound("click");
    addXP(-50);
    const correctIdx = evaluationQuestions[qIdx].correct;
    let eliminated = 0;
    for (let i = 0; i < 5; i++) {
        if (i !== correctIdx && eliminated < 2) {
            document.getElementById(`lbl-${qIdx}-${i}`).classList.add("eliminated");
            eliminated++;
        }
    }
    document.getElementById(`btn-5050-${qIdx}`).disabled = true;
    showToast("✂️", "Eliminasi 50:50 Aktif!", "2 opsi jawaban yang salah telah dicoret.");
}

function submitEvaluation() {
    let correctCount = 0;
    evaluationQuestions.forEach((item, qIdx) => {
        const selected = document.querySelector(`input[name="q${qIdx}"]:checked`);
        const fb = document.getElementById(`fb-${qIdx}`);
        if (selected && parseInt(selected.value) === item.correct) {
            correctCount++;
            fb.style.color = "#45e4bd";
            fb.innerHTML = `✅ Benar! ${item.explain}`;
        } else {
            fb.style.color = "#ff5252";
            fb.innerHTML = `❌ Kurang tepat. Pembahasan: ${item.explain}`;
        }
    });

    const evalScore = correctCount * 20;
    lastEvalScore = evalScore;
    playSound("unlock");
    const banner = document.getElementById("quiz-score-banner");
    banner.classList.remove("hidden");
    banner.innerHTML = `🎯 Skor Evaluasi Kamu: ${evalScore} / 100 (${correctCount} dari 5 Soal Benar)`;
    showToast("🎯", `Nilai Evaluasi: ${evalScore} / 100`, "Kartu Lisensi Insinyur di bawah telah diperbarui!");
    updateLicenseCard();
}

// =====================================================
// 6. GENERATOR KARTU LISENSI INSINYUR DIGITAL
// =====================================================
function updateLicenseCard() {
    const nameVal = document.getElementById("inp-student-name").value.trim();
    const classVal = document.getElementById("inp-student-class").value.trim();

    document.getElementById("lic-name").innerText = nameVal ? nameVal.toUpperCase() : "NAMA PENELITI MUDA";
    document.getElementById("lic-class").innerText = `Kelas: ${classVal || "XI MIPA -"}`;
    document.getElementById("lic-rank").innerText = document.getElementById("rank-badge").innerText;
    document.getElementById("lic-xp").innerText = `${xp} XP`;

    const doneCount = Object.values(missionsDone).filter(Boolean).length;
    document.getElementById("lic-badges").innerText = `${doneCount} / 5 Alat`;
    document.getElementById("lic-score").innerText = lastEvalScore !== null ? `${lastEvalScore} / 100` : "Belum Diuji";

    let statusText = "DALAM PELATIHAN";
    if (doneCount === 5 && lastEvalScore !== null && lastEvalScore >= 80) {
        statusText = "LULUS BERSERTIFIKAT ✅";
    } else if (doneCount >= 3 || (lastEvalScore !== null && lastEvalScore >= 60)) {
        statusText = "KOMPETENSI AKTIF ⚡";
    }
    document.getElementById("lic-status").innerText = statusText;
}

initQuiz();
updatePOEBox("venturi");
animateLoop();