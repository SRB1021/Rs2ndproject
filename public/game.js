import * as THREE from 'three';

// ── Constants ──────────────────────────────────────────────────────────────
const TRAIL_H  = 1.6;  // height of light-wall trails
const CAM_H    = 0.55; // cockpit eye height
const FOG_NEAR = 6;
const FOG_FAR  = 55;

const DIR_VEC = {
  RIGHT: new THREE.Vector3( 1, 0,  0),
  LEFT:  new THREE.Vector3(-1, 0,  0),
  DOWN:  new THREE.Vector3( 0, 0,  1),  // grid y+ → world z+
  UP:    new THREE.Vector3( 0, 0, -1),
};
const OPP = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };

// ── Three.js setup ─────────────────────────────────────────────────────────
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x030310);
scene.fog = new THREE.Fog(0x030310, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 200);

window.addEventListener('resize', resize);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resize();

// ── Scene geometry ─────────────────────────────────────────────────────────
let GRID = 64; // updated on game-start

function buildArena(g) {
  GRID = g;
  const half = g / 2;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(g, g),
    new THREE.MeshBasicMaterial({ color: 0x02020e })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(half, 0, half);
  scene.add(floor);

  // Grid lines on floor
  const gridHelper = new THREE.GridHelper(g, g, 0x0a0a22, 0x0a0a22);
  gridHelper.position.set(half, 0.005, half);
  scene.add(gridHelper);

  // Border walls (4 sides), glowing blue
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x0055ff });
  const wh = 2.5;
  const walls = [
    // top (z=0)
    { pos: [half, wh/2, -0.05], geo: [g + 0.1, wh, 0.1] },
    // bottom (z=g)
    { pos: [half, wh/2, g + 0.05], geo: [g + 0.1, wh, 0.1] },
    // left (x=0)
    { pos: [-0.05, wh/2, half], geo: [0.1, wh, g + 0.1] },
    // right (x=g)
    { pos: [g + 0.05, wh/2, half], geo: [0.1, wh, g + 0.1] },
  ];
  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.geo), wallMat);
    mesh.position.set(...w.pos);
    scene.add(mesh);
  }
}

// Shared geometry for trail segments and bike heads
const trailGeo = new THREE.BoxGeometry(0.92, TRAIL_H, 0.92);
const bikeGeo  = new THREE.BoxGeometry(0.6, 0.4, 0.9);

function makeColor(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

// ── Game state ─────────────────────────────────────────────────────────────
let myId    = null;
let players = {};   // id → { color, dir, x, y, mesh, trailMats[], trailMeshes[], alive, prevX, prevZ, targetX, targetZ }
let lastTick     = 0;
let tickMs       = 100;
let gameActive   = false;

function gx(x) { return x; }          // grid → world x (1:1)
function gz(y) { return y; }          // grid y → world z (1:1)

// ── Camera ─────────────────────────────────────────────────────────────────
const _camLook = new THREE.Vector3();
function updateCamera() {
  const me = players[myId];
  if (!me) return;

  // Interpolate position between ticks for smooth motion
  const t = Math.min(1, (performance.now() - lastTick) / tickMs);
  const wx = me.prevX + (me.targetX - me.prevX) * t;
  const wz = me.prevZ + (me.targetZ - me.prevZ) * t;

  camera.position.set(wx, CAM_H, wz);
  const dv = DIR_VEC[me.dir];
  _camLook.set(wx + dv.x * 10, CAM_H * 0.6, wz + dv.z * 10);
  camera.lookAt(_camLook);
}

// ── Trail management ───────────────────────────────────────────────────────
function addTrail(player, x, z) {
  const mat = new THREE.MeshBasicMaterial({
    color: makeColor(player.color),
    transparent: true,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(trailGeo, mat);
  mesh.position.set(x, TRAIL_H / 2, z);
  scene.add(mesh);
  player.trailMeshes.push(mesh);
}

// ── Socket.io ──────────────────────────────────────────────────────────────
const socket = io();

socket.on('room-created', data => {
  showWaiting(data, true);
});

socket.on('room-joined', data => {
  showWaiting(data, false);
});

socket.on('room-error', msg => {
  document.getElementById('lobby-error').textContent = msg;
});

socket.on('lobby-update', data => {
  refreshPlayerList(data.players);
});

socket.on('game-start', data => {
  myId   = data.myId;
  tickMs = data.tickMs;
  initGame(data);
});

socket.on('tick', data => {
  if (!gameActive) return;
  lastTick = performance.now();

  for (const pd of data.players) {
    const p = players[pd.id];
    if (!p) continue;

    // Plant trail segment at the cell the bike just left
    if (pd.newTrail && p.alive) {
      addTrail(p, gx(pd.newTrail.x), gz(pd.newTrail.y));
    }

    p.prevX    = p.targetX;
    p.prevZ    = p.targetZ;
    p.targetX  = gx(pd.x);
    p.targetZ  = gz(pd.y);
    p.dir      = pd.dir;
    p.alive    = pd.alive;

    if (!pd.alive) {
      p.mesh.visible = false;
      const chip = document.getElementById('chip-' + pd.id);
      if (chip) chip.classList.add('dead');
    } else if (pd.id !== myId) {
      p.mesh.position.set(p.targetX, 0.3, p.targetZ);
    }
  }
});

socket.on('game-over', data => {
  gameActive = false;
  const endMsg = document.getElementById('end-msg');
  if (data.winner) {
    if (data.winner.id === myId) {
      endMsg.textContent = 'YOU WIN';
      endMsg.style.color = '#00ffcc';
      endMsg.style.textShadow = '0 0 20px #00ffcc';
    } else {
      endMsg.textContent = data.winner.name + ' wins';
      endMsg.style.color = data.winner.color;
      endMsg.style.textShadow = `0 0 20px ${data.winner.color}`;
    }
  } else {
    endMsg.textContent = 'DRAW';
    endMsg.style.color = '#aaa';
    endMsg.style.textShadow = 'none';
  }
  document.getElementById('end-screen').style.display = 'flex';
});

// ── Game init ──────────────────────────────────────────────────────────────
function initGame(data) {
  // Clear old scene objects
  for (const id in players) {
    const p = players[id];
    scene.remove(p.mesh);
    for (const m of p.trailMeshes) scene.remove(m);
  }
  // Remove old arena objects (floor, walls, grid) if rebuilding
  // Simple: just rebuild whole scene
  while (scene.children.length) scene.remove(scene.children[0]);

  buildArena(data.gridSize);

  players = {};
  lastTick = performance.now();

  for (const pd of data.players) {
    const col = makeColor(pd.color);
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const mesh = new THREE.Mesh(bikeGeo, mat);
    mesh.position.set(gx(pd.x), 0.3, gz(pd.y));
    if (pd.id === myId) mesh.visible = false; // first-person — hide own bike
    scene.add(mesh);

    players[pd.id] = {
      color:       pd.color,
      dir:         pd.dir,
      x:           pd.x,
      y:           pd.y,
      targetX:     gx(pd.x),
      targetZ:     gz(pd.y),
      prevX:       gx(pd.x),
      prevZ:       gz(pd.y),
      mesh,
      trailMeshes: [],
      alive:       true,
    };
  }

  // HUD
  const hudPlayers = document.getElementById('hud-players');
  hudPlayers.innerHTML = '';
  for (const pd of data.players) {
    const chip = document.createElement('div');
    chip.className = 'hud-chip' + (pd.id === myId ? ' me' : '');
    chip.id = 'chip-' + pd.id;
    chip.style.color = pd.color;
    chip.textContent = pd.name;
    hudPlayers.appendChild(chip);
  }

  document.getElementById('lobby').style.display        = 'none';
  document.getElementById('waiting-room').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  document.getElementById('end-screen').style.display   = 'none';

  gameActive = true;
}

// ── Input ──────────────────────────────────────────────────────────────────
const KEY_MAP = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
  W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
};

document.addEventListener('keydown', e => {
  const dir = KEY_MAP[e.key];
  if (!dir || !gameActive) return;
  e.preventDefault();

  const me = players[myId];
  if (!me || !me.alive || dir === OPP[me.dir]) return;
  me.dir = dir; // local prediction for camera smoothness
  socket.emit('turn', { dir });
});

// ── UI helpers ─────────────────────────────────────────────────────────────
function showWaiting(data, isHost) {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('waiting-room').style.display = 'flex';
  document.getElementById('room-code-display').textContent = data.code;
  document.getElementById('start-btn').style.display  = isHost ? 'block' : 'none';
  document.getElementById('waiting-msg').style.display = isHost ? 'none'  : 'block';
  refreshPlayerList(data.players);
}

function refreshPlayerList(list) {
  const ul = document.getElementById('player-list');
  ul.innerHTML = '';
  for (const p of list) {
    const li = document.createElement('li');
    li.style.color = p.color;
    li.textContent = p.name;
    ul.appendChild(li);
  }
}

// ── Lobby button events ────────────────────────────────────────────────────
document.getElementById('create-btn').addEventListener('click', () => {
  const name = document.getElementById('name-input').value.trim() || 'Player';
  document.getElementById('lobby-error').textContent = '';
  socket.emit('create-room', { name });
});

document.getElementById('join-btn').addEventListener('click', () => {
  const name = document.getElementById('name-input').value.trim() || 'Player';
  const code = document.getElementById('code-input').value.trim().toUpperCase();
  if (!code) { document.getElementById('lobby-error').textContent = 'Enter a room code'; return; }
  document.getElementById('lobby-error').textContent = '';
  socket.emit('join-room', { code, name });
});

document.getElementById('code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});

document.getElementById('start-btn').addEventListener('click', () => {
  socket.emit('start-game');
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  document.getElementById('end-screen').style.display   = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('lobby').style.display        = 'flex';
  gameActive = false;
  myId = null;
});

// ── Render loop ────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  if (gameActive) updateCamera();
  renderer.render(scene, camera);
}
animate();
