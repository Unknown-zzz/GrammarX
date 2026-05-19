// ── Grammar X · Google Apps Script v3 ────────────────────────────────────────
// Sessions : code|status|rounds|host|gameId|currentRound|roundStartedAt|timePerRound|gameToken|created_at
// Answers  : session_code|player_name|round_index|score|game_token|answered_at
// Players  : session_code|name|joined_at
// Scores_* : name|score|date|session

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SCORE_SHEETS = { G1:'Scores_PastSimple', G2:'Scores_Comparatives', G3:'Scores_PresentPerfect', G4:'Scores_Future' };
const S_HDR = ['code','status','rounds','host','gameId','currentRound','roundStartedAt','timePerRound','gameToken','created_at'];

function sh(name, headers) {
  let s = SS.getSheetByName(name);
  if (!s) { s = SS.insertSheet(name); s.appendRow(headers); }
  return s;
}
function json(d) { return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON); }
function rndCode() { return Math.random().toString(36).substring(2,8).toUpperCase(); }

// ── Routers ────────────────────────────────────────────────────────────────────

function doGet(e) {
  const p = e.parameter; let out;
  try {
    if      (p.action==='getRoundState') out = getRoundState(p);
    else if (p.action==='getScores')     out = getScores(p);
    else if (p.action==='getPlayers')    out = getPlayers(p);
    else out = { error:'Unknown action' };
  } catch(err) { out = { error:err.message }; }
  return json(out);
}

function doPost(e) {
  const b = JSON.parse(e.postData.contents); let out;
  try {
    if      (b.action==='createSession') out = createSession(b);
    else if (b.action==='joinSession')   out = joinSession(b);
    else if (b.action==='startSession')  out = startSession(b);
    else if (b.action==='advanceRound')  out = advanceRound(b);
    else if (b.action==='submitAnswer')  out = submitAnswer(b);
    else if (b.action==='endGame')       out = endGame(b);
    else if (b.action==='resetGame')     out = resetGame(b);
    else if (b.action==='closeSession')  out = closeSession(b);
    else out = { error:'Unknown action' };
  } catch(err) { out = { error:err.message }; }
  return json(out);
}

// ── Session lifecycle ──────────────────────────────────────────────────────────

function createSession(b) {
  const s = sh('Sessions', S_HDR);
  const rows = s.getDataRange().getValues().slice(1);
  let code = b.code ? b.code.toUpperCase() : rndCode();
  while (rows.some(r => r[0]===code)) code = rndCode();
  s.appendRow([code,'waiting','',b.host,b.gameId||'G1',0,0,20,0,new Date().toISOString()]);
  return { ok:true, code };
}

function joinSession(b) {
  const s = sh('Sessions', S_HDR);
  const row = s.getDataRange().getValues().slice(1).find(r => r[0]===b.code);
  if (!row) return { ok:false, error:'Sala no encontrada' };
  if (row[1]==='closed') return { ok:false, error:'La sesión ya terminó' };
  const ps = sh('Players',['session_code','name','joined_at']);
  const exists = ps.getDataRange().getValues().slice(1).some(r => r[0]===b.code && r[1]===b.name);
  if (!exists) ps.appendRow([b.code, b.name, new Date().toISOString()]);
  return { ok:true };
}

function startSession(b) {
  return _writeSession(b.code, { status:'playing', rounds:JSON.stringify(b.rounds), gameId:b.gameId, currentRound:0, roundStartedAt:Date.now(), timePerRound:b.timePerRound||20, gameToken:Date.now() });
}

function advanceRound(b) {
  return _writeSession(b.code, { currentRound:b.nextRound, roundStartedAt:Date.now() });
}

function resetGame(b) {
  return _writeSession(b.code, { status:'playing', rounds:JSON.stringify(b.rounds), gameId:b.gameId, currentRound:0, roundStartedAt:Date.now(), timePerRound:b.timePerRound||20, gameToken:Date.now() });
}

function closeSession(b) {
  return _writeSession(b.code, { status:'closed' });
}

function _writeSession(code, fields) {
  const s = sh('Sessions', S_HDR);
  const data = s.getDataRange().getValues();
  // col map (1-based)
  const cols = { status:2, rounds:3, host:4, gameId:5, currentRound:6, roundStartedAt:7, timePerRound:8, gameToken:9 };
  for (let i=1; i<data.length; i++) {
    if (data[i][0]===code) {
      Object.entries(fields).forEach(([k,v]) => { if (cols[k]) s.getRange(i+1, cols[k]).setValue(v); });
      return { ok:true };
    }
  }
  return { ok:false, error:'Session not found' };
}

// ── Game actions ───────────────────────────────────────────────────────────────

function submitAnswer(b) {
  const ash = sh('Answers',['session_code','player_name','round_index','score','game_token','answered_at']);
  const dupe = ash.getDataRange().getValues().slice(1)
    .some(r => r[0]===b.code && r[1]===b.name && Number(r[2])===Number(b.roundIndex) && String(r[4])===String(b.gameToken));
  if (dupe) return { ok:false, error:'Already answered' };
  ash.appendRow([b.code, b.name, Number(b.roundIndex), Number(b.score), String(b.gameToken), new Date().toISOString()]);
  return { ok:true };
}

function endGame(b) {
  const s = sh('Sessions', S_HDR);
  const rows = s.getDataRange().getValues().slice(1);
  const row = rows.find(r => r[0]===b.code);
  if (!row) return { ok:false, error:'Session not found' };

  const gameId    = row[4];
  const gameToken = String(row[8]);

  // Aggregate answers
  const ash  = sh('Answers',['session_code','player_name','round_index','score','game_token','answered_at']);
  const answers = ash.getDataRange().getValues().slice(1)
    .filter(r => r[0]===b.code && String(r[4])===gameToken);
  const scoreMap = {};
  answers.forEach(r => { scoreMap[r[1]] = (scoreMap[r[1]]||0) + Number(r[3]); });

  // Save every participant (even 0)
  const ps    = sh('Players',['session_code','name','joined_at']);
  const names = ps.getDataRange().getValues().slice(1).filter(r=>r[0]===b.code).map(r=>r[1]);
  const scsh  = sh(SCORE_SHEETS[gameId]||'Scores_PastSimple',['name','score','date','session']);
  const today = new Date().toLocaleDateString('es');
  names.forEach(name => scsh.appendRow([name, scoreMap[name]||0, today, b.code]));

  // Mark session ended
  _writeSession(b.code, { status:'ended' });

  const finalScores = names.map(name => ({ name, score:scoreMap[name]||0 })).sort((a,b)=>b.score-a.score);
  return { ok:true, scores:finalScores };
}

// ── Queries ────────────────────────────────────────────────────────────────────

function getRoundState(p) {
  const s = sh('Sessions', S_HDR);
  const row = s.getDataRange().getValues().slice(1).find(r=>r[0]===p.code);
  if (!row) return { error:'Session not found' };

  const gameToken    = String(row[8]);
  const currentRound = Number(row[5])||0;

  // Players
  const ps      = sh('Players',['session_code','name','joined_at']);
  const players = ps.getDataRange().getValues().slice(1).filter(r=>r[0]===p.code).map(r=>r[1]);

  // Answers
  const ash     = sh('Answers',['session_code','player_name','round_index','score','game_token','answered_at']);
  const answers = ash.getDataRange().getValues().slice(1).filter(r=>r[0]===p.code && String(r[4])===gameToken);
  const scoreMap = {}; const answeredNow = new Set();
  answers.forEach(r => {
    scoreMap[r[1]] = (scoreMap[r[1]]||0) + Number(r[3]);
    if (Number(r[2])===currentRound) answeredNow.add(r[1]);
  });

  const playerStates = players
    .map(name => ({ name, totalScore:scoreMap[name]||0, answered:answeredNow.has(name) }))
    .sort((a,b) => b.totalScore - a.totalScore);

  const rounds = row[2] ? JSON.parse(row[2]) : [];
  return {
    status:        row[1],
    gameId:        row[4],
    gameToken,
    currentRound,
    roundStartedAt: Number(row[6])||Date.now(),
    timePerRound:   Number(row[7])||20,
    totalRounds:    rounds.length,
    rounds,
    players:        playerStates,
    answeredCount:  answeredNow.size,
    totalPlayers:   players.length,
  };
}

function getPlayers(p) {
  const s = sh('Players',['session_code','name','joined_at']);
  return s.getDataRange().getValues().slice(1).filter(r=>r[0]===p.code).map(r=>({name:r[1]}));
}

function getScores(p) {
  if (p.gameId==='all') {
    const totals = {};
    Object.values(SCORE_SHEETS).forEach(shName => {
      const s = SS.getSheetByName(shName);
      if (!s || s.getLastRow()<2) return;
      s.getDataRange().getValues().slice(1).forEach(r => { totals[r[0]] = (totals[r[0]]||0)+Number(r[1]); });
    });
    return Object.entries(totals).map(([name,score])=>({name,score})).sort((a,b)=>b.score-a.score);
  }
  const s = sh(SCORE_SHEETS[p.gameId]||'Scores_PastSimple',['name','score','date','session']);
  return s.getDataRange().getValues().slice(1).map(r=>({name:r[0],score:r[1],date:r[2]}));
}
