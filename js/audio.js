/* Runtime state and audio engine. This file intentionally keeps functions global
   so the existing inline HTML handlers remain backwards compatible. */

// Chain Chopping Runtime Variables
let chainActive = false;
let chainHits = 0;
let chainMultiplier = 1;
let chainTimer = null;
let chainBuffTimer = null;
let currentChainTargetEl = null;

// Fairy Spawn Runtime
let fairyTimeout = null;
let luminaTimeout = null;
let fenniraTimeout = null;

/* WEB AUDIO API SYNTHESIZER ENGINE */
let audioCtx = null;
let bgmOsc = null;
let bgmGain = null;
let bgmInterval = null;
let bgmPlaying = false;
let sanctuaryWave = null; // Sicher global deklariert für Zone 4 (Sanktuarium)

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // SICHERE ERSTELLUNG DER WELLE: Beide Arrays brauchen mindestens ein Element, um Browser-Fehler zu vermeiden
    if (audioCtx && !sanctuaryWave) {
        const real = new Float32Array([0, 0, 0, 0, 0, 0]); 
        const imag = new Float32Array([0, 0.8, 0.4, 0.1, 0, 0]); 
        sanctuaryWave = audioCtx.createPeriodicWave(real, imag);
    }
}

function playSFX(type, extraParam = 1) {
    if (!gameState.settings.sfxEnabled || gameState.settings.sfxVolume <= 0) return;
    initAudioContext();
    if (!audioCtx) return;

    const masterVol = (gameState.settings.sfxVolume / 100) * 0.25;

    if (type === 'woodchop') {
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.05;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(masterVol * 1.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);

        const osc = audioCtx.createOscillator();
        const toneGain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);

        toneGain.gain.setValueAtTime(masterVol * 2, now);
        toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(toneGain);
        toneGain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.06);

    } else if (type === 'chainHit') {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        const baseFreq = 220 + (extraParam * 40);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

        gain.gain.setValueAtTime(masterVol * 1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);

    } else if (type === 'packOpen') {
        const now = audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const noteTime = now + (idx * 0.06);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(masterVol * 1.2, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(noteTime);
            osc.stop(noteTime + 0.3);
        });

    } else if (type === 'spellCast') {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

        gain.gain.setValueAtTime(masterVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

    } else if (type === 'gearUpgrade') {
        const now = audioCtx.currentTime;
        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        click.type = 'square';
        click.frequency.setValueAtTime(900, now);
        click.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        clickGain.gain.setValueAtTime(masterVol * 1.3, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        click.connect(clickGain);
        clickGain.connect(audioCtx.destination);
        click.start(now);
        click.stop(now + 0.05);

        [523.25, 783.99].forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const noteTime = now + 0.05 + (idx * 0.08);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(masterVol, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.18);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(noteTime);
            osc.stop(noteTime + 0.18);
        });
    }
}

/* PROCEDURAL BGM ENGINE BY ZONE */
function startProceduralBGM() {
    stopProceduralBGM();
    if (!gameState.settings.bgmEnabled || gameState.settings.bgmVolume <= 0) return;

    initAudioContext();
    if (!audioCtx) return;

    bgmPlaying = true;
    let noteIdx = 0;
    const zoneMelodies = [
        { scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], wave: 'sine', speed: 450 },
        { scale: [329.63, 392.00, 493.88, 523.25, 587.33, 659.25], wave: 'triangle', speed: 300 },
        { scale: [220.00, 246.94, 261.63, 311.13, 329.63, 415.30], wave: 'sawtooth', speed: 500 },
        { scale: [174.61, 220.00, 261.63, 329.63, 349.23, 440.00, 329.63, 349.23, 440.00, 329.63, 349.23, 261.63, 220.00], wave: 'custom', speed: 600 }
    ];

    // FIX: Fallback auf zoneMelodies[0] repariert, damit das Skript stabil lädt
    const currentMelody = zoneMelodies[gameState.currentZone] || zoneMelodies[0];

    bgmInterval = setInterval(() => {
        if (!bgmPlaying || !audioCtx) return;
        const now = audioCtx.currentTime;
        const freq = currentMelody.scale[noteIdx % currentMelody.scale.length];
        noteIdx++;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Custom Welle laden falls aktiv
        if (currentMelody.wave === 'custom' && sanctuaryWave) {
            osc.setPeriodicWave(sanctuaryWave);
        } else {
            osc.type = currentMelody.wave;
        }
        
        osc.frequency.setValueAtTime(freq, now);

        const vol = (gameState.settings.bgmVolume / 100) * 0.08;

        if (currentMelody.wave === 'custom') {
            // Unheimlicher Lavender Town Effekt: Töne klingen lang und überlappend im Hintergrund aus
            const noteDuration = 2.5; 
            const attackTime = 0.05; 
            const fadeOutTime = 2.0;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(vol, now + attackTime); 
            gain.gain.setValueAtTime(vol, now + (noteDuration - fadeOutTime));
            gain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);
            gain.gain.setValueAtTime(0, now + noteDuration);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + noteDuration);
        } else {
            // Original-Verhalten für die restlichen Zonen
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + (currentMelody.speed / 1000) * 0.9);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + (currentMelody.speed / 1000));
        }
    }, currentMelody.speed);

    const btn = document.getElementById("bgm-toggle-btn");
    if (btn) btn.classList.add("text-amber-300", "border-amber-400/50");
}

function stopProceduralBGM() {
    bgmPlaying = false;
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
    const btn = document.getElementById("bgm-toggle-btn");
    if (btn) btn.classList.remove("text-amber-300", "border-amber-400/50");
}

function toggleAudioBGM() {
    gameState.settings.bgmEnabled = !gameState.settings.bgmEnabled;
    if (gameState.settings.bgmEnabled) {
        startProceduralBGM();
        showNotification("BGM: An", "cyan");
    } else {
        stopProceduralBGM();
        showNotification("BGM: Aus", "gray");
    }
}
