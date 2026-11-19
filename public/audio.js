// ── Music (140 BPM techno — 4-on-the-floor, hard bass, synth lead) ──────────
export const music = (() => {
  let ac = null, master = null, running = false, muted = false, nextBar = 0, barNum = 0;
  const BPM = 140;
  const B = 60 / BPM; // one beat
  const S = B / 4;    // one 16th note step

  function noise(s) {
    const n = Math.ceil(ac.sampleRate * s);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Hard punchy kick with long pitch sweep
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(master);
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(0.001, t + 0.55);
    g.gain.setValueAtTime(5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.start(t); o.stop(t + 0.56);
  }

  // Crisp electronic clap (layered noise bursts)
  function clap(t) {
    for (let i = 0; i < 3; i++) {
      const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise(0.13); bp.type = 'bandpass'; bp.frequency.value = 1800 + i * 300; bp.Q.value = 0.5;
      s.connect(bp); bp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.65 - i * 0.15, t + i * 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.012 + 0.13);
      s.start(t + i * 0.012); s.stop(t + i * 0.012 + 0.14);
    }
  }

  // Closed hi-hat
  function hat(t, v) {
    const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(0.035); hp.type = 'highpass'; hp.frequency.value = 11000;
    s.connect(hp); hp.connect(g); g.connect(master);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.start(t); s.stop(t + 0.04);
  }

  // Open hi-hat (sustains)
  function openHat(t) {
    const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(0.22); hp.type = 'highpass'; hp.frequency.value = 8500;
    s.connect(hp); hp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.38, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    s.start(t); s.stop(t + 0.22);
  }

  // Driving sawtooth bass with resonant filter sweep
  function bass(t, freq, dur) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.Q.value = 12;
    f.frequency.setValueAtTime(2000, t);
    f.frequency.exponentialRampToValueAtTime(150, t + dur * 0.55);
    o.connect(f); f.connect(g); g.connect(master);
    g.gain.setValueAtTime(1.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  }

  // Short punchy synth stab chord
  function stab(t, freqs) {
    freqs.forEach(freq => {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.value = 2800; f.Q.value = 3;
      o.connect(f); f.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.11, t); g.gain.exponentialRampToValueAtTime(0.001, t + B * 0.35);
      o.start(t); o.stop(t + B * 0.36);
    });
  }

  // Detuned square lead (two oscs slightly apart for width)
  function lead(t, freq, dur) {
    [0, 3].forEach(detune => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = freq * (1 + detune * 0.001);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.065, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);
    });
  }

  // Deep sine sub-bass
  function subBass(t, freq, dur) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  }

  // Slow-attack pad chord for atmosphere
  function pad(t, freqs, dur) {
    freqs.forEach(freq => {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 1;
      o.connect(f); f.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.038, t + B);
      g.gain.setValueAtTime(0.038, t + dur - B * 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  // Rimshot accent (sharp noise hit)
  function rimshot(t) {
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(0.06); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.5;
    s.connect(bp); bp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.start(t); s.stop(t + 0.07);
  }

  // B minor chords: Bm [246.94,293.66,369.99] | Em [164.81,196.00,246.94] | F#m [185.00,220.00,277.18] | A [220.00,261.63,329.63]
  const CHORD_PROG = [
    [246.94, 293.66, 369.99], // Bm
    [246.94, 293.66, 369.99], // Bm
    [164.81, 196.00, 246.94], // Em
    [220.00, 261.63, 329.63], // A
  ];

  const LEAD_A = [
    493.88, 587.33, 659.26, 739.99, 659.26, 587.33, 493.88, 440.00,
    493.88, 659.26, 739.99, 880.00, 739.99, 659.26, 587.33, 493.88,
  ];
  const LEAD_B = [
    440.00, 493.88, 587.33, 659.26, 587.33, 493.88, 440.00, 369.99,
    440.00, 493.88, 523.25, 587.33, 523.25, 493.88, 440.00, 369.99,
  ];
  const LEAD_C = [
    329.63, 369.99, 440.00, 493.88, 587.33, 659.26, 587.33, 493.88,
    440.00, 369.99, 329.63, 293.66, 329.63, 369.99, 440.00, 493.88,
  ];

  // B minor: B=61.74/123.47/246.94 D=73.42/146.83/293.66 F#=92.50/185/369.99
  //          A=110/220/440 E=82.41/164.81/329.63
  function scheduleBar(t, n) {
    const section   = Math.floor(n / 16);        // section changes every 16 bars
    const barInSec  = n % 16;
    const isBreak   = barInSec >= 14;            // 2-bar breakdown at section end
    const isBuild   = barInSec === 12 || barInSec === 13;

    // 4-on-the-floor kick (drop out during breakdown)
    if (!isBreak) {
      for (let i = 0; i < 4; i++) kick(t + i * B);
    }

    // Clap on 2 and 4
    clap(t + B); clap(t + 3 * B);

    // Extra rimshot accents during build
    if (isBuild) {
      rimshot(t + 0.5 * B); rimshot(t + 1.5 * B);
      rimshot(t + 2.5 * B); rimshot(t + 3.5 * B);
    }

    // 16th-note hats (busier during build)
    for (let i = 0; i < 16; i++) {
      if (i === 6 || i === 14) openHat(t + i * S);
      else {
        const v = isBuild
          ? (i % 2 === 0 ? 0.6 : 0.3)
          : (i % 4 === 0 ? 0.55 : i % 2 === 0 ? 0.3 : 0.14);
        hat(t + i * S, v);
      }
    }

    // Sub-bass pattern (one octave below bass)
    [
      [0, 30.87, 0.4], [1, 30.87, 0.4], [1.5, 46.25, 0.5],
      [2, 41.20, 0.4], [3, 30.87, 0.4], [3.5, 46.25, 0.3],
    ].forEach(([dt, f, d]) => subBass(t + dt * B, f, d * B));

    // Driving bass: 16th-note pattern in B minor
    [
      [0, 61.74, 0.20], [0.5, 61.74, 0.13], [0.75, 73.42, 0.13],
      [1,  61.74, 0.20], [1.5, 92.50, 0.25],
      [2,  82.41, 0.20], [2.5, 73.42, 0.13], [2.75, 61.74, 0.13],
      [3,  61.74, 0.20], [3.5, 92.50, 0.13], [3.75, 82.41, 0.13],
    ].forEach(([dt, f, d]) => bass(t + dt * B, f, d * B));

    // Stab chords — cycle through progression every 2 bars
    if (n % 2 === 1) {
      const chord = CHORD_PROG[Math.floor(n / 2) % CHORD_PROG.length];
      stab(t + 1.5 * B, chord);
      stab(t + 3.5 * B, chord);
    }

    // Pad chord every 4 bars for atmosphere
    if (n % 4 === 0) {
      const pChord = CHORD_PROG[Math.floor(n / 4) % CHORD_PROG.length].map(f => f / 2);
      pad(t, pChord, B * 3.6);
    }

    // 16th-note synth lead — rotates through three patterns every 8 bars
    const leadIdx = Math.floor(barInSec / 8) + (section % 3);
    const LEAD = [LEAD_A, LEAD_B, LEAD_C][leadIdx % 3];
    const leadVol = isBreak ? 0.5 : 1.0;
    for (let i = 0; i < 16; i++) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = LEAD[i];
      o.connect(g); g.connect(master);
      const lt = t + i * S;
      g.gain.setValueAtTime(0.065 * leadVol, lt);
      g.gain.exponentialRampToValueAtTime(0.001, lt + S * 0.6);
      o.start(lt); o.stop(lt + S * 0.65);
    }
  }

  function pump() {
    if (!running) return;
    while (nextBar < ac.currentTime + 0.8) { scheduleBar(nextBar, barNum++); nextBar += B * 4; }
    setTimeout(pump, 200);
  }

  return {
    start() {
      if (running) return;
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.32;
      master.connect(ac.destination);
      running = true; barNum = 0; nextBar = ac.currentTime + 0.05;
      pump();
    },
    stop()  { running = false; if (ac) { ac.close(); ac = null; } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.32;
      const btn = document.getElementById('mute-btn');
      if (btn) btn.textContent = muted ? '♪ OFF' : '♪ ON';
    },
  };
})();
