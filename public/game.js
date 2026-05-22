import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Constants ──────────────────────────────────────────────────────────────
const TRAIL_H = 1.5;
const CAM_H   = 0.55;

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
let players   = {};
let lastTick  = 0;
let tickMs    = 80;
let gameActive = false;
let trailOn   = true;
let camAngleY = 0;

// ── Camera + bike interpolation ────────────────────────────────────────────
function updateScene() {
  const t = Math.min(1, (performance.now() - lastTick) / tickMs);

  for (const [id, p] of Object.entries(players)) {
    if (!p.alive) continue;

    const wx = p.prevX + (p.targetX - p.prevX) * t;
    const wz = p.prevZ + (p.targetZ - p.prevZ) * t;

    if (id === myId) {
      // First-person camera
      camera.position.set(wx, CAM_H, wz);

      // Smooth camera rotation — fast lerp (0.8/frame ≈ snaps in ~30 ms)
      const target = CAM_ANGLE[p.dir] ?? camAngleY;
      let diff = target - camAngleY;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      camAngleY += diff * 0.8;
      camera.rotation.y = camAngleY;
    } else {
      // Interpolate other bikes smoothly too
      p.mesh.position.set(wx, 0, wz);
    }
  }
}

// ── Socket.io ──────────────────────────────────────────────────────────────
const socket = io();

socket.on('room-created',  d   => showWaiting(d, true));
socket.on('room-joined',   d   => showWaiting(d, false));
socket.on('room-error',    msg => { document.getElementById('lobby-error').textContent = msg; });
socket.on('lobby-update',  d   => refreshPlayerList(d.players));

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
    } else if (pd.id !== myId) {
      p.mesh.rotation.y = BIKE_ROT[pd.dir];
    }
  }

  lastTick = now;
});

socket.on('trail-status', ({ active }) => {
  trailOn = active;
  updateTrailBtn();
});

socket.on('game-over', data => {
  gameActive = false;
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
  document.getElementById('end-screen').style.display = 'flex';
});

// ── Game init ──────────────────────────────────────────────────────────────
function startGame(data) {
  // Clear previous scene objects
  while (scene.children.length) scene.remove(scene.children[0]);
  buildArena(data.gridSize);

  players  = {};
  lastTick = performance.now();

  for (const pd of data.players) {
    const mesh = createBike(pd.color);
    mesh.position.set(pd.x, 0, pd.y);
    mesh.rotation.y = BIKE_ROT[pd.dir];
    mesh.visible = pd.id !== myId; // hide own bike (first-person)
    scene.add(mesh);

    if (pd.id === myId) {
      // Snap camera to starting angle — no lerp from stale state
      camAngleY = CAM_ANGLE[pd.dir];
      camera.rotation.y = camAngleY;
    }

    players[pd.id] = {
      color: pd.color, dir: pd.dir, serverDir: pd.dir,
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

  updateTrailBtn();
  document.getElementById('lobby').style.display          = 'none';
  document.getElementById('waiting-room').style.display   = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('end-screen').style.display     = 'none';
  gameActive = true;
}

// ── Input ──────────────────────────────────────────────────────────────────
const KEY_MAP = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
  W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
};

document.addEventListener('keydown', e => {
  if (e.repeat) return; // block key-hold repeats

  if (e.key === 'm' || e.key === 'M') { music.toggleMute(); return; }

  if (e.key === ' ' && gameActive) {
    e.preventDefault();
    socket.emit('toggle-trail');
    return;
  }

  const dir = KEY_MAP[e.key];
  if (!dir || !gameActive) return;
  e.preventDefault();

  const me = players[myId];
  if (!me || !me.alive) return;

  // Use server-confirmed direction for the 180° reverse guard
  if (dir === OPP[me.serverDir || me.dir]) return;

  me.dir = dir; // local prediction — camera responds immediately
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

// ── Music (128 BPM, B minor — End of Line vibe) ────────────────────────────
const music = (() => {
  let ac = null, master = null, running = false, muted = false, nextBar = 0;
  const B = 60 / 128;

  function noise(s) {
    const n = Math.ceil(ac.sampleRate * s);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(master);
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(0.001, t + 0.35);
    g.gain.setValueAtTime(3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.start(t); o.stop(t + 0.36);
  }
  function snare(t) {
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(0.18); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.7;
    s.connect(bp); bp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.start(t); s.stop(t + 0.19);
  }
  function hihat(t, v) {
    const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise(0.05); hp.type = 'highpass'; hp.frequency.value = 9000;
    s.connect(hp); hp.connect(g); g.connect(master);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.start(t); s.stop(t + 0.05);
  }
  function bass(t, freq, dur) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur);
    o.connect(f); f.connect(g); g.connect(master);
    g.gain.setValueAtTime(1.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  }
  function arp(t, freq, dur) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = freq;
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  }
  function scheduleBar(t) {
    for (let i = 0; i < 4; i++) kick(t + i * B);
    snare(t + B); snare(t + 3 * B);
    for (let i = 0; i < 16; i++) hihat(t + i * B / 4, i % 4 === 0 ? 0.4 : i % 2 === 0 ? 0.25 : 0.12);
    [[0, 61.74], [1, 73.42], [2, 92.50], [2.5, 82.41], [3, 73.42], [3.5, 61.74]]
      .forEach(([dt, f]) => bass(t + dt * B, f, B * 0.42));
    const A = [246.94, 293.66, 369.99, 440, 246.94, 369.99, 440, 523.25,
               246.94, 293.66, 369.99, 440, 523.25, 440,    369.99, 293.66];
    for (let i = 0; i < 16; i++) arp(t + i * B / 4, A[i], B / 4 * 0.65);
  }
  function pump() {
    if (!running) return;
    while (nextBar < ac.currentTime + 0.8) { scheduleBar(nextBar); nextBar += B * 4; }
    setTimeout(pump, 200);
  }
  return {
    start() {
      if (running) return;
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.35;
      master.connect(ac.destination);
      running = true; nextBar = ac.currentTime + 0.05;
      pump();
    },
    stop()  { running = false; if (ac) { ac.close(); ac = null; } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
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
document.getElementById('mute-btn').addEventListener('click',        () => music.toggleMute());
document.getElementById('play-again-btn').addEventListener('click',  () => {
  document.getElementById('end-screen').style.display     = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('lobby').style.display          = 'flex';
  gameActive = false;
  myId = null;
});

// ── Render loop ────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  if (gameActive) updateScene();
  composer.render();
}
animate();
