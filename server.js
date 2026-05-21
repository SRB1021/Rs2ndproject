const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

const GRID = 64;
const TICK_MS = 100;
const MAX_PLAYERS = 4;
const COLORS = ['#00ffff', '#ff2244', '#ffee00', '#00ff88'];

const OPP = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const MOVE = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

const rooms = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const START_POSITIONS = [
  { x: 8,          y: GRID / 2, dir: 'RIGHT' },
  { x: GRID - 9,   y: GRID / 2, dir: 'LEFT'  },
  { x: GRID / 2,   y: 8,        dir: 'DOWN'  },
  { x: GRID / 2,   y: GRID - 9, dir: 'UP'    },
];

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.hostId = null;
    this.state = 'lobby';
    this.grid = null;
    this.interval = null;
    this.colorIdx = 0;
  }

  addPlayer(sid, name) {
    if (this.players.size >= MAX_PLAYERS) return false;
    this.players.set(sid, {
      id: sid,
      name: name || `Player ${this.players.size + 1}`,
      color: COLORS[this.colorIdx++ % COLORS.length],
      x: 0, y: 0, dir: 'RIGHT', nextDir: 'RIGHT',
      alive: true, trail: [],
    });
    return true;
  }

  removePlayer(sid) {
    this.players.delete(sid);
  }

  startGame() {
    this.state = 'playing';
    this.grid = Array.from({ length: GRID }, () => new Array(GRID).fill(null));

    const players = [...this.players.values()];
    players.forEach((p, i) => {
      const s = START_POSITIONS[i];
      p.x = s.x; p.y = s.y; p.dir = s.dir; p.nextDir = s.dir;
      p.alive = true; p.trail = [{ x: s.x, y: s.y }];
      this.grid[s.y][s.x] = p.id;
    });

    // Send each player their initialisation data
    for (const [sid, p] of this.players) {
      io.to(sid).emit('game-start', {
        myId: sid,
        gridSize: GRID,
        tickMs: TICK_MS,
        players: [...this.players.values()].map(q => ({
          id: q.id, name: q.name, color: q.color,
          x: q.x, y: q.y, dir: q.dir,
        })),
      });
    }

    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  tick() {
    const all = [...this.players.values()];

    for (const p of all) {
      if (!p.alive) continue;
      p.dir = p.nextDir;
      const [dx, dy] = MOVE[p.dir];
      const nx = p.x + dx, ny = p.y + dy;

      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || this.grid[ny][nx] !== null) {
        p.alive = false;
        continue;
      }
      p.x = nx; p.y = ny;
      p.trail.push({ x: nx, y: ny });
      this.grid[ny][nx] = p.id;
    }

    const alive = all.filter(p => p.alive);

    io.to(this.code).emit('tick', {
      players: all.map(p => ({
        id: p.id, x: p.x, y: p.y, dir: p.dir, alive: p.alive,
        newTrail: p.trail.length >= 2 ? p.trail[p.trail.length - 2] : null,
      })),
    });

    if (alive.length <= 1) {
      clearInterval(this.interval);
      this.interval = null;
      this.state = 'finished';
      io.to(this.code).emit('game-over', {
        winner: alive[0] ? { id: alive[0].id, name: alive[0].name, color: alive[0].color } : null,
      });
    }
  }

  setDir(sid, dir) {
    const p = this.players.get(sid);
    if (p && p.alive && dir !== OPP[p.dir]) p.nextDir = dir;
  }

  lobby() {
    return {
      code: this.code,
      state: this.state,
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color })),
    };
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
  }
}

io.on('connection', socket => {
  let room = null;

  socket.on('create-room', ({ name }) => {
    const code = genCode();
    room = new Room(code);
    room.hostId = socket.id;
    room.addPlayer(socket.id, name);
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room-created', room.lobby());
  });

  socket.on('join-room', ({ code, name }) => {
    const r = rooms.get(code.toUpperCase().trim());
    if (!r) return socket.emit('room-error', 'Room not found');
    if (r.state !== 'lobby') return socket.emit('room-error', 'Game already in progress');
    if (r.players.size >= MAX_PLAYERS) return socket.emit('room-error', 'Room is full');
    r.addPlayer(socket.id, name);
    socket.join(r.code);
    room = r;
    socket.emit('room-joined', r.lobby());
    io.to(r.code).emit('lobby-update', r.lobby());
  });

  socket.on('start-game', () => {
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    room.startGame();
  });

  socket.on('turn', ({ dir }) => {
    if (room) room.setDir(socket.id, dir);
  });

  socket.on('disconnect', () => {
    if (!room) return;
    room.removePlayer(socket.id);
    if (room.players.size === 0) {
      room.destroy();
      rooms.delete(room.code);
    } else {
      if (room.hostId === socket.id) {
        room.hostId = [...room.players.keys()][0];
      }
      io.to(room.code).emit('lobby-update', room.lobby());
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Listening on port ${PORT}`));
