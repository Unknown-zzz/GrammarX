import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import jsQR   from 'jsqr';

// ── Socket singleton ───────────────────────────────────────────────────────────
const socket = io(
  import.meta.env.PROD ? window.location.origin : 'http://localhost:3001',
  { autoConnect: true, reconnectionDelay: 500 }
);

function emit(event, data) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, res => {
      if (res?.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

// ── Meta ───────────────────────────────────────────────────────────────────────
const GAMES = {
  G1:{ id:'G1', name:'Time Machine',  icon:'⏰', sub:'Past Simple',                color:'#f0c040', desc:'Ordena las palabras en pasado simple.' },
  G2:{ id:'G2', name:'Duel Mode',     icon:'⚔️',  sub:'Comparatives & Superlatives', color:'#e05a5a', desc:'Elige la forma comparativa o superlativa correcta.' },
  G3:{ id:'G3', name:'Evidence File', icon:'🔍', sub:'Present Perfect',             color:'#5ae0a0', desc:'Lee el pasaje y responde la pregunta de comprensión.' },
  G4:{ id:'G4', name:'Crystal Ball',  icon:'🔮', sub:'Future Tense',                color:'#a080f0', desc:'Elige la forma futura correcta.' },
};
const DIFF_META = {
  1:{ label:'Beginner', color:'#5ae0a0' }, 2:{ label:'Easy',   color:'#60c0f0' },
  3:{ label:'Medium',   color:'#f0c040' }, 4:{ label:'Hard',   color:'#f0a040' },
  5:{ label:'Expert',   color:'#e05a5a' },
};
const TIME_OPTIONS = [10, 15, 20, 30];

function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function pickRounds(pool) { const r=[]; for(let d=1;d<=5;d++) r.push(...shuffle(pool.filter(s=>s.d===d)).slice(0,2)); return r; }
function calcScore(correct, timeLeft, tpr, diff) { if(!correct) return 0; return diff*100 + Math.round((timeLeft/tpr)*diff*50); }

// ── G1 DATA ────────────────────────────────────────────────────────────────────
const TECH = new Set(['programmed','deployed','tested','ran','executed','compiled','debugged','configured','installed','initialized','committed','pushed','pulled','merged','cloned','forked','refactored','documented','reviewed','monitored','logged','parsed','queried','migrated','automated','optimized','containerized','orchestrated','encrypted','authenticated','synchronized','integrated','validated','built','shipped','released','rolled','patched']);
const isTech = w => TECH.has(w.toLowerCase().replace(/[^a-z]/g,''));
const G1_DATA = [
  {s:'She wrote a long email',d:1},
  {s:'He fixed the broken printer',d:1},
  {s:'They opened a new account',d:1},
  {s:'We turned off the computer',d:1},
  {s:'He installed the new software update',d:2},
  {s:'She tested the login form carefully',d:2},
  {s:'They ran the script on the server',d:2},
  {s:'We configured the database connection settings',d:2},
  {s:'The developer debugged the authentication module yesterday',d:3},
  {s:'She committed all her changes to the repository',d:3},
  {s:'They deployed the new build to production',d:3},
  {s:'He reviewed the pull request before merging',d:3},
  {s:'The team refactored the legacy codebase last sprint',d:4},
  {s:'She automated the deployment pipeline using shell scripts',d:4},
  {s:'They migrated all user data to the new cluster',d:4},
  {s:'He containerized the application using Docker and Kubernetes',d:4},
  {s:'The engineer orchestrated the microservices deployment across multiple regions',d:5},
  {s:'She optimized the database queries and reduced latency significantly',d:5},
  {s:'They authenticated users with OAuth and encrypted the tokens',d:5},
  {s:'He integrated the payment gateway and validated every edge case',d:5},
];

// ── G2 DATA ────────────────────────────────────────────────────────────────────
// Pattern A — short adj COMPARATIVE  : X is ADJer than Y
// Pattern B — short adj SUPERLATIVE  : X is the ADJest
// Pattern C — long adj  COMPARATIVE  : X is more ADJ than Y
// Pattern D — long adj  SUPERLATIVE  : X is the most ADJ
const G2_DATA = [
  // ── d:1 · Pattern A — short adj comparative (ADJer than) ────────────────
  {left:'🐢 Turtle',right:'🐇 Rabbit',tpl:'A rabbit is ___ than a turtle.',opts:['faster','more fast','more faster','fastest'],d:1},
  {left:'📱 Phone',right:'💻 Laptop',tpl:'A laptop is ___ than a phone.',opts:['bigger','more big','more bigger','biggest'],d:1},
  {left:'🐭 Mouse',right:'🖥️ Monitor',tpl:'A mouse is ___ than a monitor.',opts:['smaller','more small','more smaller','smallest'],d:1},
  {left:'💡 LED',right:'🕯️ Candle',tpl:'An LED is ___ than a candle.',opts:['brighter','more bright','more brighter','brightest'],d:1},
  // ── d:2 · Pattern B — short adj superlative (the ADJest) ────────────────
  {left:'🏔️ Everest',right:'⛰️ Hill',tpl:'Everest is ___ mountain in the world.',opts:['the tallest','the most tall','taller','most tall'],d:2},
  {left:'🐋 Blue Whale',right:'🐘 Elephant',tpl:'The blue whale is ___ animal on Earth.',opts:['the largest','the most large','larger','most large'],d:2},
  {left:'☀️ Sun',right:'💡 Bulb',tpl:'The sun is ___ natural light source.',opts:['the brightest','the most bright','brighter','most bright'],d:2},
  {left:'🧊 Ice',right:'💧 Water',tpl:'Ice is ___ state of water.',opts:['the coldest','the most cold','colder','most cold'],d:2},
  // ── d:3 · Pattern C — long adj comparative (more ADJ than) ──────────────
  {left:'🐍 Python',right:'⚙️ Assembly',tpl:'Python is ___ than Assembly.',opts:['more readable','readabler','most readable','more readabler'],d:3},
  {left:'☁️ Cloud',right:'💾 USB Drive',tpl:'Cloud storage is ___ than a USB drive.',opts:['more convenient','convenienter','most convenient','more convenienter'],d:3},
  {left:'🔒 HTTPS',right:'🔓 HTTP',tpl:'HTTPS is ___ than HTTP.',opts:['more secure','securer','most secure','more securer'],d:3},
  {left:'💡 SSD',right:'💿 HDD',tpl:'An SSD is ___ than an HDD.',opts:['more efficient','efficienter','most efficient','more efficienter'],d:3},
  // ── d:4 · Pattern D — long adj superlative (the most ADJ) ───────────────
  {left:'⚛️ React',right:'🅰️ Angular',tpl:'React is ___ front-end library today.',opts:['the most popular','most popular','the popularest','popularest'],d:4},
  {left:'🔐 AES-256',right:'🔓 MD5',tpl:'AES-256 is ___ encryption standard.',opts:['the most secure','most secure','the securest','securest'],d:4},
  {left:'⚡ Rust',right:'🐘 PHP',tpl:'Rust is ___ systems language available.',opts:['the most performant','most performant','the performantest','performantest'],d:4},
  {left:'☁️ Kubernetes',right:'🖥️ Bare Metal',tpl:'Kubernetes is ___ deployment option.',opts:['the most scalable','most scalable','the scalablest','scalablest'],d:4},
  // ── d:5 · Mixed — all four patterns ─────────────────────────────────────
  {left:'🧠 GPT-4',right:'🤖 GPT-2',tpl:'GPT-4 is ___ than GPT-2.',opts:['more sophisticated','sophisticateder','most sophisticated','more sophisticateder'],d:5},
  {left:'📡 Fiber',right:'📶 Wi-Fi',tpl:'Fiber is ___ internet connection than Wi-Fi.',opts:['more stable','stabler','most stable','more stableer'],d:5},
  {left:'🔬 Unit Test',right:'🧪 E2E Test',tpl:'Unit tests are ___ to run than E2E tests.',opts:['faster','more fast','more faster','fastest'],d:5},
  {left:'🌐 IPv6',right:'🌐 IPv4',tpl:'IPv6 has ___ address space than IPv4.',opts:['a larger','a more large','a more larger','the largest'],d:5},
];

// ── G3 DATA ────────────────────────────────────────────────────────────────────
const G3_DATA = [
  {title:'The New Developer',passage:'Alex has just joined the team. He has never worked with TypeScript before, but he has already read the documentation twice. The team has welcomed him warmly.',q:'What has Alex done with the documentation?',opts:['Read it twice','Written it once','Deleted it','Never touched it'],t:'¿Qué ha hecho Alex con la documentación?',d:1},
  {title:'The Production Bug',passage:'The QA team has found a critical bug in production. They have already notified the developers and have written a detailed report. No one has fixed it yet.',q:'Has the bug been fixed?',opts:['No, not yet','Yes, already','Yes, twice','The text does not say'],t:'¿Se ha arreglado el bug?',d:1},
  {title:'The Database Migration',passage:'The operations team has successfully migrated the database to a new cluster. They have been working on it for three weeks. The CEO has praised their effort.',q:'How long has the team been working on the migration?',opts:['Three weeks','Two days','One month','A sprint'],t:'¿Cuánto tiempo ha trabajado el equipo en la migración?',d:2},
  {title:'The Open-Source Project',passage:'Maria has published her first open-source library. Over 200 developers have starred the repository since Monday. Three companies have already reached out to sponsor it.',q:'How many developers have starred the repository?',opts:['Over 200','Exactly 200','Three','The text does not say'],t:'¿Cuántos desarrolladores han marcado el repositorio con estrella?',d:2},
  {title:'The Security Audit',passage:'The security team has conducted a full audit of the application. They have identified five vulnerabilities. Two of them have already been patched by the backend team.',q:'How many vulnerabilities have been patched so far?',opts:['Two','Five','All of them','None'],t:'¿Cuántas vulnerabilidades han sido parcheadas hasta ahora?',d:3},
  {title:'The AI Model',passage:'Researchers at the lab have trained a new language model. It has outperformed every previous benchmark. The team has not yet published the paper, but they have submitted it for review.',q:'What has the team done with the paper?',opts:['Submitted it for review','Published it','Deleted it','Written it twice'],t:'¿Qué ha hecho el equipo con el paper?',d:3},
  {title:'The Startup Launch',passage:'The startup has raised $5 million in Series A funding. The founders have hired ten engineers and have signed contracts with two major clients. They have not yet launched the product publicly.',q:'Has the product been launched publicly?',opts:['No, not yet','Yes, last week','Yes, to two clients','The text does not say'],t:'¿Se ha lanzado el producto públicamente?',d:4},
  {title:'The Cloud Architecture',passage:'The infrastructure team has redesigned the entire cloud architecture. They have replaced the monolith with microservices, have adopted Kubernetes, and have reduced costs by 40%. No downtime has been reported during the transition.',q:'What has been achieved during the transition?',opts:['Zero downtime','40% more cost','One hour of downtime','Three outages'],t:'¿Qué se logró durante la transición?',d:4},
  {title:'The Code Review',passage:'The senior engineer has reviewed over fifty pull requests this quarter. She has left detailed comments on each one. Several junior developers have told her it has been the most helpful feedback they have ever received.',q:'What have junior developers said about the feedback?',opts:["It's the most helpful they've received",'It was too harsh','It was not enough','They have not commented'],t:'¿Qué han dicho los juniors sobre el feedback?',d:5},
  {title:'The Performance Optimization',passage:'The engineering team has spent the last month optimizing the platform. They have reduced average API response time from 800ms to 95ms. The product has never performed this well in its three-year history.',q:'What was the original average API response time?',opts:['800ms','95ms','Three years','The text does not say'],t:'¿Cuál era el tiempo de respuesta promedio original de la API?',d:5},
];

// ── G4 DATA ────────────────────────────────────────────────────────────────────
const G4_DATA = [
  {ctx:'You hear thunder outside.',tpl:'It ___ rain soon.',opts:["'s going to","will","won't","is raining"],hint:'Visible evidence → going to.',t:'Va a llover pronto.',d:1},
  {ctx:'Maria has already bought her flight ticket for next Monday.',tpl:'She ___ fly to London next week.',opts:['is going to','will',"won't",'flies'],hint:'Planned future action → going to.',t:'Ella va a volar a Londres la semana que viene.',d:1},
  {ctx:'Nobody planned it, but someone drops their coffee.',tpl:'I ___ help you clean that up.',opts:["'ll","'m going to","won't",'am helping'],hint:'Spontaneous decision → will.',t:'Te ayudaré a limpiar eso.',d:1},
  {ctx:'The project deadline is tomorrow. The code is broken.',tpl:'We ___ make it in time.',opts:["won't","will","'re going to",'make'],hint:'Prediction with doubt → won\'t.',t:'No lo lograremos a tiempo.',d:1},
  {ctx:'The team has already scheduled the sprint planning for Friday.',tpl:'We ___ our sprint on Friday.',opts:['are starting','will start','start','going to start'],hint:'Fixed schedule → present continuous.',t:'Comenzaremos nuestro sprint el viernes.',d:2},
  {ctx:'Look at those error logs — the server is clearly overloaded.',tpl:"The system ___ crash if we don't act.",opts:['is going to','will',"won't",'crashes'],hint:'Evidence of imminent problem → going to.',t:'El sistema va a colapsar si no actuamos.',d:2},
  {ctx:'A colleague asks for help with a difficult algorithm.',tpl:"I ___ take a look at it after lunch.",opts:["'ll","'m going to","won't",'take'],hint:'On-the-spot offer → will.',t:'Lo revisaré después del almuerzo.',d:2},
  {ctx:'The tests are green, staging looks perfect.',tpl:'We ___ the update to production tonight.',opts:["'re pushing",'will push','go to push','pushed'],hint:'Arranged plan with time → present continuous.',t:'Vamos a subir la actualización a producción esta noche.',d:3},
  {ctx:'Current trends: AI adoption is accelerating globally.',tpl:'AI ___ transform every industry within a decade.',opts:['will','is going to',"won't",'transforms'],hint:'General prediction/opinion → will.',t:'La IA transformará todas las industrias en una década.',d:3},
  {ctx:'The intern just broke the main branch.',tpl:'The senior dev ___ be happy about this.',opts:["won't",'will','is going to','is being'],hint:'Prediction (negative) → won\'t.',t:'El desarrollador senior no estará contento con esto.',d:3},
  {ctx:'Engineers at the conference have already confirmed the talk.',tpl:'The lead architect ___ a keynote at 9 a.m.',opts:['is giving','will give','gives','going to give'],hint:'Confirmed appointment → present continuous.',t:'El arquitecto principal dará una presentación a las 9 a.m.',d:4},
  {ctx:'Based on current server metrics, the load is dangerously high.',tpl:'The database ___ start rejecting queries soon.',opts:['is going to','will',"won't",'rejects'],hint:'Strong evidence of upcoming event → going to.',t:'La base de datos va a empezar a rechazar consultas pronto.',d:4},
  {ctx:'No evidence, purely speculative future statement about quantum computing.',tpl:'Quantum computers ___ eventually break all current encryption.',opts:['will','are going to',"won't",'break'],hint:'Speculative/opinion future → will.',t:'Las computadoras cuánticas romperán todo el cifrado actual.',d:4},
  {ctx:'The CI pipeline just failed for the third time.',tpl:"We ___ be able to ship without fixing this.",opts:["won't",'will','are going to','are'],hint:'Negative prediction → won\'t.',t:'No podremos hacer el envío sin arreglar esto.',d:5},
  {ctx:'Company roadmap: next quarter feature set is fully approved.',tpl:'The team ___ three major features next quarter.',opts:['is delivering','will deliver','delivers','going to deliver'],hint:'Scheduled organizational plan → present continuous.',t:'El equipo entregará tres funciones principales el próximo trimestre.',d:5},
  {ctx:'The new microservices architecture is nearly ready to go live.',tpl:'By next month, the monolith ___ fully replaced.',opts:['will have been','is going to be','is being','will be being'],hint:'Future perfect passive for a completed future action.',t:'Para el próximo mes, el monolito habrá sido completamente reemplazado.',d:5},
];

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080810;color:#eeeae2;font-family:'JetBrains Mono',monospace;min-height:100vh;overflow-x:hidden}
:root{--bg:#080810;--s1:#111118;--s2:#1a1a26;--acc:#f0c040;--red:#e05a5a;--grn:#5ae0a0;--blu:#60c0f0;--pur:#a080f0;--mut:#55556a;--bdr:#2a2a44;--gold:#ffd700;--silver:#b8b8c8;--bronze:#cd7f32}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--bdr)}
.grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px);background-size:44px 44px;opacity:.22}
.glow-bg{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 60% 50% at 15% 60%,rgba(240,192,64,.05),transparent),radial-gradient(ellipse 50% 40% at 85% 20%,rgba(96,192,240,.04),transparent)}
.page{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem}

/* Card */
.card{background:var(--s1);border:1px solid var(--bdr);border-radius:6px;padding:2.5rem;width:100%;max-width:420px;position:relative;box-shadow:0 0 60px rgba(240,192,64,.06)}
.card::before{content:'';position:absolute;top:-1px;left:15%;right:15%;height:2px;background:linear-gradient(90deg,transparent,var(--acc),transparent)}
.brand{font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;font-weight:800;letter-spacing:-.05em;color:var(--acc);margin-bottom:.3rem}
.brand em{color:#eeeae2;font-style:normal}
.brand-sub{color:var(--mut);font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;margin-bottom:2rem}
.field{margin-bottom:1.1rem}
.field label{display:block;font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin-bottom:.4rem}
.field input{width:100%;background:var(--bg);border:1px solid var(--bdr);border-radius:4px;padding:.7rem 1rem;color:#eeeae2;font-family:'JetBrains Mono',monospace;font-size:.88rem;outline:none;transition:border-color .2s}
.field input:focus{border-color:var(--acc)}
.btn{width:100%;background:var(--acc);color:var(--bg);border:none;border-radius:4px;padding:.8rem;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1rem;letter-spacing:.04em;cursor:pointer;transition:transform .1s,box-shadow .2s;margin-top:.35rem}
.btn:hover{box-shadow:0 6px 28px rgba(240,192,64,.35);transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn.secondary{background:transparent;border:1px solid var(--bdr);color:#eeeae2;font-weight:600}
.btn.secondary:hover{border-color:var(--acc);box-shadow:none}
.btn.danger{background:var(--red)}
.btn:disabled{opacity:.4;pointer-events:none}
.err{background:rgba(224,90,90,.1);border:1px solid var(--red);border-radius:3px;padding:.55rem .9rem;font-size:.73rem;color:var(--red);margin-bottom:.9rem;animation:fadeIn .2s}
.link-row{text-align:center;margin-top:1.3rem;font-size:.72rem;color:var(--mut)}
.link-row a{color:var(--acc);cursor:pointer;text-decoration:none}
.link-row a:hover{text-decoration:underline}

/* Role picker */
.role-row{display:flex;gap:.7rem;margin-bottom:1.4rem}
.role-card{flex:1;background:var(--bg);border:2px solid var(--bdr);border-radius:5px;padding:1rem .7rem;text-align:center;cursor:pointer;transition:border-color .2s,background .2s}
.role-card:hover{border-color:var(--acc)}
.role-card.active{border-color:var(--acc);background:rgba(240,192,64,.07)}
.role-icon{font-size:1.6rem;margin-bottom:.4rem}
.role-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.9rem}
.role-desc{font-size:.6rem;color:var(--mut);margin-top:.2rem}

/* Lobby */
.lobby-wrap{width:100%;max-width:580px}
.code-display{background:var(--s2);border:2px solid var(--acc);border-radius:6px;padding:1.5rem;text-align:center;margin-bottom:1.2rem}
.code-label{font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--mut);margin-bottom:.5rem}
.code-value{font-family:'Bricolage Grotesque',sans-serif;font-size:3rem;font-weight:800;color:var(--acc);letter-spacing:.25em}
.code-hint{font-size:.65rem;color:var(--mut);margin-top:.4rem}
.players-box{background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:1rem 1.2rem;margin-bottom:1rem}
.players-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem}
.players-title{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut)}
.players-count{font-size:.72rem;color:var(--acc);font-weight:700}
.player-list{display:flex;flex-direction:column;gap:.35rem;max-height:190px;overflow-y:auto}
.player-item{display:flex;align-items:center;gap:.6rem;padding:.38rem .7rem;background:var(--s2);border-radius:3px;font-size:.8rem}
.player-dot{width:7px;height:7px;border-radius:50%;background:var(--grn);animation:pulse 2s infinite;flex-shrink:0}
.player-empty{color:var(--mut);font-size:.72rem;text-align:center;padding:.8rem 0}
.host-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(240,192,64,.1);border:1px solid var(--acc);border-radius:20px;padding:.25rem .7rem;font-size:.62rem;color:var(--acc);letter-spacing:.1em;margin-bottom:.8rem}
.waiting-anim{display:flex;align-items:center;gap:.4rem;justify-content:center;font-size:.72rem;color:var(--mut);margin:1rem 0}
.waiting-dot{width:6px;height:6px;border-radius:50%;background:var(--acc);animation:bounce 1.2s infinite}
.waiting-dot:nth-child(2){animation-delay:.2s}.waiting-dot:nth-child(3){animation-delay:.4s}

/* Game selector */
.game-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:1rem}
.game-tile{background:var(--bg);border:2px solid var(--bdr);border-radius:5px;padding:1rem;cursor:pointer;transition:all .2s;position:relative}
.game-tile:hover{transform:translateY(-2px)}
.game-tile.active::after{content:'✓';position:absolute;top:.6rem;right:.7rem;font-size:.85rem}
.gt-icon{font-size:1.7rem;margin-bottom:.4rem}
.gt-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.88rem;margin-bottom:.1rem}
.gt-sub{font-size:.6rem;color:var(--mut)}

/* Time selector */
.time-row{display:flex;gap:.5rem;margin-bottom:1rem}
.time-btn{flex:1;background:var(--bg);border:1px solid var(--bdr);border-radius:4px;padding:.45rem;font-family:'JetBrains Mono',monospace;font-size:.78rem;color:var(--mut);cursor:pointer;text-align:center;transition:all .15s}
.time-btn.active{border-color:var(--acc);color:var(--acc);background:rgba(240,192,64,.07)}

/* ── Host Dashboard ── */
.host-dash{width:100%;max-width:900px;display:flex;flex-direction:column;gap:.9rem;padding:1rem 1.5rem}
.dash-header{display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--bdr)}
.dash-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.2rem}
.dash-meta{font-size:.7rem;color:var(--mut)}

/* Timer */
.timer-row{display:flex;align-items:center;gap:1rem}
.timer-track{flex:1;height:8px;background:var(--bdr);border-radius:4px;overflow:hidden}
.timer-fill{height:100%;border-radius:4px;transition:width .25s linear,background .5s}
.timer-num{font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;font-weight:800;min-width:2.5rem;text-align:right;transition:color .3s}
.timer-num.urgent{animation:timerPulse .5s infinite}

/* Host question preview */
.q-preview{background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:1rem 1.4rem}
.q-preview-label{font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin-bottom:.4rem}
.q-preview-text{font-size:.9rem;line-height:1.5;color:#eeeae2}
.q-preview-answer{font-size:.78rem;color:var(--grn);margin-top:.5rem;padding-top:.4rem;border-top:1px solid var(--bdr)}

/* Player grid */
.player-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.5rem}
.pg-card{background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:.7rem .9rem;display:flex;align-items:center;justify-content:space-between;transition:border-color .3s}
.pg-card.answered{border-color:var(--grn);background:rgba(90,224,160,.04)}
.pg-card.pending{border-color:var(--bdr)}
.pg-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.pg-score{font-size:.7rem;color:var(--mut);margin-top:.15rem}
.pg-status{font-size:1rem;flex-shrink:0;margin-left:.4rem}
.answered-badge{font-size:.65rem;color:var(--grn);letter-spacing:.1em;font-weight:700}

/* Advance button */
.advance-btn{width:100%;padding:1.1rem;font-size:1.1rem;border-radius:5px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;border:none;cursor:pointer;transition:all .2s;letter-spacing:.04em}
.advance-btn.ready{background:var(--acc);color:var(--bg);box-shadow:0 4px 24px rgba(240,192,64,.4)}
.advance-btn.ready:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(240,192,64,.5)}
.advance-btn.waiting{background:var(--s2);color:var(--mut);cursor:default}
.advance-btn.end{background:var(--red);color:#fff;box-shadow:0 4px 24px rgba(224,90,90,.3)}
.advance-btn.end:hover{transform:translateY(-2px)}

/* ── Host Results ── */
.results-wrap{width:100%;max-width:560px}
.results-podium{display:flex;align-items:flex-end;justify-content:center;gap:.9rem;margin:1.5rem 0}
.rp-block{flex:1;max-width:150px;text-align:center}
.rp-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.85rem;margin-bottom:.3rem;word-break:break-all}
.rp-score{font-size:.68rem;color:var(--mut);margin-bottom:.3rem}
.rp-bar{border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;font-size:1.7rem}
.results-list{width:100%;margin-bottom:1.5rem}
.rl-row{display:flex;align-items:center;gap:.8rem;padding:.55rem 1rem;border-bottom:1px solid var(--bdr);font-size:.8rem}
.rl-rank{color:var(--mut);width:1.8rem;text-align:right;font-size:.68rem}
.rl-name{flex:1;font-family:'Bricolage Grotesque',sans-serif;font-weight:700}
.rl-score{font-weight:700}
.action-row{display:flex;gap:.7rem}
.action-row .btn{flex:1;width:auto}

/* ── Player game ── */
.player-game{width:100%;max-width:820px}
.phud{display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;margin-bottom:.6rem}
.phud-left .pname{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1rem;color:var(--acc)}
.phud-left .proom{font-size:.6rem;color:var(--mut);margin-top:.1rem}
.phud-left .pscore{font-size:.72rem;color:var(--mut);margin-top:.1rem}
.phud-left .pscore b{color:#eeeae2}
.prog-wrap{height:2px;background:var(--bdr);border-radius:2px;margin-bottom:1rem;overflow:hidden}
.prog-bar{height:100%;border-radius:2px;transition:width .5s}
.round-meta{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem}
.round-lbl{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut)}
.diff-pill{padding:.2rem .65rem;border-radius:20px;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;border:1px solid}
.feedback{border-radius:4px;padding:.7rem 1.1rem;font-size:.82rem;font-weight:700;text-align:center;margin-bottom:.8rem;animation:fadeIn .15s}
.feedback.ok{background:rgba(90,224,160,.1);border:1px solid var(--grn);color:var(--grn)}
.feedback.fail{background:rgba(224,90,90,.1);border:1px solid var(--red);color:var(--red)}
.feedback.timeout{background:rgba(240,192,64,.08);border:1px solid var(--acc);color:var(--acc)}
.waiting-overlay{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:3rem 1rem;text-align:center}
.waiting-overlay .big-icon{font-size:3.5rem}
.waiting-overlay .big-msg{font-family:'Bricolage Grotesque',sans-serif;font-size:1.3rem;font-weight:700}
.waiting-overlay .sub-msg{font-size:.75rem;color:var(--mut)}

/* G1 word order */
.answer-zone{background:var(--s2);border:1px dashed var(--bdr);border-radius:5px;min-height:64px;padding:.9rem;display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;margin-bottom:.9rem;transition:border-color .25s,background .25s}
.answer-zone.active{border-color:var(--acc)}.answer-zone.correct{border-color:var(--grn);background:rgba(90,224,160,.04)}.answer-zone.wrong{border-color:var(--red);background:rgba(224,90,90,.04);animation:shake .35s}
.zone-ph{color:var(--mut);font-size:.72rem;letter-spacing:.07em;width:100%;text-align:center}
.word-bank{display:flex;flex-wrap:wrap;gap:.45rem;min-height:44px;margin-bottom:1.2rem}
.chip{background:var(--s1);border:1px solid var(--bdr);border-radius:3px;padding:.4rem .8rem;font-family:'JetBrains Mono',monospace;font-size:.84rem;color:#eeeae2;cursor:pointer;user-select:none;transition:transform .12s,border-color .12s,color .12s;animation:popIn .18s backwards}
.chip:hover{background:var(--s2);border-color:var(--acc);color:var(--acc);transform:translateY(-2px)}
.chip.placed{opacity:.18;pointer-events:none}
.chip.sel{background:rgba(240,192,64,.1);border-color:var(--acc);color:var(--acc)}
.chip.tech{border-color:var(--blu);color:var(--blu)}
.chip.tech:hover,.chip.tech.sel{border-color:var(--acc);color:var(--acc)}
.hint-box{background:var(--s1);border:1px solid var(--bdr);border-left:3px solid var(--acc);border-radius:4px;padding:1rem 1.3rem;margin-bottom:.8rem}
.hint-label{font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin-bottom:.3rem}
.hint-text{font-size:.85rem;color:#eeeae2;line-height:1.5}
.hint-trans{font-size:.72rem;color:var(--blu);margin-top:.45rem;padding-top:.45rem;border-top:1px solid var(--bdr)}
.g1-actions{display:flex;gap:.7rem}
.g1-actions .btn{flex:1;width:auto;padding:.65rem;font-size:.82rem}

/* G2 duel */
.duel-arena{display:flex;align-items:stretch;gap:.8rem;margin-bottom:1rem}
.duel-card{flex:1;background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:1.1rem 1rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.35rem;transition:all .3s}
.duel-card.winner{border-color:var(--grn);background:rgba(90,224,160,.06)}.duel-card.loser{border-color:var(--red);background:rgba(224,90,90,.06);opacity:.6}
.duel-emoji{font-size:2rem}
.duel-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.85rem}
.vs-badge{display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:.95rem;color:var(--mut);flex-shrink:0;width:2rem}
.duel-sentence{background:var(--s2);border:1px solid var(--bdr);border-radius:4px;padding:.95rem 1.3rem;font-size:.92rem;line-height:1.6;text-align:center;margin-bottom:.9rem}
.duel-blank{display:inline-block;min-width:110px;border-bottom:2px solid var(--acc);color:var(--acc);font-weight:700;text-align:center;padding:0 .3rem}

/* G3 reading */
.passage-box{background:var(--s1);border:1px solid var(--bdr);border-left:3px solid var(--grn);border-radius:4px;padding:1.1rem 1.3rem;margin-bottom:.9rem;max-height:150px;overflow-y:auto}
.passage-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.85rem;color:var(--grn);margin-bottom:.5rem}
.passage-text{font-size:.8rem;line-height:1.65;color:#c8c4bc}
.question-box{background:var(--s2);border:1px solid var(--bdr);border-radius:4px;padding:.85rem 1.1rem;margin-bottom:.85rem;font-size:.88rem;line-height:1.5}
.q-label{font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--grn);margin-bottom:.35rem}

/* G4 crystal */
.crystal-ctx{background:var(--s2);border:1px solid var(--bdr);border-left:3px solid var(--pur);border-radius:4px;padding:.85rem 1.1rem;margin-bottom:.85rem}
.ctx-label{font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--pur);margin-bottom:.3rem}
.ctx-text{font-size:.8rem;line-height:1.5;color:#c8c4bc}
.crystal-sentence{font-size:.95rem;line-height:1.7;text-align:center;padding:.8rem 1rem;background:var(--s1);border:1px solid var(--bdr);border-radius:4px;margin-bottom:.9rem}
.crystal-blank{display:inline-block;min-width:105px;border-bottom:2px solid var(--pur);color:var(--pur);font-weight:700;text-align:center;padding:0 .3rem;margin:0 .3rem}

/* MCQ options (shared G2,G3,G4) */
.opt-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem}
.opt-btn{background:var(--s1);border:1px solid var(--bdr);border-radius:4px;padding:.7rem .9rem;font-family:'JetBrains Mono',monospace;font-size:.82rem;cursor:pointer;text-align:center;transition:all .15s;color:#eeeae2}
.opt-btn:hover:not(:disabled){border-color:var(--acc);color:var(--acc);background:rgba(240,192,64,.07);transform:translateY(-1px)}
.opt-btn.correct{border-color:var(--grn);color:var(--grn);background:rgba(90,224,160,.1)}
.opt-btn.wrong{border-color:var(--red);color:var(--red);background:rgba(224,90,90,.1)}
.opt-btn:disabled{cursor:default}

/* Podium */
.podium-page{padding:2rem;align-items:center}
.podium-title{font-family:'Bricolage Grotesque',sans-serif;font-size:2.4rem;font-weight:800;letter-spacing:-.05em;text-align:center;margin-bottom:.3rem}
.podium-sub{color:var(--mut);font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;text-align:center;margin-bottom:1.5rem}
.tab-row{display:flex;gap:.4rem;margin-bottom:1.4rem;flex-wrap:wrap;justify-content:center}
.tab{padding:.35rem .85rem;border-radius:20px;font-size:.7rem;letter-spacing:.08em;cursor:pointer;border:1px solid var(--bdr);color:var(--mut);transition:all .2s;white-space:nowrap}
.tab:hover{border-color:var(--acc);color:var(--acc)}
.tab.active{color:var(--bg);border-color:transparent;font-weight:700}
.podium-stand{display:flex;align-items:flex-end;justify-content:center;gap:.9rem;margin-bottom:1.8rem;width:100%;max-width:520px}
.stand-block{flex:1;max-width:145px;text-align:center}
.stand-name{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:.82rem;margin-bottom:.3rem;word-break:break-all}
.stand-pts{font-size:.65rem;color:var(--mut);margin-bottom:.3rem}
.stand-bar{border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;font-size:1.6rem}
.lb-list{width:100%;max-width:480px;margin-bottom:1.4rem}
.lb-row{display:flex;align-items:center;gap:.8rem;padding:.55rem 1rem;border-bottom:1px solid var(--bdr);font-size:.8rem}
.lb-rank{color:var(--mut);width:1.8rem;text-align:right;font-size:.68rem}
.lb-name{flex:1;font-family:'Bricolage Grotesque',sans-serif;font-weight:700}
.lb-name.me{color:var(--acc)}
.lb-score{font-weight:700}
.podium-actions{display:flex;flex-direction:column;gap:.6rem;width:100%;max-width:300px}

/* QR Code */
.qr-toggle{width:100%;background:var(--bg);border:1px dashed var(--bdr);color:var(--mut);border-radius:4px;padding:.45rem;font-size:.73rem;cursor:pointer;margin-bottom:.65rem;transition:border-color .2s,color .2s;font-family:'JetBrains Mono',monospace;text-align:center}
.qr-toggle:hover{border-color:var(--acc);color:var(--acc)}
.qr-section{text-align:center;margin-bottom:.9rem;animation:fadeIn .2s}
.qr-box{display:inline-block;background:#f5f1e8;border-radius:8px;padding:.9rem;border:2px solid var(--bdr)}
.qr-caption{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-top:.5rem}
.scan-btn{width:100%;background:transparent;border:1px dashed var(--bdr);color:var(--mut);border-radius:4px;padding:.55rem;font-size:.75rem;cursor:pointer;transition:all .2s;font-family:'JetBrains Mono',monospace;margin-top:.4rem}
.scan-btn:hover{border-color:var(--acc);color:var(--acc);background:rgba(240,192,64,.04)}
.qr-overlay{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1.5rem;animation:fadeIn .15s}
.qr-overlay-title{font-family:'Bricolage Grotesque',sans-serif;font-size:1.15rem;font-weight:700;color:#eeeae2;margin:0;letter-spacing:-.02em}
.qr-scanner-hint{color:var(--mut);font-size:.72rem;text-align:center;max-width:260px;line-height:1.6}
.qr-scanner-err{color:var(--red);font-size:.73rem;text-align:center;max-width:260px}

.spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--bdr);border-top-color:var(--acc);border-radius:50%;animation:spin .65s linear infinite;vertical-align:middle;margin-right:.35rem}
.status{font-size:.7rem;color:var(--mut);text-align:center;margin:.8rem 0;min-height:18px}
.slide-up{animation:slideUp .3s ease both}

@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes popIn{from{transform:scale(.75);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes timerPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.05)}}

@media(max-width:480px){
  .card{padding:2rem 1.3rem}.chip{font-size:.76rem;padding:.36rem .65rem}
  .duel-arena{flex-direction:column;gap:.4rem}.vs-badge{width:100%;height:1.2rem}
  .opt-grid{grid-template-columns:1fr}.game-grid{grid-template-columns:1fr}
  .player-grid{grid-template-columns:1fr 1fr}.host-dash{padding:.7rem}
}
`;

function injectCSS(css) {
  if (document.getElementById('ps-css')) return;
  const s = document.createElement('style'); s.id='ps-css'; s.textContent=css;
  document.head.appendChild(s);
}

// ── Shared UI ──────────────────────────────────────────────────────────────────
function DiffPill({ diff }) {
  const m = DIFF_META[diff];
  return <span className="diff-pill" style={{color:m.color,borderColor:m.color,background:`${m.color}14`}}>⬤ {m.label}</span>;
}

function CountdownTimer({ timeLeft, totalTime, color }) {
  const pct = Math.max(0, (timeLeft / totalTime) * 100);
  const urgent = timeLeft <= 5;
  const c = urgent ? 'var(--red)' : (color || 'var(--acc)');
  return (
    <div className="timer-row">
      <div className="timer-track"><div className="timer-fill" style={{width:`${pct}%`,background:c}}/></div>
      <div className={`timer-num${urgent?' urgent':''}`} style={{color:c}}>{Math.ceil(timeLeft)}</div>
    </div>
  );
}

// ── QR Code display (host lobby) ──────────────────────────────────────────────
// QR encodes just the room code as plain text — simple, fast, no URL needed
function QRCodeDisplay({ code }) {
  const [src, setSrc] = useState('');
  const joinUrl = `${window.location.origin}/?join=${code}`;
  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      margin: 2, width: 200, errorCorrectionLevel: 'M',
      color: { dark: '#080810', light: '#f5f1e8' },
    }).then(setSrc).catch(()=>{});
  }, [joinUrl]);
  if (!src) return <div className="qr-section"><div style={{color:'var(--mut)',fontSize:'.72rem'}}>Generando QR…</div></div>;
  return (
    <div className="qr-section">
      <div className="qr-box">
        <img src={src} width={176} height={176} alt="QR sala" style={{display:'block'}}/>
      </div>
      <div className="qr-caption">📱 Escanea o abre el link para unirte</div>
    </div>
  );
}

// ── QR Scanner — live camera via jsQR ─────────────────────────────────────────
// Server now runs HTTPS so getUserMedia always works.
// jsQR scans video frames directly — no photo needed.
function QRScanner({ onScan, onClose }) {
  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [errMsg, setErrMsg] = useState('');

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const doneRef   = useRef(false);

  useEffect(() => {
    let alive = true;

    const tick = () => {
      if (doneRef.current || !alive) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr  = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (qr?.data) {
        doneRef.current = true;
        streamRef.current?.getTracks().forEach(t => t.stop());
        onScan(qr.data.trim()); // pass raw — handleScan will parse URL or plain code
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('scanning');
        tick();
      } catch (err) {
        if (!alive) return;
        if (err.name === 'NotAllowedError') {
          setErrMsg('Permiso de cámara denegado. Habilítalo en la configuración del navegador.');
        } else {
          setErrMsg(`No se pudo iniciar la cámara: ${err.message}`);
        }
        setStatus('error');
      }
    })();

    return () => {
      alive = false;
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="qr-overlay">
      <div className="qr-overlay-title">📷 Escanear código QR</div>

      <div style={{position:'relative', width:280, height:280, flexShrink:0}}>
        <video ref={videoRef} playsInline muted
          style={{width:280, height:280, borderRadius:10, objectFit:'cover',
                  border:'2px solid var(--acc)', background:'#000', display:'block'}}/>
        <canvas ref={canvasRef} style={{display:'none'}}/>

        {/* Scanner frame overlay */}
        {status === 'scanning' && (
          <>
            <div style={{
              position:'absolute', inset:35,
              border:'2px solid var(--acc)', borderRadius:6,
              boxShadow:'0 0 0 1000px rgba(0,0,0,.45)',
              pointerEvents:'none',
            }}/>
            {/* corner accents */}
            {[{top:35,left:35},{top:35,right:35},{bottom:35,left:35},{bottom:35,right:35}].map((s,i)=>(
              <div key={i} style={{
                position:'absolute', width:18, height:18,
                borderColor:'var(--acc)', borderStyle:'solid', borderWidth:0,
                ...(s.top    !== undefined ? {top:   s.top-2,    borderTopWidth:3}    : {bottom: s.bottom-2,    borderBottomWidth:3}),
                ...(s.left   !== undefined ? {left:  s.left-2,   borderLeftWidth:3}   : {right:  s.right-2,     borderRightWidth:3}),
                borderRadius: s.top!==undefined&&s.left!==undefined?'4px 0 0 0':s.top!==undefined?'0 4px 0 0':s.left!==undefined?'0 0 0 4px':'0 0 4px 0',
                pointerEvents:'none',
              }}/>
            ))}
          </>
        )}

        {status === 'starting' && (
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',
                       alignItems:'center',justifyContent:'center',gap:'.5rem',
                       background:'rgba(8,8,16,.7)',borderRadius:10}}>
            <span className="spinner" style={{width:20,height:20,borderWidth:3}}/>
            <span style={{fontSize:'.72rem',color:'var(--mut)'}}>Iniciando cámara…</span>
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <div className="qr-scanner-hint">
          Apunta al QR del host · Detecta automáticamente
        </div>
      )}
      {status === 'error' && (
        <div className="qr-scanner-err">{errMsg}</div>
      )}

      <button className="btn secondary" style={{maxWidth:200}} onClick={onClose}>
        ✕ Cancelar
      </button>
    </div>
  );
}

// ── Screen: Login ──────────────────────────────────────────────────────────────
function LoginScreen({ onHost, onPlayer, onPodium }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('player');
  const [err, setErr] = useState('');
  const submit = () => {
    if (!name.trim() || name.trim().length < 2) { setErr('Escribe al menos 2 caracteres'); return; }
    role === 'host' ? onHost(name.trim()) : onPlayer(name.trim());
  };
  return (
    <div className="page">
      <div className="card slide-up">
        <div className="brand">GRAMMAR <em>X</em></div>
        <div className="brand-sub">English Grammar · 4 Minijuegos</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>Tu nombre</label>
          <input type="text" value={name} maxLength={20} placeholder="Escribe tu nombre"
            onChange={e=>{setName(e.target.value);setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/>
        </div>
        <div className="role-row">
          <div className={`role-card${role==='host'?' active':''}`} onClick={()=>setRole('host')}>
            <div className="role-icon">🎮</div><div className="role-name">Host</div><div className="role-desc">Controla la sala</div>
          </div>
          <div className={`role-card${role==='player'?' active':''}`} onClick={()=>setRole('player')}>
            <div className="role-icon">👤</div><div className="role-name">Jugador</div><div className="role-desc">Únete con un código</div>
          </div>
        </div>
        <button className="btn" style={role==='host'?{background:'linear-gradient(135deg,var(--acc),#e0a030)'}:{}} onClick={submit}>
          {role==='host'?'🎮 Crear sala →':'▶ Unirse →'}
        </button>
        <div className="link-row"><a onClick={onPodium}>Ver leaderboard 🏆</a></div>
      </div>
    </div>
  );
}

// ── Screen: Join ───────────────────────────────────────────────────────────────
function JoinScreen({ user, initialCode='', onJoined, onBack }) {
  const [code, setCode] = useState(initialCode);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Auto-join when arriving via QR link (?join=CODE)
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (initialCode && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      doJoin(initialCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doJoin = async (raw) => {
    const c = (raw ?? code).trim().toUpperCase();
    if (c.length < 4) { setErr('Ingresa el código de sala'); return; }
    setLoading(true); setErr('');
    try {
      await emit('join', { code: c, name: user });
      onJoined(c);
    } catch (e) { setErr(e.message || 'Error de conexión. Intenta de nuevo.'); setLoading(false); }
  };

  const handleScan = scanned => {
    setScanning(false);
    let extracted = scanned;
    try {
      const url = new URL(scanned);
      const joinParam = url.searchParams.get('join');
      if (joinParam) extracted = joinParam;
    } catch { /* not a URL — use as-is */ }
    const clean = extracted.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(clean);
    doJoin(clean);
  };

  return (
    <div className="page">
      {scanning && <QRScanner onScan={handleScan} onClose={()=>setScanning(false)}/>}
      <div className="card slide-up">
        <div className="brand">GRAMMAR <em>X</em></div>
        <div className="brand-sub">Únete a la sala</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>Código de sala</label>
          <input type="text" value={code} maxLength={8} placeholder="Ej: ABC123"
            onChange={e=>{setCode(e.target.value.toUpperCase());setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&doJoin()}
            style={{textTransform:'uppercase',letterSpacing:'.2em',fontSize:'1.2rem',textAlign:'center'}}
            autoFocus/>
        </div>
        <button className="btn" onClick={()=>doJoin()} disabled={loading}>
          {loading?<><span className="spinner"/>Conectando...</>:'Entrar →'}
        </button>
        <button className="scan-btn" onClick={()=>setScanning(true)}>
          📷 Escanear código QR
        </button>
        <button className="btn secondary" onClick={onBack} style={{marginTop:'.4rem'}}>← Volver</button>
      </div>
    </div>
  );
}

// ── Screen: Host Lobby ─────────────────────────────────────────────────────────
function HostLobbyScreen({ user, sessionCode, onStart, onCancel }) {
  const [players, setPlayers] = useState([]);
  const [gameId, setGameId] = useState('G1');
  const [tpr, setTpr] = useState(20);
  const [starting, setStarting] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    // Rejoin socket room and get current state
    socket.emit('rejoin', { code: sessionCode }, state => {
      if (state?.players) setPlayers(state.players.map(p => ({ name: p.name })));
    });
    const onState = state => setPlayers(state.players?.map(p => ({ name: p.name })) || []);
    socket.on('state', onState);
    return () => socket.off('state', onState);
  }, [sessionCode]);

  const handleStart = async () => {
    if (!players.length) return;
    setStarting(true);
    const pool = gameId==='G1'?G1_DATA:gameId==='G2'?G2_DATA:gameId==='G3'?G3_DATA:G4_DATA;
    const rounds = pickRounds(pool);
    try {
      await emit('start', { code: sessionCode, rounds, gameId, tpr });
      onStart(gameId, tpr);
    } catch { setStarting(false); }
  };

  const g = GAMES[gameId];
  return (
    <div className="page">
      <div className="lobby-wrap slide-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div><div className="brand" style={{fontSize:'1.4rem',marginBottom:0}}>GRAMMAR <em>X</em></div>
          <div className="host-badge">🎮 HOST: {user}</div></div>
        </div>
        <div className="code-display">
          <div className="code-label">Código de sala — proyéctalo</div>
          <div className="code-value">{sessionCode}</div>
          <div className="code-hint">Los jugadores entran y escriben este código</div>
        </div>
        <button className="qr-toggle" onClick={()=>setShowQR(q=>!q)}>
          {showQR ? '▲ Ocultar QR' : '📱 Mostrar QR para escanear'}
        </button>
        {showQR && <QRCodeDisplay code={sessionCode}/>}
        <div style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)',marginBottom:'.5rem'}}>🎯 Minijuego</div>
        <div className="game-grid">
          {Object.values(GAMES).map(gm=>(
            <div key={gm.id} className={`game-tile${gameId===gm.id?' active':''}`}
              style={gameId===gm.id?{borderColor:gm.color}:{}}
              onClick={()=>setGameId(gm.id)}>
              <div className="gt-icon">{gm.icon}</div>
              <div className="gt-name" style={gameId===gm.id?{color:gm.color}:{}}>{gm.name}</div>
              <div className="gt-sub">{gm.sub}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)',marginBottom:'.5rem'}}>⏱ Tiempo por pregunta</div>
        <div className="time-row">
          {TIME_OPTIONS.map(t=>(
            <div key={t} className={`time-btn${tpr===t?' active':''}`} onClick={()=>setTpr(t)}>{t}s</div>
          ))}
        </div>
        <div className="players-box">
          <div className="players-header"><span className="players-title">Jugadores conectados</span><span className="players-count">{players.length}</span></div>
          <div className="player-list">
            {!players.length?<div className="player-empty">Esperando jugadores...</div>
              :players.map((p,i)=><div key={i} className="player-item"><div className="player-dot"/><span>{p.name}</span></div>)}
          </div>
        </div>
        <button className="btn" onClick={handleStart} disabled={!players.length||starting}
          style={{fontSize:'1.05rem',padding:'.95rem',background:players.length?g.color:'var(--mut)',color:'#080810',marginBottom:'.6rem'}}>
          {starting?<><span className="spinner"/>Iniciando...</>:!players.length?'⏳ Esperando jugadores...':`▶ INICIAR ${g.icon} ${g.name} (${players.length})`}
        </button>
        <button className="btn secondary" onClick={onCancel}>Cancelar sala</button>
      </div>
    </div>
  );
}

// ── Screen: Host Game Dashboard ────────────────────────────────────────────────
function HostGameScreen({ sessionCode, onGameOver }) {
  const [rs, setRs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const rsRef2       = useRef(null);
  const clockOffset2 = useRef(0);

  useEffect(() => {
    socket.emit('rejoin', { code: sessionCode }, state => {
      if (state && !state.error) {
        if (state.serverTime) clockOffset2.current = Date.now() - state.serverTime;
        rsRef2.current = state;
        setRs(state);
      }
    });
    const onState = data => {
      if (data && !data.error) {
        if (data.serverTime) clockOffset2.current = Date.now() - data.serverTime;
        rsRef2.current = data;
        setRs(data);
        setAdvancing(false);
      }
    };
    socket.on('state', onState);
    return () => socket.off('state', onState);
  }, [sessionCode]);

  // Timer using refs — immune to stale closures and clock skew
  useEffect(() => {
    const id = setInterval(() => {
      const cur = rsRef2.current;
      if (!cur?.roundStartedAt || cur.status !== 'playing') return;
      const syncedNow = Date.now() - clockOffset2.current;
      const left = Math.max(0, cur.timePerRound - (syncedNow - cur.roundStartedAt) / 1000);
      setTimeLeft(left);
    }, 200);
    return () => clearInterval(id);
  }, [sessionCode]);

  const handleAdvance = () => {
    if (advancing) return;
    setAdvancing(true);
    const next = (rs?.currentRound ?? 0) + 1;
    const isLast = next >= (rs?.totalRounds ?? 0);
    if (isLast) {
      emit('end', { code: sessionCode })
        .then(res => onGameOver(res.scores || rs?.players || []))
        .catch(() => onGameOver(rs?.players || []));
    } else {
      // Optimistic update for immediate host feedback
      setRs(prev => prev ? {...prev, currentRound:next, roundStartedAt:Date.now(), answeredCount:0, players:(prev.players||[]).map(p=>({...p,answered:false}))} : prev);
      socket.emit('advance', { code: sessionCode, next });
    }
  };

  if (!rs) return <div className="page"><div className="status"><span className="spinner"/>Cargando...</div></div>;

  const g = GAMES[rs.gameId] || GAMES.G1;
  const round = rs.rounds?.[rs.currentRound];
  const isTimeUp = timeLeft <= 0;
  const allAnswered = rs.answeredCount >= rs.totalPlayers && rs.totalPlayers > 0;
  const canAdvance = isTimeUp || allAnswered;
  const isLastRound = rs.currentRound >= rs.totalRounds - 1;

  return (
    <div className="page" style={{justifyContent:'flex-start',paddingTop:'1rem'}}>
      <div className="host-dash slide-up">
        <div className="dash-header">
          <div className="dash-title">{g.icon} {g.name} <span style={{fontSize:'.8rem',fontWeight:400,color:'var(--mut)'}}>— DASHBOARD</span></div>
          <div className="dash-meta">Sala {sessionCode} · Ronda {(rs.currentRound||0)+1}/{rs.totalRounds||0}</div>
        </div>

        <CountdownTimer timeLeft={timeLeft} totalTime={rs.timePerRound||20} color={g.color}/>

        {round && (
          <div className="q-preview">
            <div className="q-preview-label">Pregunta actual</div>
            <div className="q-preview-text">
              {rs.gameId==='G1' && <>{round.s}</>}
              {rs.gameId==='G2' && <>{round.tpl.replace('___','______')}</>}
              {rs.gameId==='G3' && <><b>{round.title}</b> — {round.q}</>}
              {rs.gameId==='G4' && <><b>Situación:</b> {round.ctx}<br/>{round.tpl.replace('___','______')}</>}
            </div>
            {canAdvance && (
              <div className="q-preview-answer">
                ✓ {rs.gameId==='G1' ? round.s : round.opts?.[0]}
              </div>
            )}
          </div>
        )}

        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
            <span style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)'}}>Jugadores</span>
            <span style={{fontSize:'.72rem',color:'var(--grn)',fontWeight:700}}>{rs.answeredCount}/{rs.totalPlayers} respondieron</span>
          </div>
          <div className="player-grid">
            {(rs.players||[]).map((p,i)=>(
              <div key={i} className={`pg-card${p.answered?' answered':' pending'}`}>
                <div>
                  <div className="pg-name">{i===0&&'🥇 '}{i===1&&'🥈 '}{i===2&&'🥉 '}{p.name}</div>
                  <div className="pg-score">{p.totalScore} pts</div>
                </div>
                <div className="pg-status">{p.answered?'✅':'⏳'}</div>
              </div>
            ))}
            {!rs.players?.length && <div style={{color:'var(--mut)',fontSize:'.78rem',gridColumn:'1/-1',textAlign:'center',padding:'1rem'}}>Sin jugadores</div>}
          </div>
        </div>

        <button className={`advance-btn${canAdvance?(isLastRound?' end':' ready'):' waiting'}`}
          onClick={canAdvance?handleAdvance:undefined} disabled={advancing}>
          {advancing?<><span className="spinner"/>...</>
            :!canAdvance?`⏳ Esperando... (${rs.answeredCount}/${rs.totalPlayers})`
            :isLastRound?'🏁 Terminar juego y ver resultados'
            :`▶ Siguiente pregunta (${(rs.currentRound||0)+2}/${rs.totalRounds})`}
        </button>
      </div>
    </div>
  );
}

// ── Screen: Host Results ───────────────────────────────────────────────────────
function HostResultsScreen({ sessionCode, players, onNewGame, onClose }) {
  const sorted = [...players].sort((a,b)=>(b.score||b.totalScore||0)-(a.score||a.totalScore||0));
  const top3 = sorted.slice(0,3);
  const rest = sorted.slice(3);
  const podMeta = [{medal:'🥈',h:80,bg:'var(--silver)'},{medal:'🥇',h:110,bg:'var(--gold)'},{medal:'🥉',h:60,bg:'var(--bronze)'}];
  const podOrder = [top3[1],top3[0],top3[2]].filter(Boolean);
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    setClosing(true);
    try { await emit('close', { code: sessionCode }); } catch {}
    onClose();
  };

  const getScore = p => p.score ?? p.totalScore ?? 0;

  return (
    <div className="page">
      <div className="results-wrap slide-up">
        <div className="brand" style={{textAlign:'center',marginBottom:'.2rem'}}>Resultados 🏆</div>
        <div className="brand-sub" style={{textAlign:'center',marginBottom:'1rem'}}>Sala {sessionCode}</div>

        {podOrder.length>0&&(
          <div className="results-podium">
            {podOrder.map((p,i)=>(
              <div key={i} className="rp-block">
                <div className="rp-name">{p.name}</div>
                <div className="rp-score">{getScore(p)} pts</div>
                <div className="rp-bar" style={{height:podMeta[i].h,background:podMeta[i].bg}}>{podMeta[i].medal}</div>
              </div>
            ))}
          </div>
        )}

        {rest.length>0&&(
          <div className="results-list">
            {rest.map((p,i)=>(
              <div key={i} className="rl-row">
                <div className="rl-rank">#{i+4}</div>
                <div className="rl-name">{p.name}</div>
                <div className="rl-score" style={{color:'var(--acc)'}}>{getScore(p)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="action-row">
          <button className="btn" onClick={onNewGame}>🎮 Siguiente juego</button>
          <button className="btn danger" onClick={handleClose} disabled={closing}>
            {closing?<><span className="spinner"/>...</>:'🚪 Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen: Player Lobby ───────────────────────────────────────────────────────
function PlayerLobbyScreen({ user, sessionCode, onStart }) {
  const [players, setPlayers] = useState([]);
  const [hostName, setHostName] = useState('');
  const [gameInfo, setGameInfo] = useState(null);

  useEffect(() => {
    const applyState = data => {
      if (!data) return;
      if (data.host) setHostName(data.host);
      if (data.gameId) setGameInfo(GAMES[data.gameId]);
      setPlayers(data.players?.map(p => ({ name: p.name })) || []);
      if (data.status === 'playing') onStart();
    };
    socket.emit('rejoin', { code: sessionCode }, applyState);
    socket.on('state', applyState);
    return () => socket.off('state', applyState);
  }, [sessionCode]);

  return (
    <div className="page">
      <div className="lobby-wrap slide-up">
        <div style={{textAlign:'center',marginBottom:'1.2rem'}}>
          <div className="brand" style={{fontSize:'1.4rem'}}>GRAMMAR <em>X</em></div>
          <div className="brand-sub">Sala {sessionCode}</div>
        </div>
        <div className="code-display" style={{borderColor:'var(--blu)'}}>
          <div className="code-label">Conectado como</div>
          <div className="code-value" style={{color:'var(--blu)',fontSize:'2rem'}}>{user}</div>
          <div className="code-hint">{hostName?`Host: ${hostName} · `:''}Sala: <b>{sessionCode}</b></div>
        </div>
        {gameInfo&&(
          <div className="hint-box" style={{marginBottom:'1rem',borderLeftColor:gameInfo.color}}>
            <div className="hint-label" style={{color:gameInfo.color}}>{gameInfo.icon} Minijuego seleccionado</div>
            <div className="hint-text" style={{fontSize:'.85rem'}}>{gameInfo.name} — {gameInfo.sub}</div>
          </div>
        )}
        <div className="waiting-anim">
          <div className="waiting-dot"/><div className="waiting-dot"/><div className="waiting-dot"/>
          <span style={{marginLeft:'.6rem'}}>Esperando que el host inicie</span>
        </div>
        <div className="players-box">
          <div className="players-header"><span className="players-title">En la sala</span><span className="players-count">{players.length}</span></div>
          <div className="player-list">
            {!players.length?<div className="player-empty">...</div>
              :players.map((p,i)=>(
                <div key={i} className="player-item"><div className="player-dot"/>
                  <span style={p.name===user?{color:'var(--acc)',fontWeight:700}:{}}>{p.name}{p.name===user?' (tú)':''}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Question sub-components ────────────────────────────────────────────────────

function QuestionG1({ round, onAnswer, locked, revealed }) {
  const [words] = useState(() => shuffle(round.s.split(' ')));
  const [placed, setPlaced] = useState([]);
  const [zone, setZone] = useState('idle');
  const pendingZoneRef = useRef(null);

  // Show the result only once the round is revealed (all answered or time up)
  useEffect(() => {
    if (revealed && pendingZoneRef.current) {
      setZone(pendingZoneRef.current);
      pendingZoneRef.current = null;
    }
  }, [revealed]);

  const place  = i => { if(locked)return; setPlaced(p=>p.includes(i)?p:[...p,i]); setZone('active'); };
  const remove = pos => { if(locked)return; setPlaced(p=>{const n=[...p];n.splice(pos,1);return n;}); };
  const clear  = () => { if(locked)return; setPlaced([]); setZone('idle'); };

  const check = () => {
    if (locked || !placed.length) return;
    const correct = round.s.split(' ');
    const ans = placed.map(i=>words[i]);
    const isCorrect = JSON.stringify(ans)===JSON.stringify(correct);
    onAnswer(isCorrect);
    pendingZoneRef.current = isCorrect ? 'correct' : 'wrong'; // held until reveal
  };

  return (
    <>
      <div className={`answer-zone ${zone!=='idle'?zone:'active'}`}>
        {!placed.length?<span className="zone-ph">Toca las palabras en el orden correcto ↓</span>
          :placed.map((wi,pos)=><div key={pos} className="chip sel" onClick={()=>remove(pos)}>{words[wi]}</div>)}
      </div>
      <div className="word-bank">
        {words.map((w,i)=>(
          <div key={i} className={`chip${placed.includes(i)?' placed':''}${isTech(w)&&!placed.includes(i)?' tech':''}`}
            style={{animationDelay:`${i*.04}s`}} onClick={()=>place(i)}>{w}</div>
        ))}
      </div>
      {!locked && (
        <div className="g1-actions">
          <button className="btn danger" onClick={clear}>✕ Limpiar</button>
          <button className="btn" onClick={check}>Verificar →</button>
        </div>
      )}
    </>
  );
}

function QuestionMCQ({ round, gameId, onAnswer, locked, chosenIdx, opts, revealed }) {
  const parts = round.tpl ? round.tpl.split('___') : ['',''];
  const filledText = revealed && chosenIdx !== null ? (opts[chosenIdx]?.text ?? '___') : '___';

  return (
    <>
      {gameId==='G2' && (
        <>
          <div className="duel-arena">
            <div className="duel-card"><div className="duel-emoji">{round.left.split(' ')[0]}</div><div className="duel-name">{round.left.split(' ').slice(1).join(' ')}</div></div>
            <div className="vs-badge">VS</div>
            <div className="duel-card"><div className="duel-emoji">{round.right.split(' ')[0]}</div><div className="duel-name">{round.right.split(' ').slice(1).join(' ')}</div></div>
          </div>
          <div className="duel-sentence">{parts[0]}<span className="duel-blank">{filledText}</span>{parts[1]}</div>
        </>
      )}
      {gameId==='G3' && (
        <>
          <div className="passage-box"><div className="passage-title">🔍 {round.title}</div><div className="passage-text">{round.passage}</div></div>
          <div className="question-box"><div className="q-label">Pregunta</div>{round.q}</div>
        </>
      )}
      {gameId==='G4' && (
        <>
          <div className="crystal-ctx"><div className="ctx-label">🔮 Situación</div><div className="ctx-text">{round.ctx}</div></div>
          <div className="crystal-sentence">
            {parts[0]}<span className="crystal-blank">{filledText}</span>{parts[1]}
          </div>
        </>
      )}
      <div className="opt-grid">
        {opts.map((o,i)=>(
          <button key={i}
            className={`opt-btn${revealed&&chosenIdx===i?(o.isCorrect?' correct':' wrong'):''}${revealed&&o.isCorrect&&chosenIdx!==i?' correct':''}`}
            onClick={()=>onAnswer(o.isCorrect,i)} disabled={locked}>
            {o.text}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Screen: Player Game ────────────────────────────────────────────────────────
function PlayerGameScreen({ user, sessionCode, onSessionClosed }) {
  const [rs, setRs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [myScore, setMyScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(null); // shown only after reveal
  const [opts, setOpts] = useState([]);
  const [chosenIdx, setChosenIdx] = useState(null);
  const submitting     = useRef(false);
  const optsKey        = useRef('');
  const prevToken      = useRef('');
  const rsRef          = useRef(null);   // always holds latest rs for timer
  const hasAnsweredRef = useRef(false);  // mirror of hasAnswered for timer closure
  const clockOffset    = useRef(0);      // ms this device's clock is ahead of server

  function buildOpts(round, gameId) {
    if (!round || gameId==='G1') return [];
    return shuffle(round.opts.map((o,i)=>({text:o, isCorrect:i===0})));
  }

  // Reveal answers when everyone answered OR time ran out
  const allAnswered = (rs?.totalPlayers ?? 0) > 0 && (rs?.answeredCount ?? 0) >= (rs?.totalPlayers ?? 1);
  const revealed    = (timeLeft <= 0 && rs?.status === 'playing') || allAnswered;
  const feedback    = revealed ? pendingFeedback : null;

  useEffect(() => {
    const applyState = data => {
      if (!data || data.error) return;
      if (data.status === 'closed') { onSessionClosed(); return; }

      // Correct for clock skew: if device is 5s ahead, offset = +5000
      if (data.serverTime) clockOffset.current = Date.now() - data.serverTime;

      // New game token → full reset
      if (data.gameToken !== prevToken.current) {
        prevToken.current = data.gameToken;
        setMyScore(0);
        optsKey.current = '';
        submitting.current = false;
      }

      // New round → reset answer state and build opts once
      const key = `${data.gameToken}-${data.currentRound}`;
      if (optsKey.current !== key) {
        optsKey.current        = key;
        hasAnsweredRef.current = false;
        submitting.current     = false;
        setOpts(buildOpts(data.rounds?.[data.currentRound], data.gameId));
        setHasAnswered(false);
        setPendingFeedback(null);
        setChosenIdx(null);
      }

      rsRef.current = data;
      setRs(data);
    };

    socket.emit('rejoin', { code: sessionCode }, applyState);
    socket.on('state', applyState);
    return () => socket.off('state', applyState);
  }, [sessionCode]);

  // Client-side countdown timer — reads refs directly, no stale closure issues
  useEffect(() => {
    const id = setInterval(() => {
      const cur = rsRef.current;
      if (!cur?.roundStartedAt || cur.status !== 'playing') return;
      // Subtract clock offset so we use server-equivalent time
      const syncedNow = Date.now() - clockOffset.current;
      const left = Math.max(0, cur.timePerRound - (syncedNow - cur.roundStartedAt) / 1000);
      setTimeLeft(left);
      if (left <= 0 && !submitting.current && !hasAnsweredRef.current) {
        submitting.current     = true;
        hasAnsweredRef.current = true;
        setHasAnswered(true);
        setPendingFeedback({ ok: false, msg: '⏰ Tiempo agotado — +0 pts', type: 'timeout' });
        setMyScore(s => s);
        socket.emit('answer', {
          code: sessionCode, name: user,
          roundIndex: cur.currentRound, score: 0, gameToken: cur.gameToken,
        });
      }
    }, 200);
    return () => clearInterval(id);
  }, [sessionCode, user]);

  const doSubmit = (score, isCorrect) => {
    if (submitting.current || hasAnsweredRef.current) return;
    submitting.current     = true;
    hasAnsweredRef.current = true;
    setHasAnswered(true);
    setMyScore(s => s + score);
    let msg;
    if (isCorrect) {
      const cur = rsRef.current;
      const base      = (cur?.rounds?.[cur.currentRound]?.d ?? 1) * 100;
      const timeBonus = score - base;
      msg = timeBonus > 0
        ? `✓ Correcto! +${base} + ⚡${timeBonus} velocidad = ${score} pts`
        : `✓ Correcto! +${score} pts`;
    } else {
      msg = '✗ Incorrecto — +0 pts';
    }
    setPendingFeedback({ ok: isCorrect, msg });
    const cur = rsRef.current;
    if (cur) socket.emit('answer', { code:sessionCode, name:user, roundIndex:cur.currentRound, score, gameToken:cur.gameToken });
  };

  const handleAnswer = (isCorrect, optIdx) => {
    if (hasAnsweredRef.current || submitting.current) return;
    setChosenIdx(optIdx);
    const cur = rsRef.current;
    if (!cur) return;
    const score = calcScore(isCorrect, timeLeft, cur.timePerRound, cur.rounds[cur.currentRound].d);
    doSubmit(score, isCorrect);
  };

  const handleG1Answer = isCorrect => {
    const cur = rsRef.current;
    if (!cur) return;
    const score = calcScore(isCorrect, timeLeft, cur.timePerRound, cur.rounds[cur.currentRound].d);
    doSubmit(score, isCorrect);
  };

  if (!rs || rs.status==='waiting') {
    return (
      <div className="page">
        <div className="waiting-overlay slide-up">
          <div className="big-icon">⏳</div>
          <div className="big-msg">Esperando al host...</div>
          <div className="sub-msg">Sala {sessionCode}</div>
          <div className="waiting-anim" style={{marginTop:'.5rem'}}>
            <div className="waiting-dot"/><div className="waiting-dot"/><div className="waiting-dot"/>
          </div>
        </div>
      </div>
    );
  }

  if (rs.status==='ended') {
    return (
      <div className="page">
        <div className="waiting-overlay slide-up">
          <div className="big-icon">🏆</div>
          <div className="big-msg">¡Juego terminado!</div>
          <div className="sub-msg">El host está eligiendo el siguiente juego...</div>
          <div style={{marginTop:'1rem',fontSize:'.9rem',color:'var(--acc)',fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:800}}>Tu puntuación: {myScore} pts</div>
          <div className="waiting-anim" style={{marginTop:'.5rem'}}>
            <div className="waiting-dot"/><div className="waiting-dot"/><div className="waiting-dot"/>
          </div>
        </div>
      </div>
    );
  }

  const round = rs.rounds?.[rs.currentRound];
  const g = GAMES[rs.gameId] || GAMES.G1;
  if (!round) return null;

  return (
    <div className="page" style={{justifyContent:'flex-start',paddingTop:'1rem'}}>
      <div className="player-game">
        <div className="phud">
          <div className="phud-left">
            <div className="pname">{user}</div>
            <div className="proom">{g.icon} {g.name} · Sala {sessionCode}</div>
            <div className="pscore">Puntuación <b>{myScore}</b></div>
          </div>
        </div>

        <div className="prog-wrap">
          <div className="prog-bar" style={{width:`${((rs.currentRound||0)/rs.totalRounds)*100}%`,background:g.color}}/>
        </div>

        <CountdownTimer timeLeft={timeLeft} totalTime={rs.timePerRound||20} color={g.color}/>

        <div className="round-meta" style={{marginTop:'.7rem'}}>
          <span className="round-lbl">Pregunta {(rs.currentRound||0)+1}/{rs.totalRounds}</span>
          <DiffPill diff={round.d}/>
        </div>

        {feedback && (
          <div className={`feedback ${feedback.type==='timeout'?'timeout':feedback.ok?'ok':'fail'}`}>{feedback.msg}</div>
        )}

        <div className="slide-up" key={rs.currentRound + rs.gameToken}>
          {rs.gameId==='G1'
            ? <QuestionG1 round={round} onAnswer={handleG1Answer} locked={hasAnswered} revealed={revealed}/>
            : <QuestionMCQ round={round} gameId={rs.gameId} onAnswer={handleAnswer} locked={hasAnswered} revealed={revealed} chosenIdx={chosenIdx} opts={opts}/>
          }
        </div>

        {hasAnswered && (
          <div style={{textAlign:'center',fontSize:'.72rem',color:'var(--mut)',marginTop:'.5rem'}}>
            <div className="waiting-anim"><div className="waiting-dot"/><div className="waiting-dot"/><div className="waiting-dot"/>
              <span style={{marginLeft:'.5rem'}}>Esperando la siguiente pregunta...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Screen: Podium ─────────────────────────────────────────────────────────────
const PODIUM_TABS = [
  { id:'all', label:'🌟 Total',          color:'var(--gold)' },
  { id:'G1',  label:'⏰ Past Simple',    color:'var(--acc)'  },
  { id:'G2',  label:'⚔️  Comparatives',  color:'var(--red)'  },
  { id:'G3',  label:'🔍 Pres. Perfect',  color:'var(--grn)'  },
  { id:'G4',  label:'🔮 Future',         color:'var(--pur)'  },
];

function PodiumScreen({ user }) {
  const [activeTab, setActiveTab] = useState('all');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all(
      PODIUM_TABS.map(t => new Promise(res => socket.emit('scores', { gameId: t.id }, rows => res({ id: t.id, rows: Array.isArray(rows)?rows:[] }))))
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r.rows; });
      setData(map);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tab = PODIUM_TABS.find(t=>t.id===activeTab)||PODIUM_TABS[0];
  const entries = [...(data[activeTab]||[])].sort((a,b)=>b.score-a.score);
  const top3 = entries.slice(0,3);
  const rest = entries.slice(3,10);
  const podOrder = [top3[1],top3[0],top3[2]].filter(Boolean);
  const podMeta = [{medal:'🥈',h:85,bg:'var(--silver)'},{medal:'🥇',h:115,bg:'var(--gold)'},{medal:'🥉',h:65,bg:'var(--bronze)'}];

  return (
    <div className="page podium-page">
      <div className="podium-title">🏆 Leaderboard</div>
      <div className="podium-sub">Mejores puntuaciones</div>
      <div className="tab-row">
        {PODIUM_TABS.map(t=>(
          <div key={t.id} className={`tab${activeTab===t.id?' active':''}`}
            style={activeTab===t.id?{background:t.color}:{}}
            onClick={()=>setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>
      {loading?<div className="status"><span className="spinner"/>Cargando...</div>
        :!entries.length?<div className="status">Sin puntuaciones aún</div>
        :<>
          <div className="podium-stand slide-up">
            {podOrder.map((e,i)=>(
              <div key={i} className="stand-block">
                <div className="stand-name">{e.name}</div>
                <div className="stand-pts">{e.score} pts</div>
                <div className="stand-bar" style={{height:podMeta[i].h,background:podMeta[i].bg}}>{podMeta[i].medal}</div>
              </div>
            ))}
          </div>
          {rest.length>0&&(
            <div className="lb-list slide-up">
              {rest.map((e,i)=>(
                <div key={i} className="lb-row">
                  <div className="lb-rank">#{i+4}</div>
                  <div className={`lb-name${e.name===user?' me':''}`}>{e.name}</div>
                  <div className="lb-score" style={{color:tab.color}}>{e.score}</div>
                </div>
              ))}
            </div>
          )}
          <button className="btn secondary" style={{maxWidth:240,marginTop:'.5rem'}} onClick={fetchAll}>↻ Actualizar</button>
        </>
      }
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  injectCSS(CSS);

  // Read ?join= from URL (player opened QR link directly in browser)
  const [urlCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return (p.get('join') || p.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  const [screen, setScreen]     = useState(() => urlCode ? 'login' : 'login');
  const [user, setUser]         = useState('');
  const [code, setCode]         = useState('');
  const [gameOver, setGameOver] = useState([]);

  const handleHost = async name => {
    setUser(name);
    const c = Math.random().toString(36).substring(2,8).toUpperCase();
    try { await emit('create', { host: name, code: c }); } catch {}
    setCode(c); setScreen('host-lobby');
  };
  const handlePlayer = name => { setUser(name); setScreen('join'); };
  const handleJoined = c    => { setCode(c); setScreen('player-lobby'); };
  const handlePodium = ()   => setScreen('podium');

  const handleGameOver = scores => { setGameOver(scores); setScreen('host-results'); };
  const handleNewGame  = ()     => setScreen('host-lobby');
  const handleClose    = ()     => setScreen('podium');
  const handleSessionClosed = () => setScreen('podium');

  return (
    <>
      <div className="grid-bg"/><div className="glow-bg"/>
      {screen==='login'        && <LoginScreen onHost={handleHost} onPlayer={handlePlayer} onPodium={handlePodium}/>}
      {screen==='join'         && <JoinScreen user={user} initialCode={urlCode} onJoined={handleJoined} onBack={()=>setScreen('login')}/>}
      {screen==='host-lobby'   && <HostLobbyScreen user={user} sessionCode={code} onStart={()=>setScreen('host-game')} onCancel={()=>setScreen('login')}/>}
      {screen==='host-game'    && <HostGameScreen sessionCode={code} onGameOver={handleGameOver}/>}
      {screen==='host-results' && <HostResultsScreen sessionCode={code} players={gameOver} onNewGame={handleNewGame} onClose={handleClose}/>}
      {screen==='player-lobby' && <PlayerLobbyScreen user={user} sessionCode={code} onStart={()=>setScreen('player-game')}/>}
      {screen==='player-game'  && <PlayerGameScreen user={user} sessionCode={code} onSessionClosed={handleSessionClosed} key={code}/>}
      {screen==='podium'       && <PodiumScreen user={user}/>}
    </>
  );
}
