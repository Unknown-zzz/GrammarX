import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dir   = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(__dir, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'grammar-x.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    code              TEXT PRIMARY KEY,
    status            TEXT NOT NULL DEFAULT 'waiting',
    host              TEXT NOT NULL,
    game_id           TEXT NOT NULL DEFAULT 'G1',
    rounds            TEXT NOT NULL DEFAULT '[]',
    current_round     INTEGER NOT NULL DEFAULT 0,
    round_started_at  INTEGER NOT NULL DEFAULT 0,
    time_per_round    INTEGER NOT NULL DEFAULT 20,
    game_token        TEXT NOT NULL DEFAULT '',
    created_at        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    session_code TEXT NOT NULL,
    name         TEXT NOT NULL,
    PRIMARY KEY (session_code, name)
  );
  CREATE TABLE IF NOT EXISTS answers (
    session_code TEXT    NOT NULL,
    player_name  TEXT    NOT NULL,
    round_index  INTEGER NOT NULL,
    score        INTEGER NOT NULL DEFAULT 0,
    game_token   TEXT    NOT NULL,
    PRIMARY KEY (session_code, player_name, round_index, game_token)
  );
  CREATE TABLE IF NOT EXISTS scores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    score        INTEGER NOT NULL DEFAULT 0,
    game_id      TEXT    NOT NULL,
    session_code TEXT    NOT NULL,
    saved_at     INTEGER NOT NULL
  );
`);

// ── Prepared statements ────────────────────────────────────────────────────────
const q = {
  upsertSession:   db.prepare(`INSERT OR REPLACE INTO sessions (code,status,host,game_id,rounds,current_round,round_started_at,time_per_round,game_token,created_at) VALUES (?, 'waiting', ?, ?, '[]', 0, 0, 20, '', ?)`),
  getSession:      db.prepare('SELECT * FROM sessions WHERE code = ?'),
  startSession:    db.prepare(`UPDATE sessions SET status='playing', game_id=?, rounds=?, current_round=0, round_started_at=?, time_per_round=?, game_token=? WHERE code=?`),
  advanceRound:    db.prepare('UPDATE sessions SET current_round=?, round_started_at=? WHERE code=?'),
  setStatus:       db.prepare('UPDATE sessions SET status=? WHERE code=?'),
  addPlayer:       db.prepare('INSERT OR IGNORE INTO players (session_code, name) VALUES (?, ?)'),
  getPlayers:      db.prepare('SELECT name FROM players WHERE session_code=?'),
  addAnswer:       db.prepare('INSERT OR IGNORE INTO answers (session_code, player_name, round_index, score, game_token) VALUES (?, ?, ?, ?, ?)'),
  getAnswers:      db.prepare('SELECT player_name, round_index, score FROM answers WHERE session_code=? AND game_token=?'),
  insertScore:     db.prepare('INSERT INTO scores (name, score, game_id, session_code, saved_at) VALUES (?, ?, ?, ?, ?)'),
  scoresByGame:    db.prepare('SELECT name, SUM(score) as score FROM scores WHERE game_id=? GROUP BY name ORDER BY score DESC'),
  scoresAll:       db.prepare('SELECT name, SUM(score) as score FROM scores GROUP BY name ORDER BY score DESC'),
};

// ── Public API ─────────────────────────────────────────────────────────────────

export function createSession(code, host, gameId = 'G1') {
  q.upsertSession.run(code, host, gameId, Date.now());
}

export function joinSession(code, name) {
  const s = q.getSession.get(code);
  if (!s) return { error: 'Sala no encontrada' };
  if (s.status === 'closed') return { error: 'La sesión ya terminó' };
  q.addPlayer.run(code, name);
  return { ok: true };
}

export function startSession(code, gameId, rounds, tpr) {
  const now = Date.now();
  const res = q.startSession.run(gameId, JSON.stringify(rounds), now, tpr || 20, String(now), code);
  if (Number(res.changes) === 0) throw new Error(`Session not found: ${code}`);
}

export function advanceRound(code, next) {
  q.advanceRound.run(next, Date.now(), code);
  // round_started_at updated — no changes check needed (optimistic advance is OK)
}

export function submitAnswer(code, name, roundIndex, score, gameToken) {
  q.addAnswer.run(code, name, roundIndex, score, gameToken);
}

export function endGame(code) {
  const s = q.getSession.get(code);
  if (!s) return [];
  const answers = q.getAnswers.all(code, s.game_token);
  const scoreMap = {};
  answers.forEach(a => { scoreMap[a.player_name] = (scoreMap[a.player_name] || 0) + a.score; });
  const players = q.getPlayers.all(code);
  const now = Date.now();
  db.exec('BEGIN');
  try {
    players.forEach(p => q.insertScore.run(p.name, scoreMap[p.name] || 0, s.game_id, code, now));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  q.setStatus.run('ended', code);
  return players
    .map(p => ({ name: p.name, score: scoreMap[p.name] || 0 }))
    .sort((a, b) => b.score - a.score);
}

export function closeSession(code) {
  q.setStatus.run('closed', code);
}

export function getScores(gameId) {
  if (gameId === 'all') return q.scoresAll.all();
  return q.scoresByGame.all(gameId);
}

export function getRoundState(code) {
  const s = q.getSession.get(code);
  if (!s) return null;
  const players = q.getPlayers.all(code);
  const answers = q.getAnswers.all(code, s.game_token);
  const scoreMap = {};
  const answeredNow = new Set();
  // node:sqlite may return INTEGER columns as BigInt — force Number for arithmetic
  const cur          = Number(s.current_round);
  const roundStarted = Number(s.round_started_at);
  const timePer      = Number(s.time_per_round);

  answers.forEach(a => {
    scoreMap[a.player_name] = (scoreMap[a.player_name] || 0) + Number(a.score);
    if (Number(a.round_index) === cur) answeredNow.add(a.player_name);
  });
  const rounds = s.rounds ? JSON.parse(s.rounds) : [];
  return {
    serverTime:     Date.now(),          // clients use this to correct clock skew
    status:         s.status,
    gameId:         s.game_id,
    gameToken:      String(s.game_token),
    currentRound:   cur,
    roundStartedAt: roundStarted,
    timePerRound:   timePer,
    totalRounds:    rounds.length,
    rounds,
    host:           s.host,
    players:        players
      .map(p => ({ name: p.name, totalScore: scoreMap[p.name] || 0, answered: answeredNow.has(p.name) }))
      .sort((a, b) => b.totalScore - a.totalScore),
    answeredCount:  answeredNow.size,
    totalPlayers:   players.length,
  };
}
