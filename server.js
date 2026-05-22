const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

const GRID    = 64;
const TICK_MS = 80;  // ~12 ticks/s — smoother than 100ms
const MAX_PL  = 4;
const COLORS  = ['#00e5ff', '#ff1744', '#ffea00', '#00e676'];
const BOT_NAMES = ['RINZLER', 'CLU', 'SARK', 'MCP'];

const OPP  = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };
const MOVE = { UP:[0,-1], DOWN:[0,1], LEFT:[-1,0], RIGHT:[1,0] };
const MOVE_VALS = Object.values(MOVE);

const rooms = new Map();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({length:6}, () => chars[Math.random()*chars.length|0]).join(''); }
  while (rooms.has(code));
  return code;
}

const STARTS = [
  { x:8,       y:GRID/2, dir:'RIGHT' },
  { x:GRID-9,  y:GRID/2, dir:'LEFT'  },
  { x:GRID/2,  y:8,      dir:'DOWN'  },
  { x:GRID/2,  y:GRID-9, dir:'UP'    },
];

// ── Bot flood-fill AI ──────────────────────────────────────────────────────
function floodCount(x, y, dir, grid, max=300) {
  const [dx,dy] = MOVE[dir];
  const nx=x+dx, ny=y+dy;
  if (nx<0||nx>=GRID||ny<0||ny>=GRID||grid[ny][nx]!==null) return 0;
  const vis = new Uint8Array(GRID*GRID);
  const q = [ny*GRID+nx]; vis[ny*GRID+nx]=1;
  let head=0, count=0;
  while (head<q.length && count<max) {
    const pos=q[head++]; const cy=(pos/GRID)|0, cx=pos%GRID; count++;
    for (const [ddx,ddy] of MOVE_VALS) {
      const qx=cx+ddx, qy=cy+ddy;
      if (qx>=0&&qx<GRID&&qy>=0&&qy<GRID&&!vis[qy*GRID+qx]&&grid[qy][qx]===null) {
        vis[qy*GRID+qx]=1; q.push(qy*GRID+qx);
      }
    }
  }
  return count;
}

function botDecide(bot, grid) {
  let best=bot.dir, score=-1;
  for (const dir of Object.keys(MOVE)) {
    if (dir===OPP[bot.dir]) continue;
    const s = floodCount(bot.x, bot.y, dir, grid) + (dir===bot.dir ? 10 : 0);
    if (s>score) { score=s; best=dir; }
  }
  bot.nextDir = best;
}

// ── Room ───────────────────────────────────────────────────────────────────
class Room {
  constructor(code) {
    this.code=code; this.players=new Map(); this.hostId=null;
    this.state='lobby'; this.grid=null; this.interval=null;
    this.colorIdx=0; this.botCount=0;
  }

  _mkPlayer(id, name, isBot) {
    return { id, name, color:COLORS[this.colorIdx++%COLORS.length],
             x:0, y:0, dir:'RIGHT', nextDir:'RIGHT',
             alive:true, trail:[], trailActive:true, isBot };
  }

  addPlayer(sid, name) {
    if (this.players.size>=MAX_PL) return false;
    this.players.set(sid, this._mkPlayer(sid, name||`Player ${this.players.size+1}`, false));
    return true;
  }

  addBot() {
    if (this.players.size>=MAX_PL) return false;
    const id=`bot-${++this.botCount}`;
    const used=new Set([...this.players.values()].map(p=>p.name));
    const name=BOT_NAMES.find(n=>!used.has(n))||`CPU-${this.botCount}`;
    this.players.set(id, this._mkPlayer(id, name, true));
    return true;
  }

  removeLastBot() {
    const bots=[...this.players.entries()].filter(([,p])=>p.isBot);
    if (bots.length) this.players.delete(bots[bots.length-1][0]);
  }

  removePlayer(sid) { this.players.delete(sid); }

  toggleTrail(sid) {
    const p=this.players.get(sid);
    if (p && !p.isBot) { p.trailActive=!p.trailActive; return p.trailActive; }
    return null;
  }

  startGame() {
    this.state='playing';
    this.grid=Array.from({length:GRID}, ()=>new Array(GRID).fill(null));
    const all=[...this.players.values()];
    all.forEach((p,i)=>{
      const s=STARTS[i];
      p.x=s.x; p.y=s.y; p.dir=s.dir; p.nextDir=s.dir;
      p.alive=true; p.trail=[{x:s.x,y:s.y}]; p.trailActive=true;
      this.grid[s.y][s.x]=p.id;
    });
    const players=all.map(q=>({id:q.id,name:q.name,color:q.color,x:q.x,y:q.y,dir:q.dir,isBot:q.isBot}));
    for (const [sid,p] of this.players) {
      if (!p.isBot) io.to(sid).emit('game-start',{myId:sid,gridSize:GRID,tickMs:TICK_MS,players});
    }
    this.interval=setInterval(()=>this.tick(), TICK_MS);
  }

  tick() {
    const all=[...this.players.values()];
    for (const p of all) if (p.isBot && p.alive) botDecide(p, this.grid);

    for (const p of all) {
      if (!p.alive) continue;
      p.dir=p.nextDir;
      const [dx,dy]=MOVE[p.dir];
      const nx=p.x+dx, ny=p.y+dy;
      if (nx<0||nx>=GRID||ny<0||ny>=GRID||this.grid[ny][nx]!==null) { p.alive=false; continue; }
      p.x=nx; p.y=ny;
      p.trail.push({x:nx,y:ny});
      if (p.trailActive) this.grid[ny][nx]=p.id;  // only mark if trail is on
    }

    const alive=all.filter(p=>p.alive);
    const someoneDied=all.some(p=>!p.alive);

    io.to(this.code).emit('tick', {
      players: all.map(p=>({
        id:p.id, x:p.x, y:p.y, dir:p.dir, alive:p.alive,
        trailActive:p.trailActive,
        newTrail: p.trailActive && p.trail.length>=2 ? p.trail[p.trail.length-2] : null,
      })),
    });

    if (someoneDied && alive.length<=1) {
      clearInterval(this.interval); this.interval=null; this.state='finished';
      io.to(this.code).emit('game-over', {
        winner: alive[0] ? {id:alive[0].id,name:alive[0].name,color:alive[0].color} : null,
      });
    }
  }

  setDir(sid, dir) {
    const p=this.players.get(sid);
    if (p && !p.isBot && p.alive && dir!==OPP[p.dir]) p.nextDir=dir;
  }

  lobby() {
    return { code:this.code, state:this.state,
             players:[...this.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,isBot:p.isBot})) };
  }

  restart() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.state = 'lobby';
    this.grid  = null;
  }

  destroy() { if (this.interval) clearInterval(this.interval); }
}

// ── Sockets ────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  let room=null;

  socket.on('create-room', ({name}) => {
    const code=genCode();
    room=new Room(code); room.hostId=socket.id;
    room.addPlayer(socket.id, name);
    rooms.set(code, room); socket.join(code);
    socket.emit('room-created', room.lobby());
  });

  socket.on('join-room', ({code,name}) => {
    const r=rooms.get(code.toUpperCase().trim());
    if (!r) return socket.emit('room-error','Room not found');
    if (r.state!=='lobby') return socket.emit('room-error','Game already in progress');
    if (r.players.size>=MAX_PL) return socket.emit('room-error','Room is full');
    r.addPlayer(socket.id,name); socket.join(r.code); room=r;
    socket.emit('room-joined',r.lobby());
    io.to(r.code).emit('lobby-update',r.lobby());
  });

  socket.on('add-bot', () => {
    if (!room||room.hostId!==socket.id||room.state!=='lobby') return;
    room.addBot(); io.to(room.code).emit('lobby-update',room.lobby());
  });

  socket.on('remove-bot', () => {
    if (!room||room.hostId!==socket.id||room.state!=='lobby') return;
    room.removeLastBot(); io.to(room.code).emit('lobby-update',room.lobby());
  });

  socket.on('start-game', () => {
    if (!room||room.hostId!==socket.id||room.state!=='lobby') return;
    room.startGame();
  });

  socket.on('restart-game', () => {
    if (!room||room.hostId!==socket.id||room.state!=='finished') return;
    room.restart();
    io.to(room.code).emit('lobby-update', room.lobby());
  });

  socket.on('turn', ({dir}) => { if (room) room.setDir(socket.id,dir); });

  socket.on('toggle-trail', () => {
    if (!room) return;
    const active=room.toggleTrail(socket.id);
    if (active!==null) socket.emit('trail-status',{active});
  });

  socket.on('disconnect', () => {
    if (!room) return;
    room.removePlayer(socket.id);
    if (room.players.size===0) { room.destroy(); rooms.delete(room.code); }
    else {
      if (room.hostId===socket.id) {
        const h=[...room.players.values()].find(p=>!p.isBot);
        room.hostId = h ? h.id : [...room.players.keys()][0];
      }
      io.to(room.code).emit('lobby-update',room.lobby());
    }
  });
});

const PORT=process.env.PORT||3000;
httpServer.listen(PORT, ()=>console.log(`Listening on port ${PORT}`));
