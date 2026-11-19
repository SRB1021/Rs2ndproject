import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { music }           from './audio.js';

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

// ── Bike models — three styles ─────────────────────────────────────────────
function createBike(hexColor, style = 'blade') {
  if (style === 'tank')    return createTankBike(hexColor);
  if (style === 'speeder') return createSpeederBike(hexColor);
  return createBladeBike(hexColor);
}

function createBladeBike(hexColor) {
  const group = new THREE.Group();
  const col   = new THREE.Color(hexColor);
  const dark  = () => new THREE.MeshBasicMaterial({ color: 0x060612 });
  const glow  = () => new THREE.MeshBasicMaterial({ color: col });
  const glass = () => new THREE.MeshBasicMaterial({ color: 0x001c38, transparent: true, opacity: 0.9 });

  function part(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); group.add(m);
  }

  part(0.56, 0.13, 1.80, dark(),  0, 0.13,  0);
  part(0.36, 0.17, 1.32, dark(),  0, 0.32,  0.04);
  part(0.28, 0.13, 0.58, glass(), 0, 0.46, -0.10);
  part(0.58, 0.022, 1.82, glow(),  0,     0.022, 0);
  part(0.38, 0.022, 1.34, glow(),  0,     0.412, 0.04);
  part(0.022, 0.15, 1.82, glow(), -0.29,  0.13,  0);
  part(0.022, 0.15, 1.82, glow(),  0.29,  0.13,  0);
  part(0.58, 0.15, 0.022, glow(),  0,     0.13, -0.91);
  part(0.58, 0.15, 0.022, glow(),  0,     0.13,  0.91);

  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 28), dark());
  wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.23, 0.1); group.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, 28), glow());
  rim.rotation.y = Math.PI / 2; rim.position.set(0, 0.23, 0.1); group.add(rim);
  for (let i = 0; i < 4; i++) part(0.014, 0.46, 0.014, glow(), 0, 0.23, 0.1, (i / 4) * Math.PI, 0, 0);

  return group;
}

function createTankBike(hexColor) {
  const group = new THREE.Group();
  const col  = new THREE.Color(hexColor);
  const dark = () => new THREE.MeshBasicMaterial({ color: 0x040410 });
  const glow = () => new THREE.MeshBasicMaterial({ color: col });
  const armor= () => new THREE.MeshBasicMaterial({ color: 0x080820 });

  function part(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); group.add(m);
  }

  // Wide armored body
  part(0.95, 0.18, 2.0,  dark(), 0, 0.18, 0);
  part(0.75, 0.22, 1.55, dark(), 0, 0.4,  0);
  // Side armor plates
  part(0.1,  0.42, 1.6, armor(), -0.52, 0.22, 0);
  part(0.1,  0.42, 1.6, armor(),  0.52, 0.22, 0);
  // Cockpit block
  part(0.5,  0.18, 0.55, dark(), 0, 0.6, -0.15);

  // Glow lines — thick and bold
  part(0.97, 0.03, 2.02, glow(),  0,     0.03,   0);    // bottom edge
  part(0.03, 0.44, 2.02, glow(), -0.48,  0.22,   0);    // left edge
  part(0.03, 0.44, 2.02, glow(),  0.48,  0.22,   0);    // right edge
  part(0.97, 0.03, 0.03, glow(),  0,     0.44,  -1.0);  // front top
  part(0.97, 0.03, 0.03, glow(),  0,     0.44,   1.0);  // back top

  // Two wheels (front and back)
  for (const wz of [-0.55, 0.65]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 24), dark());
    w.rotation.z = Math.PI / 2; w.position.set(0, 0.26, wz); group.add(w);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 8, 24), glow());
    r.rotation.y = Math.PI / 2; r.position.set(0, 0.26, wz); group.add(r);
  }

  return group;
}

function createSpeederBike(hexColor) {
  const group = new THREE.Group();
  const col  = new THREE.Color(hexColor);
  const dark = () => new THREE.MeshBasicMaterial({ color: 0x060614 });
  const glow = () => new THREE.MeshBasicMaterial({ color: col });

  function part(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx; group.add(m);
  }

  // Ultra-slim fuselage, lifted
  part(0.22, 0.09, 2.1, dark(), 0, 0.35, 0);
  part(0.14, 0.07, 1.6, dark(), 0, 0.44, 0);

  // Glow trim
  part(0.24, 0.015, 2.12, glow(),  0,     0.31, 0);    // belly glow
  part(0.015, 0.1, 2.12, glow(), -0.12,  0.38, 0);    // left side
  part(0.015, 0.1, 2.12, glow(),  0.12,  0.38, 0);    // right side
  part(0.24, 0.015, 0.015, glow(), 0,     0.44,-1.05); // nose glow

  // Rear wing (horizontal spoiler)
  part(0.9, 0.025, 0.28, dark(), 0, 0.52, 0.85);
  part(0.9, 0.015, 0.28, glow(), 0, 0.54, 0.85);

  // Single wheel (front)
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.055, 24), dark());
  w.rotation.z = Math.PI / 2; w.position.set(0, 0.19, -0.75); group.add(w);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 8, 24), glow());
  r.rotation.y = Math.PI / 2; r.position.set(0, 0.19, -0.75); group.add(r);

  // Rear engine nozzle glow
  part(0.18, 0.06, 0.08, glow(), 0, 0.36, 1.1);

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

  scene.fog = new THREE.Fog(0x010108, 20, 110);

  // ── Main floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(g + 36, g + 36),
    new THREE.MeshBasicMaterial({ color: 0x010108 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  scene.add(floor);

  // ── Grid lines (main arena)
  function addGrid(step, color) {
    const pts = [];
    const n = Math.round(g / step);
    for (let i = 0; i <= n; i++) {
      const v = i * step;
      pts.push(v, 0.003, 0, v, 0.003, g);
      pts.push(0, 0.003, v, g, 0.003, v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color })));
  }
  addGrid(1,   0x0033bb);
  addGrid(0.5, 0x001155);

  // ── Tall arena border walls
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x010115 });
  const wh = 14;
  function addWall(w, h, d, x, y, z) {
    scene.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat), { position: new THREE.Vector3(x, y, z) }));
  }
  addWall(g + 1, wh, 0.12,   cx,        wh/2, -0.06);
  addWall(g + 1, wh, 0.12,   cx,        wh/2,  g + 0.06);
  addWall(0.12,  wh, g + 1,  -0.06,     wh/2,  cz);
  addWall(0.12,  wh, g + 1,   g + 0.06, wh/2,  cz);

  // Wall glow lines (top + base)
  function seg(pts, col) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col })));
  }
  seg([0,wh,0, g,wh,0], 0x0055ff); seg([0,wh,g, g,wh,g], 0x0055ff);
  seg([0,wh,0, 0,wh,g], 0x0055ff); seg([g,wh,0, g,wh,g], 0x0055ff);
  seg([0,0.01,0, g,0.01,0], 0x0033aa); seg([0,0.01,g, g,0.01,g], 0x0033aa);
  seg([0,0.01,0, 0,0.01,g], 0x0033aa); seg([g,0.01,0, g,0.01,g], 0x0033aa);

  // ── Elevated side platforms (TRON Legacy upper tier)
  const platH   = 6;
  const platW   = 11;
  const platCxL = -(platW / 2 + 2);    // left platform center X
  const platCxR =  g + platW / 2 + 2;  // right platform center X
  const platMat = new THREE.MeshBasicMaterial({ color: 0x010110 });

  function addBox(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  addBox(platW, 0.3, g + 2, platCxL, platH, cz, platMat);
  addBox(platW, 0.3, g + 2, platCxR, platH, cz, platMat);

  // Platform grid lines
  function addPlatGrid(cxPlat, col) {
    const pts = [];
    const nSteps = Math.round((g + 2) / 4);
    for (let i = 0; i <= nSteps; i++) {
      const v = -1 + i * 4;
      pts.push(cxPlat - platW/2, platH+0.16, v, cxPlat + platW/2, platH+0.16, v);
    }
    seg(pts, col);
  }
  addPlatGrid(platCxL, 0x002288);
  addPlatGrid(platCxR, 0x002288);

  // Platform inner edge glow
  seg([platCxL+platW/2, platH+0.16, 0, platCxL+platW/2, platH+0.16, g], 0x0044cc);
  seg([platCxR-platW/2, platH+0.16, 0, platCxR-platW/2, platH+0.16, g], 0x0044cc);
  seg([platCxL-platW/2, platH+0.16, 0, platCxL-platW/2, platH+0.16, g], 0x002299);
  seg([platCxR+platW/2, platH+0.16, 0, platCxR+platW/2, platH+0.16, g], 0x002299);

  // ── Ramps from ground (y=0) to platforms (y=platH)
  const rampRun = 9;
  const rampLen = Math.sqrt(rampRun * rampRun + platH * platH);
  const rampAng = Math.atan2(platH, rampRun);

  function addRamp(px, frontOfArena) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(platW, 0.28, rampLen), platMat);
    ramp.rotation.x = frontOfArena ? -rampAng : rampAng;
    // Center of ramp sits midway between y=0 and y=platH
    ramp.position.set(px, platH / 2, frontOfArena ? -rampRun / 2 : g + rampRun / 2);
    scene.add(ramp);
  }
  addRamp(platCxL, true);  addRamp(platCxL, false);
  addRamp(platCxR, true);  addRamp(platCxR, false);

  // ── Support columns under platforms
  const nCols = Math.max(3, Math.round(g / 18));
  const colMat = new THREE.MeshBasicMaterial({ color: 0x020218 });
  for (let i = 0; i < nCols; i++) {
    const colZ = 2 + (i / (nCols - 1)) * (g - 4);
    for (const colX of [platCxL, platCxR]) {
      const col = addBox(0.5, platH, 0.5, colX, platH / 2, colZ, colMat);
      const lineGeo = new THREE.EdgesGeometry(col.geometry);
      const line = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x002299 }));
      line.position.copy(col.position);
      scene.add(line);
    }
  }

  // ── Corner towers
  const tH = 22;
  const towerMat = new THREE.MeshBasicMaterial({ color: 0x010108 });
  for (const [tx, tz] of [[-1.5,-1.5],[g+1.5,-1.5],[-1.5,g+1.5],[g+1.5,g+1.5]]) {
    const tw = addBox(1.6, tH, 1.6, tx, tH / 2, tz, towerMat);
    const te = new THREE.LineSegments(
      new THREE.EdgesGeometry(tw.geometry),
      new THREE.LineBasicMaterial({ color: 0x0055ff })
    );
    te.position.copy(tw.position);
    scene.add(te);
  }

  // ── Overhead light bridges across the arena at wall height
  const nBridges = Math.max(3, Math.round(g / 20));
  const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x0033aa });
  for (let i = 1; i < nBridges; i++) {
    const bz = (i / nBridges) * g;
    addBox(g + 30, 0.1, 0.09, cx, wh, bz, bridgeMat);
  }
}

// ── Game state ─────────────────────────────────────────────────────────────
let myId        = null;
let myBikeStyle = 'blade';
let isHost      = false;
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
  updateGridSizeUI(d.gridSize || 64, isHost);
  const me = d.players.find(p => p.id === socket.id);
  if (me) { myBikeStyle = me.bikeStyle || 'blade'; updateBikeStyleUI(myBikeStyle); }
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

socket.on('countdown', ({ count }) => {
  const overlay = document.getElementById('countdown-overlay');
  const num     = document.getElementById('countdown-num');
  overlay.style.display = 'flex';
  num.textContent = count;
  // Re-trigger animation
  num.style.animation = 'none';
  num.offsetHeight; // reflow
  num.style.animation = '';
});

socket.on('game-resumed', () => {
  isPaused = false;
  document.getElementById('pause-screen').style.display   = 'none';
  document.getElementById('countdown-overlay').style.display = 'none';
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
    const mesh = createBike(pd.color, pd.bikeStyle || 'blade');
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

  // A/D = relative turn (left/right from your facing direction) in both views.
  // W/S = absolute grid UP/DOWN in both views — intuitive in bird's eye,
  //       and still useful in first-person as "steer toward north/south".
  // Pressing the exact opposite of current direction is always blocked.
  if      (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') dir = TURN_LEFT[cur];
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = TURN_RIGHT[cur];
  else if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') dir = 'UP';
  else if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') dir = 'DOWN';

  if (!dir || dir === cur || dir === OPP[cur]) return; // no turn or reversal
  e.preventDefault();

  me.dir = dir;
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

// ── UI helpers ─────────────────────────────────────────────────────────────
function showWaiting(data, host) {
  document.getElementById('lobby').style.display        = 'none';
  document.getElementById('waiting-room').style.display = 'flex';
  document.getElementById('room-code-display').textContent = data.code;
  document.getElementById('start-btn').style.display    = host ? 'block' : 'none';
  document.getElementById('waiting-msg').style.display  = host ? 'none'  : 'block';
  document.getElementById('bot-controls').style.display = host ? 'flex'  : 'none';
  document.getElementById('grid-size-picker').style.display = host ? 'block' : 'none';
  document.getElementById('grid-size-display').style.display = host ? 'none' : 'block';
  updateGridSizeUI(data.gridSize || 64, host);
  // Find my bike style from player list
  const me = data.players.find(p => p.id === socket.id);
  if (me) { myBikeStyle = me.bikeStyle || 'blade'; }
  updateBikeStyleUI(myBikeStyle);
  refreshPlayerList(data.players);
}

function updateBikeStyleUI(style) {
  document.querySelectorAll('.bike-style-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === style);
  });
}

function updateGridSizeUI(size, host) {
  // Update active button for host
  document.querySelectorAll('.grid-size-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.size) === size);
  });
  // Update label for guests
  const label = size === 64 ? 'Small' : size === 96 ? 'Medium' : 'Large';
  document.getElementById('grid-size-display').textContent = `Grid: ${label}`;
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
document.querySelectorAll('.grid-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('set-grid-size', { size: Number(btn.dataset.size) });
  });
});
document.querySelectorAll('.bike-style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('set-bike-style', { style: btn.dataset.style });
  });
});
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
