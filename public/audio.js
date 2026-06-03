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

  // B minor: B=61.74/123.47/246.94 D=73.42/146.83/293.66 F#=92.50/185/369.99
  //          A=110/220/440 E=82.41/164.81/329.63
  function scheduleBar(t, n) {
    // 4-on-the-floor kick
    for (let i = 0; i < 4; i++) kick(t + i * B);

    // Clap on 2 and 4
    clap(t + B); clap(t + 3 * B);

    // 16th-note hats + open hat on offbeats
    for (let i = 0; i < 16; i++) {
      if (i === 6 || i === 14) openHat(t + i * S);
      else hat(t + i * S, i % 4 === 0 ? 0.55 : i % 2 === 0 ? 0.3 : 0.14);
    }

    // Driving bass: 16th-note pattern in B minor
    [
      [0, 61.74, 0.20], [0.5, 61.74, 0.13], [0.75, 73.42, 0.13],
      [1,  61.74, 0.20], [1.5, 92.50, 0.25],
      [2,  82.41, 0.20], [2.5, 73.42, 0.13], [2.75, 61.74, 0.13],
      [3,  61.74, 0.20], [3.5, 92.50, 0.13], [3.75, 82.41, 0.13],
    ].forEach(([dt, f, d]) => bass(t + dt * B, f, d * B));

    // Stab chords on the "and" of every other bar (adds energy)
    if (n % 2 === 1) {
      stab(t + 1.5 * B, [246.94, 293.66, 369.99]);
      stab(t + 3.5 * B, [246.94, 293.66, 369.99]);
    }

    // 16th-note synth lead (B minor scale, ascending + descending pattern)
    const LEAD = [
      493.88, 587.33, 659.26, 739.99, 659.26, 587.33, 493.88, 440.00,
      493.88, 659.26, 739.99, 880.00, 739.99, 659.26, 587.33, 493.88,
    ];
    for (let i = 0; i < 16; i++) lead(t + i * S, LEAD[i], S * 0.6);
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
