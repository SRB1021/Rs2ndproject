import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Must match server COLORS array exactly
const COLORS = ['#00e5ff', '#ff1744', '#ffea00', '#00e676'];

// ── Constants ──────────────────────────────────────────────────────────────
const TRAIL_H     = 1.5;
const CAM_H       = 0.55;
const BIRDS_EYE_H = 30;

// Camera faces -Z by default. These Y-rotations point it toward each direction.
const CAM_ANGLE = { UP: 0, RIGHT: -Math.PI / 2, DOWN: Math.PI, LEFT: Math.PI / 2 };
const BIKE_ROT  = { UP: 0, RIGHT: -Math.PI / 2, DOWN: Math.PI, LEFT: Math.PI / 2 };
const OPP       = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

// ── Renderer ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010108);
scene.fog = new THREE.Fog(0x010108, 14, 75);

// FPS camera — YXZ order prevents gimbal lock for first-person
const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
camera.rotation.x = -0.05; // subtle downward tilt

// Bloom — gives all neon objects the TRON glow
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 1.5, 0.5, 0.05
);
composer.addPass(bloom);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ── TRON Legacy bike model ─────────────────────────────────────────────────
function createBike(hexColor) {
  const group = new THREE.Group();
  const col   = new THREE.Color(hexColor);
  const dark  = () => new THREE.MeshBasicMaterial({ color: 0x060612 });
  const glow  = () => new THREE.MeshBasicMaterial({ color: col });
  const glass = () => new THREE.MeshBasicMaterial({ color: 0x001c38, transparent: true, opacity: 0.9 });

  function part(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
  }

  // Body panels
  part(0.56, 0.13, 1.80, dark(),  0, 0.13,  0);
  part(0.36, 0.17, 1.32, dark(),  0, 0.32,  0.04);
  part(0.28, 0.13, 0.58, glass(), 0, 0.46, -0.10);

  // Glow trim
  part(0.58, 0.022, 1.82, glow(),  0,     0.022, 0);
  part(0.38, 0.022, 1.34, glow(),  0,     0.412, 0.04);
  part(0.022, 0.15, 1.82, glow(), -0.29,  0.13,  0);
  part(0.022, 0.15, 1.82, glow(),  0.29,  0.13,  0);
  part(0.58, 0.15, 0.022, glow(),  0,     0.13, -0.91);
  part(0.58, 0.15, 0.022, glow(),  0,     0.13,  0.91);

  // Wheel disc
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 28), dark());
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, 0.23, 0.1);
  group.add(wheel);

  // Wheel rim glow
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, 28), glow());
  rim.rotation.y = Math.PI / 2;
  rim.position.set(0, 0.23, 0.1);
  group.add(rim);

  // Spokes
  for (let i = 0; i < 4; i++) {
    part(0.014, 0.46, 0.014, glow(), 0, 0.23, 0.1, (i / 4) * Math.PI, 0, 0);
  }

  return group;
}

// ── Trail wall ─────────────────────────────────────────────────────────────
// Thin flat wall, oriented along the direction of travel (TRON Legacy style)
function makeWall(hexColor, dir) {
  const isX = dir === 'RIGHT' || dir === 'LEFT';
  const geo  = new THREE.BoxGeometry(isX ? 1.0 : 0.08, TRAIL_H, isX ? 0.08 : 1.0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hexColor) }));
}

// ── Arena ──────────────────────────────────────────────────────────────────
let GRID = 64;

function buildArena(g) {
  GRID = g;
  const cx = g / 2, cz = g / 2;

  // Floor — plain Three.js API, no Object.assign shortcuts that break Euler
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(g + 2, g + 2),
    new THREE.MeshBasicMaterial({ color: 0x010108 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  scene.add(floor);

  // TRON Legacy grid lines (primary + fine sub-grid)
  function addGrid(step, color) {
    const pts = [];
    const n   = Math.round(g / step);
    for (let i = 0; i <= n; i++) {
      const v = i * step;
      pts.push(v, 0.003, 0,  v, 0.003, g);
      pts.push(0, 0.003, v,  g, 0.003, v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color })));
  }
  addGrid(1,   0x0033bb); // primary
  addGrid(0.5, 0x001155); // sub-grid

  // Border walls
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x0055ff });
  const wh = 3.2;
  [
    [g + 1, wh, 0.1,   cx,       wh / 2, -0.05],
    [g + 1, wh, 0.1,   cx,       wh / 2,  g + 0.05],
    [0.1,   wh, g + 1, -0.05,    wh / 2,  cz],
    [0.1,   wh, g + 1,  g + 0.05, wh / 2, cz],
  ].forEach(([w, h, d, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    scene.add(m);
  });
}

// ── Game state ─────────────────────────────────────────────────────────────
let myId      = null;
let isHost    = false;
let players   = {};
let lastTick  = 0;
let tickMs    = 80;
let gameActive    = false;
let isPaused      = false;
let spectating    = false;
let spectateTarget = null;
let trailOn   = true;
let camAngleY = 0;
let viewMode  = 'first'; // 'first' | 'top'

// ── Camera + bike interpolation ────────────────────────────────────────────
function updateScene() {
  const t = Math.min(1, (performance.now() - lastTick) / tickMs);

  for (const [id, p] of Object.entries(players)) {
    if (!p.alive) continue;

    const wx = p.prevX + (p.targetX - p.prevX) * t;
    const wz = p.prevZ + (p.targetZ - p.prevZ) * t;

    // Camera follows own bike normally; follows spectate target when spectating
    const isCamera = spectating ? (id === spectateTarget) : (id === myId);

    if (isCamera && viewMode === 'first') {
      camera.position.set(wx, CAM_H, wz);
      camera.rotation.x = -0.05;
      camera.rotation.z = 0;
      const target = CAM_ANGLE[p.dir] ?? camAngleY;
      let diff = target - camAngleY;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      camAngleY += diff * 0.8;
      camera.rotation.y = camAngleY;
      // Mesh hidden in first-person (camera IS the bike)
    } else if (isCamera && viewMode === 'top') {
      camera.position.set(wx, BIRDS_EYE_H, wz);
      camera.rotation.x = -Math.PI / 2;
      camera.rotation.y = 0;
      camera.rotation.z = 0;
      p.mesh.position.set(wx, 0, wz);
      p.mesh.rotation.y = BIKE_ROT[p.dir];
    } else {
      p.mesh.position.set(wx, 0, wz);
    }
  }
}

// ── Socket.io ──────────────────────────────────────────────────────────────
const socket = io();

socket.on('room-created',  d   => { isHost = true;  showWaiting(d, true);  });
socket.on('room-joined',   d   => { isHost = false; showWaiting(d, false); });
socket.on('room-error',    msg => { document.getElementById('lobby-error').textContent = msg; });
socket.on('lobby-update',  d   => {
  refreshPlayerList(d.players);
  // When host restarts, bring everyone back to the waiting room
  if (d.state === 'lobby' && !gameActive &&
      document.getElementById('game-container').style.display !== 'none') {
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('end-screen').style.display     = 'none';
    showWaiting(d, isHost);
  }
});

socket.on('game-start', data => {
  myId   = data.myId;
  tickMs = data.tickMs;
  trailOn = true;
  startGame(data);
  music.start();
});

socket.on('tick', data => {
  if (!gameActive) return;
  const now = performance.now();

  for (const pd of data.players) {
    const p = players[pd.id];
    if (!p) continue;

    // Place trail wall at the cell the bike just left
    if (pd.newTrail && p.alive) {
      const wall = makeWall(p.color, pd.dir);
      wall.position.set(pd.newTrail.x, TRAIL_H / 2, pd.newTrail.y);
      scene.add(wall);
      p.trailMeshes.push(wall);
    }

    // ── Smooth corner fix ───────────────────────────────────────────────────
    // On a straight segment: start from current visual position (no jump).
    // On a turn: snap prevX/Z to the exact grid corner — otherwise the
    // interpolation takes a diagonal path through the corner (looks glitchy).
    const turned = p.dir !== pd.dir;
    if (turned) {
      // Bike just turned: align to exact corner before interpolating new dir
      p.prevX = p.targetX;
      p.prevZ = p.targetZ;
    } else {
      // Straight: continue from wherever the camera already is visually
      const tNow = Math.min(1, (now - lastTick) / tickMs);
      p.prevX = p.prevX + (p.targetX - p.prevX) * tNow;
      p.prevZ = p.prevZ + (p.targetZ - p.prevZ) * tNow;
    }

    p.targetX   = pd.x;
    p.targetZ   = pd.y;
    p.dir       = pd.dir;
    p.serverDir = pd.dir;
    p.alive     = pd.alive;

    if (!pd.alive) {
      p.mesh.visible = false;
      document.getElementById('chip-' + pd.id)?.classList.add('dead');
      if (pd.id === myId && !spectating) startSpectating();
      if (pd.id === spectateTarget)       cycleSpectateTarget();
    } else if (pd.id !== myId) {
      p.mesh.rotation.y = BIKE_ROT[pd.dir];
    }
  }

  lastTick = now;
});

socket.on('game-paused', () => {
  isPaused = true;
  document.getElementById('pause-screen').style.display = 'flex';
  document.getElementById('pause-btn').textContent = '▶';
  document.getElementById('mb-pause').textContent  = '▶';
});

socket.on('game-resumed', () => {
  isPaused = false;
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('pause-btn').textContent = '⏸';
  document.getElementById('mb-pause').textContent  = '⏸';
});

socket.on('trail-status', ({ active }) => {
  trailOn = active;
  updateTrailBtn();
});

socket.on('game-over', data => {
  gameActive = false;
  spectating = false; spectateTarget = null;
  document.getElementById('spectate-hud').style.display = 'none';
  music.stop();
  const msg = document.getElementById('end-msg');
  if (data.winner) {
    msg.textContent      = data.winner.id === myId ? 'YOU WIN' : data.winner.name + ' WINS';
    msg.style.color      = data.winner.color;
    msg.style.textShadow = `0 0 20px ${data.winner.color}`;
  } else {
    msg.textContent = 'DRAW';
    msg.style.color = '#aaa';
    msg.style.textShadow = 'none';
  }
  // Show Play Again for host, Leave for guests
  document.getElementById('play-again-btn').style.display = isHost ? 'inline-block' : 'none';
  document.getElementById('leave-btn').style.display      = 'inline-block';
  document.getElementById('end-screen').style.display = 'flex';
});

// ── Game init ──────────────────────────────────────────────────────────────
function startGame(data) {
  while (scene.children.length) scene.remove(scene.children[0]);
  buildArena(data.gridSize);

  viewMode       = 'first';
  spectating     = false;
  spectateTarget = null;
  players   = {};
  lastTick  = performance.now();
  document.getElementById('spectate-hud').style.display = 'none';

  for (const pd of data.players) {
    const mesh = createBike(pd.color);
    mesh.position.set(pd.x, 0, pd.y);
    mesh.rotation.y = BIKE_ROT[pd.dir];
    mesh.visible = pd.id !== myId; // always hide own bike in first-person at start
    scene.add(mesh);

    if (pd.id === myId) {
      camAngleY         = CAM_ANGLE[pd.dir];
      camera.rotation.x = -0.05; // restore downward tilt
      camera.rotation.y = camAngleY;
      camera.rotation.z = 0;
    }

    players[pd.id] = {
      name: pd.name, color: pd.color, dir: pd.dir, serverDir: pd.dir,
      targetX: pd.x, targetZ: pd.y,
      prevX:   pd.x, prevZ:   pd.y,
      mesh, trailMeshes: [], alive: true,
    };
  }

  // Build HUD player chips
  const hp = document.getElementById('hud-players');
  hp.innerHTML = '';
  for (const pd of data.players) {
    const chip = document.createElement('div');
    chip.className = 'hud-chip' + (pd.id === myId ? ' me' : '');
    chip.id = 'chip-' + pd.id;
    chip.style.color = pd.color;
    chip.textContent = (pd.isBot ? '[CPU] ' : '') + pd.name;
    hp.appendChild(chip);
  }

  isPaused = false;
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('pause-btn').textContent = '⏸';
  document.getElementById('mb-pause').textContent  = '⏸';
  document.getElementById('mb-view').textContent   = 'CAM';
  updateTrailBtn();
  document.getElementById('lobby').style.display          = 'none';
  document.getElementById('waiting-room').style.display   = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('end-screen').style.display     = 'none';
  gameActive = true;
}

// ── Input ──────────────────────────────────────────────────────────────────
// Relative turn maps — A/left always turns left from YOUR perspective,
// D/right always turns right, regardless of absolute grid direction.
// (Absolute-direction mapping breaks: A=grid-LEFT is blocked when going RIGHT.)
const TURN_LEFT  = { UP:'LEFT',  LEFT:'DOWN',  DOWN:'RIGHT', RIGHT:'UP'   };
const TURN_RIGHT = { UP:'RIGHT', RIGHT:'DOWN', DOWN:'LEFT',  LEFT:'UP'    };

document.addEventListener('keydown', e => {
  if (e.repeat) return;

  if (e.key === 'm' || e.key === 'M') { music.toggleMute(); return; }

  if (e.key === ' ' && gameActive) { e.preventDefault(); socket.emit('toggle-trail'); return; }

  if ((e.key === 'c' || e.key === 'C') && gameActive) { toggleView(); return; }

  if (e.key === 'p' || e.key === 'P') { if (gameActive) togglePause(); return; }
  if (e.key === 'Tab') { e.preventDefault(); if (spectating) cycleSpectateTarget(); return; }

  if (!gameActive || isPaused) return;
  const me = players[myId];
  if (!me || !me.alive) return;

  const cur = me.serverDir || me.dir;
  let dir = null;

  if      (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dir = TURN_LEFT[cur];
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = TURN_RIGHT[cur];
  else if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dir = cur; // go straight
  // S / ArrowDown: reverse not allowed in TRON — ignore

  if (!dir || dir === cur) return; // no turn needed
  e.preventDefault();

  me.dir = dir; // local prediction so camera responds immediately
  socket.emit('turn', { dir });
});

// ── Trail HUD button ───────────────────────────────────────────────────────
function updateTrailBtn() {
  const btn = document.getElementById('trail-toggle-btn');
  if (!btn) return;
  btn.textContent      = trailOn ? 'TRAIL: ON' : 'TRAIL: OFF';
  btn.style.borderColor = trailOn ? '#00e5ff' : '#ff1744';
  btn.style.color       = trailOn ? '#00e5ff' : '#ff1744';
  btn.style.boxShadow   = trailOn ? '0 0 8px #00e5ff' : '0 0 8px #ff1744';
}

// ── Music (140 BPM techno — 4-on-the-floor, hard bass, synth lead) ──────────
const music = (() => {
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

// ── UI helpers ─────────────────────────────────────────────────────────────
function showWaiting(data, isHost) {
  document.getElementById('lobby').style.display        = 'none';
  document.getElementById('waiting-room').style.display = 'flex';
  document.getElementById('room-code-display').textContent = data.code;
  document.getElementById('start-btn').style.display    = isHost ? 'block' : 'none';
  document.getElementById('waiting-msg').style.display  = isHost ? 'none'  : 'block';
  document.getElementById('bot-controls').style.display = isHost ? 'flex'  : 'none';
  refreshPlayerList(data.players);
}

function refreshPlayerList(list) {
  const ul = document.getElementById('player-list');
  ul.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li');
    li.style.color = p.color;
    li.textContent = (p.isBot ? '[CPU] ' : '') + p.name;
    ul.appendChild(li);
  }
  updateColorSwatches(list);
}

function updateColorSwatches(list) {
  const wrap = document.getElementById('color-swatches');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const hex of COLORS) {
    const owner = list.find(p => p.color === hex);
    const isMe    = owner?.id === socket.id;
    const isTaken = owner && !isMe;

    const div = document.createElement('div');
    div.className = 'color-swatch' + (isMe ? ' mine' : '') + (isTaken ? ' taken' : '');
    div.style.background = hex;
    div.style.setProperty('--sw-color', hex);

    if (isTaken) {
      const label = document.createElement('span');
      label.className = 'swatch-owner';
      label.textContent = owner.name;
      div.appendChild(label);
    }

    if (!isTaken) {
      div.addEventListener('click', () => socket.emit('pick-color', { color: hex }));
    }
    wrap.appendChild(div);
  }
}

// ── Lobby / HUD events ─────────────────────────────────────────────────────
document.getElementById('create-btn').addEventListener('click', () => {
  document.getElementById('lobby-error').textContent = '';
  socket.emit('create-room', { name: document.getElementById('name-input').value.trim() || 'Player' });
});
document.getElementById('join-btn').addEventListener('click', () => {
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  if (!code) { document.getElementById('lobby-error').textContent = 'Enter a room code'; return; }
  document.getElementById('lobby-error').textContent = '';
  socket.emit('join-room', { code, name: document.getElementById('name-input').value.trim() || 'Player' });
});
document.getElementById('code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});
document.getElementById('start-btn').addEventListener('click',       () => socket.emit('start-game'));
document.getElementById('add-bot-btn').addEventListener('click',     () => socket.emit('add-bot'));
document.getElementById('remove-bot-btn').addEventListener('click',  () => socket.emit('remove-bot'));
document.getElementById('trail-toggle-btn').addEventListener('click',() => { if (gameActive) socket.emit('toggle-trail'); });
document.getElementById('pause-btn').addEventListener('click',       () => { if (gameActive) togglePause(); });
document.getElementById('resume-btn').addEventListener('click',      () => togglePause());
document.getElementById('mute-btn').addEventListener('click',        () => music.toggleMute());

// ── Mobile buttons ─────────────────────────────────────────────────────────
// Turn buttons use touchstart (fires on finger-down, not after release)
// e.preventDefault() stops the ~300ms-delayed click from also firing
['mb-left', 'mb-right'].forEach(id => {
  const side = id === 'mb-left' ? 'left' : 'right';
  document.getElementById(id).addEventListener('touchstart', e => {
    e.preventDefault();
    sendRelativeTurn(side);
  }, { passive: false });
  // Fallback for desktop/mouse
  document.getElementById(id).addEventListener('click', () => sendRelativeTurn(side));
});
document.getElementById('mb-trail').addEventListener('click', () => { if (gameActive && !isPaused) socket.emit('toggle-trail'); });
document.getElementById('mb-view').addEventListener('click',  () => { if (gameActive) toggleView(); });
document.getElementById('mb-pause').addEventListener('click', () => { if (gameActive) togglePause(); });

function togglePause() {
  socket.emit(isPaused ? 'resume-game' : 'pause-game');
}

function toggleView() {
  viewMode = viewMode === 'first' ? 'top' : 'first';
  // The "camera subject" is the spectate target when spectating, own bike otherwise
  const subjectId = spectating ? spectateTarget : myId;
  const p = players[subjectId];
  if (p && p.mesh) {
    p.mesh.visible = viewMode === 'top';
    if (viewMode === 'first') {
      camAngleY = CAM_ANGLE[p.dir];
      camera.rotation.y = camAngleY;
      camera.rotation.x = -0.05;
      camera.rotation.z = 0;
    }
  }
  const btn = document.getElementById('mb-view');
  if (btn) btn.textContent = viewMode === 'top' ? '1ST' : 'CAM';
}

// ── Spectator mode ─────────────────────────────────────────────────────────
function startSpectating() {
  const aliveEntry = Object.entries(players).find(([id, p]) => p.alive && id !== myId);
  if (!aliveEntry) return; // no one left to watch — game-over will fire anyway
  spectating = true;
  spectateTarget = aliveEntry[0];
  if (viewMode === 'first') players[spectateTarget].mesh.visible = false;
  camAngleY = CAM_ANGLE[players[spectateTarget].dir];
  updateSpectateHUD();
}

function cycleSpectateTarget() {
  // Restore mesh of previous target (if still alive and in first-person mode)
  if (spectateTarget && players[spectateTarget]?.alive && viewMode === 'first') {
    players[spectateTarget].mesh.visible = true;
  }
  const aliveIds = Object.entries(players)
    .filter(([id, p]) => p.alive && id !== myId)
    .map(([id]) => id);
  if (aliveIds.length === 0) { spectating = false; return; }
  const idx = aliveIds.indexOf(spectateTarget);
  spectateTarget = aliveIds[(idx + 1) % aliveIds.length];
  if (viewMode === 'first') players[spectateTarget].mesh.visible = false;
  camAngleY = CAM_ANGLE[players[spectateTarget].dir];
  updateSpectateHUD();
}

function updateSpectateHUD() {
  const p = players[spectateTarget];
  if (!p) return;
  const hud = document.getElementById('spectate-hud');
  const nameEl = document.getElementById('spectate-name');
  hud.style.display = 'flex';
  nameEl.textContent = 'SPECTATING: ' + p.name;
  nameEl.style.color = p.color;
  nameEl.style.textShadow = `0 0 8px ${p.color}`;
}

function sendRelativeTurn(side) {
  if (!gameActive || isPaused) return;
  const me = players[myId];
  if (!me || !me.alive) return;
  const cur = me.serverDir || me.dir;
  const dir = side === 'left' ? TURN_LEFT[cur] : TURN_RIGHT[cur];
  if (!dir || dir === cur) return;
  me.dir = dir;
  socket.emit('turn', { dir });
}

// ── Swipe controls ─────────────────────────────────────────────────────────
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!gameActive || isPaused) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  if (dist < 30) {
    // Tap: cycle spectate target when dead
    if (spectating) cycleSpectateTarget();
    return;
  }
  // Swipe: turn (only when alive)
  if (!spectating && Math.abs(dx) >= Math.abs(dy)) {
    sendRelativeTurn(dx > 0 ? 'right' : 'left');
  }
}, { passive: true });
document.getElementById('play-again-btn').addEventListener('click', () => {
  // Host restarts: server resets room → triggers lobby-update → all clients see waiting room
  socket.emit('restart-game');
});
document.getElementById('leave-btn').addEventListener('click', () => {
  document.getElementById('end-screen').style.display     = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('lobby').style.display          = 'flex';
  gameActive = false; spectating = false; spectateTarget = null;
  myId = null; isHost = false;
});

// ── Render loop ────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  if (gameActive && !isPaused) updateScene();
  composer.render();
}
animate();
