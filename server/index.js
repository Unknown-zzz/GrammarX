import express          from 'express';
import { createServer } from 'https';
import { createServer as httpServer } from 'http';
import { Server }       from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import selfsigned        from 'selfsigned';
import * as db           from './db.js';

const __dir  = dirname(fileURLToPath(import.meta.url));
const DIST   = join(__dir, '..', 'dist');
const PORT   = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── Local IPs helper (dev only) ────────────────────────────────────────────────
function getLocalIPs() {
  const ips = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const n of iface) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  return ips;
}

// ── App + server ───────────────────────────────────────────────────────────────
const app = express();
let server;

if (isProd) {
  // Production (Railway): the platform terminates TLS — plain HTTP inside
  server = httpServer(app);
} else {
  // Local dev: self-signed HTTPS so getUserMedia/camera works over the LAN
  const localIPs = getLocalIPs();
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip:    '127.0.0.1' },
    ...localIPs.map(ip => ({ type: 7, ip })),
  ];
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'Grammar X' }],
    { days: 730, keySize: 2048, algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames }] }
  );
  server = createServer({ key: pems.private, cert: pems.cert }, app);
}

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout:  60000,
  pingInterval: 25000,
});

// Serve Vite build
app.use(express.static(DIST));
app.get('*', (_, res) => res.sendFile(join(DIST, 'index.html')));

// ── Helpers ────────────────────────────────────────────────────────────────────
function push(code) {
  const state = db.getRoundState(code);
  if (state) io.to(code).emit('state', state);
}

// ── Socket handlers ────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('create', ({ code, host, gameId }, ack) => {
    try {
      db.createSession(code, host, gameId);
      socket.join(code);
      ack?.({ ok: true, code });
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('join', ({ code, name }, ack) => {
    const res = db.joinSession(code, name);
    if (res.error) { ack?.({ error: res.error }); return; }
    socket.join(code);
    ack?.({ ok: true });
    push(code);
  });

  socket.on('start', ({ code, gameId, rounds, tpr }, ack) => {
    try {
      db.startSession(code, gameId, rounds, tpr);
      socket.join(code);
      ack?.({ ok: true });
      push(code);
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('advance', ({ code, next }, ack) => {
    try {
      db.advanceRound(code, next);
      ack?.({ ok: true });
      push(code);
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('answer', ({ code, name, roundIndex, score, gameToken }, ack) => {
    try {
      db.submitAnswer(code, name, roundIndex, score, gameToken);
      ack?.({ ok: true });
      push(code);
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('end', ({ code }, ack) => {
    try {
      const scores = db.endGame(code);
      ack?.({ ok: true, scores });
      push(code);
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('close', ({ code }, ack) => {
    try {
      db.closeSession(code);
      ack?.({ ok: true });
      push(code);
    } catch (e) { ack?.({ error: e.message }); }
  });

  socket.on('scores', ({ gameId }, ack) => {
    try { ack(db.getScores(gameId)); } catch { ack([]); }
  });

  socket.on('rejoin', ({ code }, ack) => {
    socket.join(code);
    const state = db.getRoundState(code);
    ack?.(state);
    if (state) socket.emit('state', state);
  });

  socket.on('getState', ({ code }, ack) => {
    ack?.(db.getRoundState(code));
  });
});

// ── Start ──────────────────────────────────────────────────────────────────────
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Puerto ${PORT} en uso.\n`);
    process.exit(1);
  } else { throw err; }
});

server.listen(PORT, () => {
  if (isProd) {
    console.log(`\n✅ Grammar X corriendo en puerto ${PORT}\n`);
  } else {
    const localIPs = getLocalIPs();
    console.log('\n✅ Grammar X corriendo en HTTPS\n');
    console.log(`   Esta máquina  →  https://localhost:${PORT}`);
    localIPs.forEach(ip => console.log(`   Red local     →  https://${ip}:${PORT}`));
    console.log('\n⚠️  Primera visita en otros dispositivos:');
    console.log('   El navegador mostrará "Conexión no privada"');
    console.log('   → Toca "Avanzado" → "Continuar" (solo una vez)');
    console.log('   → Después la cámara funcionará sin problemas\n');
    // HTTP → HTTPS redirect (local only)
    httpServer((req, res) => {
      const host = (req.headers.host || '').replace(/:\d+$/, '');
      res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
      res.end();
    }).on('error', () => {}).listen(PORT + 1, () =>
      console.log(`   HTTP redirect →  http://localhost:${PORT + 1}  (redirige a HTTPS)\n`)
    );
  }
});
