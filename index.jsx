import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import jsQR   from 'jsqr';
import SFX    from './src/sounds.js';

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

// ── Instructions data (per game mode, bilingual) ─────────────────────────────
const GAME_INSTRUCTIONS = {
  G1: {
    color: '#f0c040',
    en: {
      how: 'Rebuild the Past Simple sentence by placing the words in the correct order.',
      steps: [
        'The shuffled words of a sentence appear below.',
        'Tap them in the right order to build the sentence.',
        'Press "Verify →" when you\'re ready.',
        'Made a mistake? Use "✕ Clear" to reset.',
      ],
      tip: '💡 Find the Past Simple verb — it ends in -ed or is irregular (went, wrote, ran…).',
    },
    es: {
      how: 'Reconstruye la oración en pasado simple ordenando las palabras correctamente.',
      steps: [
        'Las palabras de una oración aparecen mezcladas abajo.',
        'Tócalas en el orden correcto para armar la oración.',
        'Pulsa "Verificar →" cuando estés listo.',
        'Si te equivocas, usa "✕ Limpiar" para reordenar.',
      ],
      tip: '💡 Busca el verbo en pasado — termina en -ed o es irregular (went, wrote, ran…).',
    },
  },
  G2: {
    color: '#e05a5a',
    en: {
      how: 'Choose the correct comparative or superlative form of the adjective.',
      steps: [
        'Two elements are compared against each other (e.g. 🐢 vs 🐇).',
        'Read the sentence with the blank (___).',
        'Choose the correct option from the 4 available.',
      ],
      tip: '💡 Short adj: -er / the -est · Long adj: more / the most · Irregular: better, worse, best…',
    },
    es: {
      how: 'Elige la forma comparativa o superlativa correcta del adjetivo.',
      steps: [
        'Se comparan dos elementos entre sí (ej. 🐢 vs 🐇).',
        'Lee la oración con el espacio en blanco (___).',
        'Elige la opción correcta entre las 4 disponibles.',
      ],
      tip: '💡 Adj. cortos: -er / the -est · Adj. largos: more / the most · Irregulares: better, worse, best…',
    },
  },
  G3: {
    color: '#5ae0a0',
    en: {
      how: 'Find the grammar error in the sentence and choose the corrected version.',
      steps: [
        'A Present Perfect sentence with one grammar error is shown in red.',
        'Read all four options carefully.',
        'Choose the option that fixes the error correctly.',
      ],
      tip: "💡 Common errors: wrong have/has · wrong past participle · since vs for · word order.",
    },
    es: {
      how: 'Encuentra el error gramatical en la oración y elige la versión corregida.',
      steps: [
        'Se muestra en rojo una oración en Present Perfect con un error gramatical.',
        'Lee con atención las cuatro opciones disponibles.',
        'Elige la opción que corrige el error correctamente.',
      ],
      tip: "💡 Errores comunes: have/has incorrecto · participio pasado erróneo · since vs for · orden de palabras.",
    },
  },
  G4: {
    color: '#a080f0',
    en: {
      how: 'Complete the sentence by choosing the correct future tense form.',
      steps: [
        'Read the situation or context presented.',
        'Complete the sentence with the blank (___).',
        'Choose the correct future form from 4 options.',
      ],
      tip: "💡 will = spontaneous decision or prediction · going to = prior plan or visible evidence · won't = future negation.",
    },
    es: {
      how: 'Completa la oración eligiendo la forma correcta del tiempo futuro.',
      steps: [
        'Lee la situación o contexto que se presenta.',
        'Completa la oración con el hueco en blanco (___).',
        'Elige entre 4 opciones la forma de futuro correcta.',
      ],
      tip: "💡 will = decisión espontánea o predicción · going to = plan previo o evidencia visible · won't = negación futura.",
    },
  },
};

function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function pickRounds(pool) { const r=[]; for(let d=1;d<=5;d++) r.push(...shuffle(pool.filter(s=>s.d===d)).slice(0,2)); return r; }
function calcScore(correct, timeLeft, tpr, diff) { if(!correct) return 0; return diff*100 + Math.round((timeLeft/tpr)*diff*50); }

// ── G1 DATA ────────────────────────────────────────────────────────────────────
const TECH = new Set(['programmed','deployed','tested','ran','executed','compiled','debugged','configured','installed','initialized','committed','pushed','pulled','merged','cloned','forked','refactored','documented','reviewed','monitored','logged','parsed','queried','migrated','automated','optimized','containerized','orchestrated','encrypted','authenticated','synchronized','integrated','validated','built','shipped','released','rolled','patched','formatted','updated','deleted','created','renamed']);
const isTech = w => TECH.has(w.toLowerCase().replace(/[^a-z]/g,''));
const G1_DATA = [
  // d:1 — 4-word sentences
  {s:'She wrote a long email',d:1},
  {s:'He fixed the broken printer',d:1},
  {s:'They opened a new account',d:1},
  {s:'We turned off the computer',d:1},
  {s:'She read a short story',d:1},
  {s:'He sent a quick message',d:1},
  {s:'They found the missing key',d:1},
  {s:'We made a big mistake',d:1},
  // d:2 — 5-word sentences
  {s:'He installed the new software',d:2},
  {s:'She tested the login form',d:2},
  {s:'They ran the server script',d:2},
  {s:'We updated the config file',d:2},
  {s:'She deleted the old backup',d:2},
  {s:'He created a new branch',d:2},
  {s:'They cloned the remote repository',d:2},
  {s:'We renamed the main folder',d:2},
  // d:3 — 6-word sentences
  {s:'The developer debugged the authentication module',d:3},
  {s:'She committed all changes to repository',d:3},
  {s:'They deployed the new build successfully',d:3},
  {s:'He reviewed the pull request carefully',d:3},
  {s:'She pushed her code to production',d:3},
  {s:'They merged the feature branch yesterday',d:3},
  {s:'He formatted the entire database table',d:3},
  {s:'We documented the new API endpoints',d:3},
  // d:4 — 7-word sentences
  {s:'The team refactored the legacy codebase last sprint',d:4},
  {s:'She automated the deployment pipeline using scripts',d:4},
  {s:'They migrated all user data to the cluster',d:4},
  {s:'He containerized the application using Docker',d:4},
  {s:'She synchronized the local database with remote',d:4},
  {s:'They monitored the application logs for errors',d:4},
  {s:'He configured the load balancer for performance',d:4},
  {s:'We tested all endpoints before the release',d:4},
  // d:5 — 8+ word sentences
  {s:'The engineer orchestrated the microservices deployment across multiple regions',d:5},
  {s:'She optimized the database queries and reduced latency significantly',d:5},
  {s:'They authenticated users with OAuth and encrypted the tokens',d:5},
  {s:'He integrated the payment gateway and validated every edge case',d:5},
  {s:'She implemented the continuous integration pipeline and automated the tests',d:5},
  {s:'They rolled back the deployment after detecting a critical regression',d:5},
  {s:'He patched the security vulnerability and released the hotfix immediately',d:5},
  {s:'We synchronized all microservices and validated the event-driven logs',d:5},
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
  {left:'🐱 Cat',right:'🐕 Dog',tpl:'A cat is ___ than a dog.',opts:['quieter','more quiet','more quieter','quietest'],d:1},
  {left:'🚲 Bike',right:'🚗 Car',tpl:'A bike is ___ than a car.',opts:['cheaper','more cheap','more cheaper','cheapest'],d:1},
  {left:'❄️ Winter',right:'☀️ Summer',tpl:'Summer is ___ than winter.',opts:['hotter','more hot','more hotter','hottest'],d:1},
  {left:'🖊️ Pen',right:'✏️ Pencil',tpl:'A pencil is ___ than a pen.',opts:['thinner','more thin','more thinner','thinnest'],d:1},
  // ── d:2 · Pattern B — short adj superlative (the ADJest) ────────────────
  {left:'🏔️ Everest',right:'⛰️ Hill',tpl:'Everest is ___ mountain in the world.',opts:['the tallest','the most tall','taller','most tall'],d:2},
  {left:'🐋 Blue Whale',right:'🐘 Elephant',tpl:'The blue whale is ___ animal on Earth.',opts:['the largest','the most large','larger','most large'],d:2},
  {left:'☀️ Sun',right:'💡 Bulb',tpl:'The sun is ___ natural light source.',opts:['the brightest','the most bright','brighter','most bright'],d:2},
  {left:'🧊 Ice',right:'💧 Water',tpl:'Ice is ___ state of water.',opts:['the coldest','the most cold','colder','most cold'],d:2},
  {left:'🐆 Cheetah',right:'🦁 Lion',tpl:'A cheetah is ___ land animal.',opts:['the fastest','the most fast','faster','most fast'],d:2},
  {left:'🌊 Pacific',right:'🌍 Atlantic',tpl:'The Pacific is ___ ocean on Earth.',opts:['the deepest','the most deep','deeper','most deep'],d:2},
  {left:'🏜️ Sahara',right:'🌵 Arizona',tpl:'The Sahara is ___ desert in the world.',opts:['the hottest','the most hot','hotter','most hot'],d:2},
  {left:'💎 Diamond',right:'🪨 Rock',tpl:'Diamond is ___ natural material known.',opts:['the hardest','the most hard','harder','most hard'],d:2},
  // ── d:3 · Pattern C — long adj comparative (more ADJ than) ──────────────
  {left:'🐍 Python',right:'⚙️ Assembly',tpl:'Python is ___ than Assembly.',opts:['more readable','readabler','most readable','more readabler'],d:3},
  {left:'☁️ Cloud',right:'💾 USB Drive',tpl:'Cloud storage is ___ than a USB drive.',opts:['more convenient','convenienter','most convenient','more convenienter'],d:3},
  {left:'🔒 HTTPS',right:'🔓 HTTP',tpl:'HTTPS is ___ than HTTP.',opts:['more secure','securer','most secure','more securer'],d:3},
  {left:'💡 SSD',right:'💿 HDD',tpl:'An SSD is ___ than an HDD.',opts:['more efficient','efficienter','most efficient','more efficienter'],d:3},
  {left:'🐙 GitHub',right:'💾 USB Drive',tpl:'GitHub is ___ than a USB drive for teams.',opts:['more collaborative','collaborativer','most collaborative','more collaborativer'],d:3},
  {left:'🐳 Docker',right:'🖥️ Virtual Machine',tpl:'Docker is ___ than a virtual machine.',opts:['more lightweight','lighterweight','most lightweight','more lighterweight'],d:3},
  {left:'🗄️ SQL',right:'📦 NoSQL',tpl:'SQL is ___ than NoSQL for structured data.',opts:['more reliable','reliabler','most reliable','more reliabler'],d:3},
  {left:'💻 VS Code',right:'📝 Notepad',tpl:'VS Code is ___ than Notepad for coding.',opts:['more powerful','powerfuler','most powerful','more powerfuler'],d:3},
  // ── d:4 · Pattern D — long adj superlative (the most ADJ) ───────────────
  {left:'⚛️ React',right:'🅰️ Angular',tpl:'React is ___ front-end library today.',opts:['the most popular','most popular','the popularest','popularest'],d:4},
  {left:'🔐 AES-256',right:'🔓 MD5',tpl:'AES-256 is ___ encryption standard.',opts:['the most secure','most secure','the securest','securest'],d:4},
  {left:'⚡ Rust',right:'🐘 PHP',tpl:'Rust is ___ systems language available.',opts:['the most performant','most performant','the performantest','performantest'],d:4},
  {left:'☁️ Kubernetes',right:'🖥️ Bare Metal',tpl:'Kubernetes is ___ deployment option.',opts:['the most scalable','most scalable','the scalablest','scalablest'],d:4},
  {left:'🐍 Python',right:'🔣 Brainfuck',tpl:'Python is ___ language for beginners.',opts:['the most accessible','most accessible','the accessiblest','accessiblest'],d:4},
  {left:'🌐 Cloud',right:'🏢 On-Premise',tpl:'Cloud computing is ___ infrastructure solution.',opts:['the most flexible','most flexible','the flexiblest','flexiblest'],d:4},
  {left:'🔧 TypeScript',right:'🟨 JavaScript',tpl:'TypeScript is ___ typed language available.',opts:['the most strictly','most strictly','the strictliest','strictliest'],d:4},
  {left:'⚡ GraphQL',right:'🔗 REST',tpl:'GraphQL is ___ API query language today.',opts:['the most efficient','most efficient','the efficientest','efficientest'],d:4},
  // ── d:5 · Mixed — all four patterns ─────────────────────────────────────
  {left:'🧠 GPT-4',right:'🤖 GPT-2',tpl:'GPT-4 is ___ than GPT-2.',opts:['more sophisticated','sophisticateder','most sophisticated','more sophisticateder'],d:5},
  {left:'📡 Fiber',right:'📶 Wi-Fi',tpl:'Fiber is ___ internet connection than Wi-Fi.',opts:['more stable','stabler','most stable','more stableer'],d:5},
  {left:'🔬 Unit Test',right:'🧪 E2E Test',tpl:'Unit tests are ___ to run than E2E tests.',opts:['faster','more fast','more faster','fastest'],d:5},
  {left:'🌐 IPv6',right:'🌐 IPv4',tpl:'IPv6 has ___ address space than IPv4.',opts:['a larger','a more large','a more larger','the largest'],d:5},
  {left:'🦺 TypeScript',right:'🟨 JavaScript',tpl:'TypeScript is ___ than JavaScript for large projects.',opts:['more maintainable','maintainableer','most maintainable','more maintainableer'],d:5},
  {left:'🔐 HTTPS',right:'📂 FTP',tpl:'HTTPS is ___ than FTP for file transfers.',opts:['more encrypted','encrypteder','most encrypted','more encrypteder'],d:5},
  {left:'🐆 Cheetah',right:'🐢 Turtle',tpl:'A cheetah is ___ than a turtle.',opts:['faster','more fast','more faster','fastest'],d:5},
  {left:'🏔️ Everest',right:'🌋 Vesuvius',tpl:'Everest is ___ mountain ever climbed.',opts:['the tallest','the most tall','taller','most tall'],d:5},
];

// ── G3 DATA ────────────────────────────────────────────────────────────────────
// Format: { wrong: "sentence with one grammar error", opts: ["correct","wrong1","wrong2","wrong3"], d }
// opts[0] is always the correct version (buildOpts shuffles and marks index 0 as correct)
const G3_DATA = [
  // d:1 — have / has subject-agreement error
  {wrong:"She have solved the problem.",opts:["She has solved the problem.","She have solves the problem.","She has solve the problem.","She had solved the problem."],d:1},
  {wrong:"He have finished the report.",opts:["He has finished the report.","He have finish the report.","He has finishing the report.","He had finished the report."],d:1},
  {wrong:"Alex have reviewed all the pull requests.",opts:["Alex has reviewed all the pull requests.","Alex have reviews all the pull requests.","Alex has review all the pull requests.","Alex had reviewed all the pull requests."],d:1},
  {wrong:"The server have crashed twice this week.",opts:["The server has crashed twice this week.","The server have crash twice this week.","The server has crashing twice this week.","The server had crashed twice this week."],d:1},
  {wrong:"Maria have deployed the new version.",opts:["Maria has deployed the new version.","Maria have deploy the new version.","Maria has deploying the new version.","Maria had deployed the new version."],d:1},
  {wrong:"They has fixed the bug already.",opts:["They have fixed the bug already.","They has fix the bug already.","They have fixing the bug already.","They had fixed the bug already."],d:1},
  {wrong:"We has completed the migration.",opts:["We have completed the migration.","We has complete the migration.","We have completing the migration.","We had completed the migration."],d:1},
  {wrong:"The developers has released a patch.",opts:["The developers have released a patch.","The developers has release a patch.","The developers have releasing a patch.","The developers had released a patch."],d:1},
  // d:2 — wrong past participle (regular verbs — base form used instead of -ed)
  {wrong:"They have finish the migration.",opts:["They have finished the migration.","They has finished the migration.","They have finishing the migration.","They had finished the migration."],d:2},
  {wrong:"She has deploy the application to production.",opts:["She has deployed the application to production.","She have deployed the application to production.","She has deploying the application to production.","She had deployed the application to production."],d:2},
  {wrong:"The team has test all the endpoints.",opts:["The team has tested all the endpoints.","The team have tested all the endpoints.","The team has testing all the endpoints.","The team had tested all the endpoints."],d:2},
  {wrong:"He has fix three bugs this morning.",opts:["He has fixed three bugs this morning.","He have fixed three bugs this morning.","He has fixing three bugs this morning.","He had fixed three bugs this morning."],d:2},
  {wrong:"We have add a new authentication layer.",opts:["We have added a new authentication layer.","We has added a new authentication layer.","We have adding a new authentication layer.","We had added a new authentication layer."],d:2},
  {wrong:"The system has detect an unusual pattern.",opts:["The system has detected an unusual pattern.","The system have detected an unusual pattern.","The system has detecting an unusual pattern.","The system had detected an unusual pattern."],d:2},
  {wrong:"The engineers have implement the new API.",opts:["The engineers have implemented the new API.","The engineers has implemented the new API.","The engineers have implementing the new API.","The engineers had implemented the new API."],d:2},
  {wrong:"She has review the code for two hours.",opts:["She has reviewed the code for two hours.","She have reviewed the code for two hours.","She has reviewing the code for two hours.","She had reviewed the code for two hours."],d:2},
  // d:3 — wrong past participle (irregular verbs — simple past used instead of past participle)
  {wrong:"She has wrote the final report.",opts:["She has written the final report.","She have written the final report.","She has write the final report.","She had written the final report."],d:3},
  {wrong:"The team has broke the build again.",opts:["The team has broken the build again.","The team have broken the build again.","The team has break the build again.","The team had broken the build again."],d:3},
  {wrong:"He has ran the tests three times.",opts:["He has run the tests three times.","He have run the tests three times.","He has runned the tests three times.","He had run the tests three times."],d:3},
  {wrong:"We have builded a new CI/CD pipeline.",opts:["We have built a new CI/CD pipeline.","We has built a new CI/CD pipeline.","We have building a new CI/CD pipeline.","We had built a new CI/CD pipeline."],d:3},
  {wrong:"The developer has chose a different framework.",opts:["The developer has chosen a different framework.","The developer have chosen a different framework.","The developer has choose a different framework.","The developer had chosen a different framework."],d:3},
  {wrong:"They have took the wrong approach.",opts:["They have taken the wrong approach.","They has taken the wrong approach.","They have taking the wrong approach.","They had taken the wrong approach."],d:3},
  {wrong:"She has speaked at three conferences this year.",opts:["She has spoken at three conferences this year.","She have spoken at three conferences this year.","She has speaking at three conferences this year.","She had spoken at three conferences this year."],d:3},
  {wrong:"The project has grew by fifty percent.",opts:["The project has grown by fifty percent.","The project have grown by fifty percent.","The project has grow by fifty percent.","The project had grown by fifty percent."],d:3},
  // d:4 — since/for confusion · adverb placement · still vs yet · negation order
  {wrong:"She has worked here since five years.",opts:["She has worked here for five years.","She have worked here for five years.","She has worked here since five year.","She has work here for five years."],d:4},
  {wrong:"He has been on the team for last Monday.",opts:["He has been on the team since last Monday.","He have been on the team since last Monday.","He has been on the team for Monday.","He had been on the team since last Monday."],d:4},
  {wrong:"The platform has been running since two hours.",opts:["The platform has been running for two hours.","The platform have been running for two hours.","The platform has run for two hours.","The platform had been running for two hours."],d:4},
  {wrong:"They never have deployed on a Friday.",opts:["They have never deployed on a Friday.","They has never deployed on a Friday.","They have deployed never on a Friday.","They had never deployed on a Friday."],d:4},
  {wrong:"The QA team has yet not approved the release.",opts:["The QA team has not yet approved the release.","The QA team have not yet approved the release.","The QA team has not approved yet the release.","The QA team had not yet approved the release."],d:4},
  {wrong:"She has yet received the confirmation email.",opts:["She has already received the confirmation email.","She have already received the confirmation email.","She has receive already the confirmation email.","She had already received the confirmation email."],d:4},
  {wrong:"He has completed not the onboarding process.",opts:["He has not completed the onboarding process.","He have not completed the onboarding process.","He has completed the onboarding process not.","He had not completed the onboarding process."],d:4},
  {wrong:"We have worked on this project since three months.",opts:["We have worked on this project for three months.","We has worked on this project for three months.","We have work on this project for three months.","We had worked on this project for three months."],d:4},
  // d:5 — Present Perfect Continuous errors · question inversion errors
  {wrong:"She has working on this feature for three sprints.",opts:["She has been working on this feature for three sprints.","She have been working on this feature for three sprints.","She has been worked on this feature for three sprints.","She had been working on this feature for three sprints."],d:5},
  {wrong:"They have been reviewed the code all afternoon.",opts:["They have been reviewing the code all afternoon.","They has been reviewing the code all afternoon.","They have reviewed the code all afternoon.","They had been reviewing the code all afternoon."],d:5},
  {wrong:"He have been debugging the system for hours.",opts:["He has been debugging the system for hours.","He has been debug the system for hours.","He has been debugged the system for hours.","He had been debugging the system for hours."],d:5},
  {wrong:"How long you have been learning to code?",opts:["How long have you been learning to code?","How long have been you learning to code?","How long you have been learn to code?","How long you had been learning to code?"],d:5},
  {wrong:"The team has been work on the refactor since January.",opts:["The team has been working on the refactor since January.","The team have been working on the refactor since January.","The team has been worked on the refactor since January.","The team had been working on the refactor since January."],d:5},
  {wrong:"Has they improved the algorithm?",opts:["Have they improved the algorithm?","Have they improve the algorithm?","Has they improve the algorithm?","Had they improved the algorithm?"],d:5},
  {wrong:"She has been wrote reports since the merger.",opts:["She has been writing reports since the merger.","She have been writing reports since the merger.","She has been written reports since the merger.","She had been writing reports since the merger."],d:5},
  {wrong:"How many bugs you have fixed this sprint?",opts:["How many bugs have you fixed this sprint?","How many bugs have you fix this sprint?","How many bugs you have fix this sprint?","How many bugs you had fixed this sprint?"],d:5},
];

// ── G4 DATA ────────────────────────────────────────────────────────────────────
const G4_DATA = [
  // d:1
  {ctx:'You hear thunder outside.',tpl:'It ___ rain soon.',opts:["'s going to","will","won't","is raining"],d:1},
  {ctx:'Maria has already bought her flight ticket for next Monday.',tpl:'She ___ fly to London next week.',opts:['is going to','will',"won't",'flies'],d:1},
  {ctx:'Nobody planned it, but someone drops their coffee.',tpl:'I ___ help you clean that up.',opts:["'ll","'m going to","won't",'am helping'],d:1},
  {ctx:'The project deadline is tomorrow. The code is broken.',tpl:'We ___ make it in time.',opts:["won't","will","'re going to",'make'],d:1},
  {ctx:'The forecast shows heavy snow tonight.',tpl:'The roads ___ be icy tomorrow morning.',opts:['are going to','will',"won't",'are'],d:1},
  {ctx:'You just saw someone drop their wallet on the street.',tpl:'I ___ pick that up for you!',opts:["'ll","'m going to","won't",'pick'],d:1},
  {ctx:'The battery icon on your laptop is at 3%.',tpl:'The laptop ___ shut down very soon.',opts:["'s going to","will","won't",'shuts'],d:1},
  {ctx:'Your friend just called and asked you to choose between pizza and sushi.',tpl:'I ___ have pizza, thanks!',opts:["'ll","'m going to","won't",'have'],d:1},
  // d:2
  {ctx:'The team has already scheduled the sprint planning for Friday.',tpl:'We ___ our sprint on Friday.',opts:['are starting','will start','start','going to start'],d:2},
  {ctx:'Look at those error logs — the server is clearly overloaded.',tpl:"The system ___ crash if we don't act.",opts:['is going to','will',"won't",'crashes'],d:2},
  {ctx:'A colleague asks for help with a difficult algorithm.',tpl:"I ___ take a look at it after lunch.",opts:["'ll","'m going to","won't",'take'],d:2},
  {ctx:'The conference call is already booked in the calendar for Thursday.',tpl:'We ___ the client at 3 pm on Thursday.',opts:['are calling','will call','going to call','called'],d:2},
  {ctx:'The user just clicked "Delete All" by mistake.',tpl:'They ___ very upset when they realize.',opts:["'re going to be","will be","won't be",'are'],d:2},
  {ctx:'You just read that a new Star Wars film is confirmed for December.',tpl:'I ___ see it on opening night!',opts:["'m going to","'ll","won't",'see'],d:2},
  {ctx:'Dark clouds are gathering quickly over the stadium.',tpl:'The match ___ be cancelled.',opts:['is going to','will',"won't",'cancels'],d:2},
  {ctx:'Anna has registered for a yoga class every Tuesday morning.',tpl:'She ___ yoga every Tuesday.',opts:['is doing','will do','does','going to do'],d:2},
  // d:3
  {ctx:'The tests are green, staging looks perfect.',tpl:'We ___ the update to production tonight.',opts:["'re pushing",'will push','go to push','pushed'],d:3},
  {ctx:'Current trends: AI adoption is accelerating globally.',tpl:'AI ___ transform every industry within a decade.',opts:['will','is going to',"won't",'transforms'],d:3},
  {ctx:'The intern just broke the main branch.',tpl:'The senior dev ___ be happy about this.',opts:["won't",'will','is going to','is being'],d:3},
  {ctx:'The server logs show memory usage at 99%.',tpl:'The server ___ respond to new requests.',opts:["won't",'will','is going to','responds'],d:3},
  {ctx:'Nobody knows what technology will dominate in 2040.',tpl:'We ___ mostly use voice interfaces by 2040.',opts:['will','are going to',"won't",'use'],d:3},
  {ctx:'The design team has already blocked their calendars for the workshop.',tpl:'They ___ the UX workshop next Monday.',opts:['are attending','will attend','going to attend','attend'],d:3},
  {ctx:'Renewable energy costs have dropped 90% in the last decade.',tpl:'Solar power ___ replace fossil fuels in most countries.',opts:['will','is going to',"won't",'replaces'],d:3},
  {ctx:'You see your teammate struggling with a heavy box.',tpl:'I ___ give you a hand with that.',opts:["'ll","'m going to","won't",'give'],d:3},
  // d:4
  {ctx:'Engineers at the conference have already confirmed the talk.',tpl:'The lead architect ___ a keynote at 9 a.m.',opts:['is giving','will give','gives','going to give'],d:4},
  {ctx:'Based on current server metrics, the load is dangerously high.',tpl:'The database ___ start rejecting queries soon.',opts:['is going to','will',"won't",'rejects'],d:4},
  {ctx:'No evidence, purely speculative future statement about quantum computing.',tpl:'Quantum computers ___ eventually break all current encryption.',opts:['will','are going to',"won't",'break'],d:4},
  {ctx:'The product manager has just added a feature to the Q3 roadmap.',tpl:'The team ___ that feature in Q3.',opts:['is implementing','will implement','going to implement','implements'],d:4},
  {ctx:'Current data shows the app crashes on iOS 17 every single launch.',tpl:'New users on iOS 17 ___ the app impossible to use.',opts:['are going to find','will find',"won't find",'find'],d:4},
  {ctx:'The company has booked a stand at the tech expo next March.',tpl:'We ___ our new product at the expo.',opts:['are showcasing','will showcase','going to showcase','showcase'],d:4},
  {ctx:'Looking at the roadmap, nothing is planned for the legacy module.',tpl:'The legacy module ___ receive any updates.',opts:["won't",'will','is going to','receives'],d:4},
  {ctx:'A junior dev just asked you to explain async/await spontaneously.',tpl:'Sure, I ___ show you an example right now.',opts:["'ll","'m going to","won't",'show'],d:4},
  // d:5
  {ctx:'The CI pipeline just failed for the third time.',tpl:"We ___ be able to ship without fixing this.",opts:["won't",'will','are going to','are'],d:5},
  {ctx:'Company roadmap: next quarter feature set is fully approved.',tpl:'The team ___ three major features next quarter.',opts:['is delivering','will deliver','delivers','going to deliver'],d:5},
  {ctx:'The new microservices architecture is nearly ready to go live.',tpl:'By next month, the monolith ___ fully replaced.',opts:['will have been','is going to be','is being','will be being'],d:5},
  {ctx:'The migration script has been tested and approved. Launch is Friday.',tpl:'By Monday, all legacy data ___ to the new format.',opts:['will have been converted','is going to convert','will be converting','converts'],d:5},
  {ctx:'Board approval is pending. Decision expected this afternoon.',tpl:'If approved, work ___ on the new campus next quarter.',opts:['will begin','is going to begin','begins','will have begun'],d:5},
  {ctx:'The monitoring dashboard shows a memory leak growing steadily.',tpl:'By midnight, the server ___ all available RAM.',opts:['will have consumed','is going to consume','will be consuming','consumes'],d:5},
  {ctx:'The release notes confirm the patch ships at 6 pm.',tpl:'By 7 pm, most users ___ the update automatically.',opts:['will have received','are going to receive','will be receiving','receive'],d:5},
  {ctx:'Nobody has any evidence — it is pure speculation about future trends.',tpl:'Developers ___ write less code as AI tools improve.',opts:['will','are going to',"won't",'write'],d:5},
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

/* ── Instructions Overlay ───────────────────────────────────────────────────── */
@keyframes instrSlideIn{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes instrCountdown{from{stroke-dashoffset:0}to{stroke-dashoffset:157}}
.instr-overlay{position:fixed;inset:0;z-index:2000;background:rgba(4,4,12,.92);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem}
.instr-card{background:var(--s1);border:1px solid var(--bdr);border-radius:16px;padding:2rem 1.8rem 1.6rem;max-width:440px;width:100%;animation:instrSlideIn .35s cubic-bezier(.22,.9,.36,1) both;position:relative;overflow:hidden}
.instr-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:16px 16px 0 0}
.instr-header{display:flex;align-items:center;gap:.9rem;margin-bottom:1.1rem}
.instr-icon{font-size:2.4rem;line-height:1;flex-shrink:0}
.instr-title{font-family:'Bricolage Grotesque',sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.instr-grammar{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--mut);margin-top:.25rem}
.instr-how{font-size:.82rem;color:var(--txt);opacity:.85;line-height:1.55;margin-bottom:1rem;padding:.7rem .9rem;background:var(--s2);border-radius:8px;border-left:3px solid}
.instr-steps{list-style:none;margin-bottom:.9rem;display:flex;flex-direction:column;gap:.45rem}
.instr-step{display:flex;align-items:flex-start;gap:.6rem;font-size:.78rem;line-height:1.5;color:var(--txt);opacity:.8}
.instr-step-n{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:.8rem;min-width:1.4rem;flex-shrink:0;opacity:1}
.instr-tip{font-size:.75rem;line-height:1.5;padding:.6rem .85rem;background:rgba(240,192,64,.06);border:1px solid rgba(240,192,64,.2);border-radius:8px;color:var(--acc);margin-bottom:1rem}
.instr-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.instr-btn{flex:1;padding:.75rem 1rem;background:var(--acc);color:#080810;border:none;border-radius:8px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:.95rem;cursor:pointer;letter-spacing:.01em;transition:opacity .15s}
.instr-btn:hover{opacity:.88}
.instr-timer{display:flex;align-items:center;gap:.5rem;flex-shrink:0}
.instr-timer-svg{transform:rotate(-90deg)}
.instr-timer-track{fill:none;stroke:var(--bdr);stroke-width:3.5}
.instr-timer-bar{fill:none;stroke-width:3.5;stroke-linecap:round;stroke-dasharray:157;transition:stroke-dashoffset .9s linear}
.instr-timer-num{font-family:'Bricolage Grotesque',sans-serif;font-size:.85rem;font-weight:800;min-width:1.2rem;text-align:center}
.instr-tpr{display:flex;align-items:center;gap:.5rem;font-size:.72rem;color:var(--mut);margin-bottom:.9rem;padding:.5rem .7rem;background:var(--s2);border-radius:6px}

/* ── Player Instructions Screen (full page) ─────────────────────────────────── */
.instr-page{width:100%;max-width:500px}
.instr-ready-list{background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:.85rem 1.1rem;margin-top:.8rem}
.instr-ready-header{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center}
.instr-ready-item{display:flex;align-items:center;gap:.6rem;padding:.32rem .2rem;font-size:.8rem;border-bottom:1px solid var(--bdr)}
.instr-ready-item:last-child{border-bottom:none}
.instr-ready-btn{width:100%;padding:1rem;font-size:1.05rem;border:none;border-radius:8px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;cursor:pointer;transition:all .2s;margin-top:.9rem;letter-spacing:.03em}
.instr-ready-btn.active{background:var(--grn);color:#080810;box-shadow:0 4px 20px rgba(90,224,160,.35)}
.instr-ready-btn.active:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(90,224,160,.45)}
.instr-ready-btn.done{background:var(--s2);color:var(--grn);border:1px solid var(--grn);cursor:default}

/* ── Host instructions-waiting phase ────────────────────────────────────────── */
.instr-host-panel{background:var(--s1);border:1px solid var(--bdr);border-radius:5px;padding:1rem 1.2rem;margin-bottom:.9rem}
.instr-host-title{font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mut);margin-bottom:.7rem;display:flex;justify-content:space-between;align-items:center}
.instr-host-item{display:flex;align-items:center;gap:.7rem;padding:.35rem .3rem;font-size:.82rem;border-bottom:1px solid var(--bdr)}
.instr-host-item:last-child{border-bottom:none}
.launch-btn{width:100%;padding:1.1rem;font-size:1.1rem;border-radius:5px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;border:none;cursor:pointer;transition:all .2s;letter-spacing:.04em;margin-bottom:.6rem}
.launch-btn.ready{background:var(--grn);color:#080810;box-shadow:0 4px 24px rgba(90,224,160,.35)}
.launch-btn.ready:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(90,224,160,.45)}
.launch-btn.waiting{background:var(--s2);color:var(--mut);cursor:default}
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
  if (!src) return <div className="qr-section"><div style={{color:'var(--mut)',fontSize:'.72rem'}}>Generating QR…</div></div>;
  return (
    <div className="qr-section">
      <div className="qr-box">
        <img src={src} width={176} height={176} alt="QR sala" style={{display:'block'}}/>
      </div>
      <div className="qr-caption">📱 Scan or open the link to join</div>
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
          setErrMsg('Camera permission denied. Enable it in your browser settings.');
        } else {
          setErrMsg(`Could not start camera: ${err.message}`);
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
      <div className="qr-overlay-title">📷 Scan QR code</div>

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
            <span style={{fontSize:'.72rem',color:'var(--mut)'}}>Starting camera…</span>
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <div className="qr-scanner-hint">
          Point at the host's QR · Auto-detects
        </div>
      )}
      {status === 'error' && (
        <div className="qr-scanner-err">{errMsg}</div>
      )}

      <button className="btn secondary" style={{maxWidth:200}} onClick={onClose}>
        ✕ Cancel
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
    if (!name.trim() || name.trim().length < 2) { setErr('Enter at least 2 characters'); return; }
    role === 'host' ? onHost(name.trim()) : onPlayer(name.trim());
  };
  return (
    <div className="page">
      <div className="card slide-up">
        <div className="brand">GRAMMAR <em>X</em></div>
        <div className="brand-sub">English Grammar · 4 Mini-Games</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>Your name</label>
          <input type="text" value={name} maxLength={20} placeholder="Enter your name"
            onChange={e=>{setName(e.target.value);setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/>
        </div>
        <div className="role-row">
          <div className={`role-card${role==='host'?' active':''}`} onClick={()=>setRole('host')}>
            <div className="role-icon">🎮</div><div className="role-name">Host</div><div className="role-desc">Control the room</div>
          </div>
          <div className={`role-card${role==='player'?' active':''}`} onClick={()=>setRole('player')}>
            <div className="role-icon">👤</div><div className="role-name">Player</div><div className="role-desc">Join with a code</div>
          </div>
        </div>
        <button className="btn" style={role==='host'?{background:'linear-gradient(135deg,var(--acc),#e0a030)'}:{}} onClick={submit}>
          {role==='host'?'🎮 Create room →':'▶ Join →'}
        </button>
        <div className="link-row"><a onClick={onPodium}>View leaderboard 🏆</a></div>
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
    if (c.length < 4) { setErr('Enter the room code'); return; }
    setLoading(true); setErr('');
    try {
      await emit('join', { code: c, name: user });
      onJoined(c);
    } catch (e) { setErr(e.message || 'Connection error. Please try again.'); setLoading(false); }
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
        <div className="brand-sub">Join the room</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>Room code</label>
          <input type="text" value={code} maxLength={8} placeholder="Ej: ABC123"
            onChange={e=>{setCode(e.target.value.toUpperCase());setErr('');}}
            onKeyDown={e=>e.key==='Enter'&&doJoin()}
            style={{textTransform:'uppercase',letterSpacing:'.2em',fontSize:'1.2rem',textAlign:'center'}}
            autoFocus/>
        </div>
        <button className="btn" onClick={()=>doJoin()} disabled={loading}>
          {loading?<><span className="spinner"/>Connecting...</>:'Join →'}
        </button>
        <button className="scan-btn" onClick={()=>setScanning(true)}>
          📷 Scan QR code
        </button>
        <button className="btn secondary" onClick={onBack} style={{marginTop:'.4rem'}}>← Back</button>
      </div>
    </div>
  );
}

// ── Screen: Host Lobby ─────────────────────────────────────────────────────────
function HostLobbyScreen({ user, sessionCode, onStart, onCancel }) {
  const [players, setPlayers]           = useState([]);
  const [gameId, setGameId]             = useState('G1');
  const [tpr, setTpr]                   = useState(20);
  const [starting, setStarting]         = useState(false);
  const [showQR, setShowQR]             = useState(false);
  const [phase, setPhaseState]          = useState('lobby'); // 'lobby' | 'instructions'
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [launching, setLaunching]       = useState(false);
  const prevPlayerCount = useRef(0);
  const phaseRef        = useRef('lobby');
  const setPhase = v => { phaseRef.current = v; setPhaseState(v); };

  useEffect(() => {
    socket.emit('rejoin', { code: sessionCode }, state => {
      if (state?.players) {
        const list = state.players.map(p => ({ name: p.name }));
        prevPlayerCount.current = list.length;
        setPlayers(list);
      }
      if (state?.readyPlayers) setReadyPlayers(state.readyPlayers);
      if (state?.status === 'instructions') setPhase('instructions');
    });
    const onState = state => {
      const list = state.players?.map(p => ({ name: p.name })) || [];
      if (list.length > prevPlayerCount.current && phaseRef.current === 'lobby') SFX.playerJoin();
      prevPlayerCount.current = list.length;
      setPlayers(list);
      if (state.readyPlayers) setReadyPlayers(state.readyPlayers);
      if (state.status === 'instructions') setPhase('instructions');
    };
    socket.on('state', onState);
    return () => socket.off('state', onState);
  }, [sessionCode]);

  const handleStart = async () => {
    if (!players.length) return;
    setStarting(true);
    const pool = gameId==='G1'?G1_DATA:gameId==='G2'?G2_DATA:gameId==='G3'?G3_DATA:G4_DATA;
    const rounds = pickRounds(pool);
    try {
      await emit('prestart', { code: sessionCode, rounds, gameId, tpr });
      setPhase('instructions');
    } catch { setStarting(false); }
  };

  const handleLaunch = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      await emit('launch', { code: sessionCode });
      onStart();
    } catch { setLaunching(false); }
  };

  // ── Instructions-waiting phase (all players must confirm ready) ───────────────
  if (phase === 'instructions') {
    const g = GAMES[gameId];
    const allReady = players.length > 0 && readyPlayers.length >= players.length;
    return (
      <div className="page">
        <div className="lobby-wrap slide-up">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <div>
              <div className="brand" style={{fontSize:'1.4rem',marginBottom:0}}>GRAMMAR <em>X</em></div>
              <div className="host-badge">🎮 HOST: {user}</div>
            </div>
            <div style={{fontSize:'.7rem',color:g.color,background:`${g.color}15`,border:`1px solid ${g.color}40`,padding:'.3rem .8rem',borderRadius:'20px',fontWeight:700}}>
              {g.icon} {g.name}
            </div>
          </div>
          <div className="code-display" style={{marginBottom:'1rem'}}>
            <div className="code-label">Players reading instructions</div>
            <div className="code-value">{sessionCode}</div>
            <div className="code-hint">Wait for all players to confirm ready</div>
          </div>
          <div className="instr-host-panel">
            <div className="instr-host-title">
              <span>Player status</span>
              <span style={{color:allReady?'var(--grn)':'var(--acc)',fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:700}}>
                {readyPlayers.length}/{players.length} ready
              </span>
            </div>
            {players.map((p,i)=>(
              <div key={i} className="instr-host-item">
                <span style={{fontSize:'1.1rem',minWidth:'1.6rem',textAlign:'center'}}>
                  {readyPlayers.includes(p.name)?'✅':'⏳'}
                </span>
                <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:700,flex:1}}>{p.name}</span>
                <span style={{fontSize:'.7rem',color:readyPlayers.includes(p.name)?'var(--grn)':'var(--mut)'}}>
                  {readyPlayers.includes(p.name)?'Ready':'Reading...'}
                </span>
              </div>
            ))}
            {!players.length&&<div style={{color:'var(--mut)',fontSize:'.72rem',padding:'.5rem',textAlign:'center'}}>No players</div>}
          </div>
          <button className={`launch-btn${allReady?' ready':' waiting'}`}
            onClick={allReady&&!launching?handleLaunch:undefined}
            disabled={launching||!allReady}>
            {launching?<><span className="spinner"/>Starting...</>
              :allReady?'▶ All ready! Start game'
              :`⏳ Waiting (${readyPlayers.length}/${players.length} ready)`}
          </button>
        </div>
      </div>
    );
  }

  // ── Normal lobby ──────────────────────────────────────────────────────────────
  const g = GAMES[gameId];
  return (
    <div className="page">
      <div className="lobby-wrap slide-up">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <div><div className="brand" style={{fontSize:'1.4rem',marginBottom:0}}>GRAMMAR <em>X</em></div>
          <div className="host-badge">🎮 HOST: {user}</div></div>
        </div>
        <div className="code-display">
          <div className="code-label">Room code — display it</div>
          <div className="code-value">{sessionCode}</div>
          <div className="code-hint">Players enter this code to join</div>
        </div>
        <button className="qr-toggle" onClick={()=>setShowQR(q=>!q)}>
          {showQR ? '▲ Hide QR' : '📱 Show QR to scan'}
        </button>
        {showQR && <QRCodeDisplay code={sessionCode}/>}
        <div style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)',marginBottom:'.5rem'}}>🎯 Mini-Game</div>
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
        <div style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)',marginBottom:'.5rem'}}>⏱ Time per question</div>
        <div className="time-row">
          {TIME_OPTIONS.map(t=>(
            <div key={t} className={`time-btn${tpr===t?' active':''}`} onClick={()=>setTpr(t)}>{t}s</div>
          ))}
        </div>
        <div className="players-box">
          <div className="players-header"><span className="players-title">Connected players</span><span className="players-count">{players.length}</span></div>
          <div className="player-list">
            {!players.length?<div className="player-empty">Waiting for players...</div>
              :players.map((p,i)=><div key={i} className="player-item"><div className="player-dot"/><span>{p.name}</span></div>)}
          </div>
        </div>
        <button className="btn" onClick={handleStart} disabled={!players.length||starting}
          style={{fontSize:'1.05rem',padding:'.95rem',background:players.length?g.color:'var(--mut)',color:'#080810',marginBottom:'.6rem'}}>
          {starting?<><span className="spinner"/>Preparing...</>:!players.length?'⏳ Waiting for players...':`▶ START ${g.icon} ${g.name} (${players.length})`}
        </button>
        <button className="btn secondary" onClick={onCancel}>Cancel room</button>
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

  if (!rs) return <div className="page"><div className="status"><span className="spinner"/>Loading...</div></div>;

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
          <div className="dash-meta">Room {sessionCode} · Round {(rs.currentRound||0)+1}/{rs.totalRounds||0}</div>
        </div>

        <CountdownTimer timeLeft={timeLeft} totalTime={rs.timePerRound||20} color={g.color}/>

        {round && (
          <div className="q-preview">
            <div className="q-preview-label">Current question</div>
            <div className="q-preview-text">
              {rs.gameId==='G1' && <span style={{color:'var(--mut)',fontSize:'.8rem'}}>⏰ {round.s.split(' ').length} palabras — ordénalas correctamente</span>}
              {rs.gameId==='G2' && <>{round.tpl.replace('___','______')}</>}
              {rs.gameId==='G3' && <><b>Error:</b> <em style={{color:'#e05a5a'}}>{round.wrong}</em></>}
              {rs.gameId==='G4' && <><b>Situation:</b> {round.ctx}<br/>{round.tpl.replace('___','______')}</>}
            </div>
            {canAdvance && (
              <div className="q-preview-answer">
                ✓ Correct answer:&nbsp;
                <b>{rs.gameId === 'G1' ? round.s : round.opts[0]}</b>
              </div>
            )}
          </div>
        )}

        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
            <span style={{fontSize:'.62rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)'}}>Players</span>
            <span style={{fontSize:'.72rem',color:'var(--grn)',fontWeight:700}}>{rs.answeredCount}/{rs.totalPlayers} answered</span>
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
            {!rs.players?.length && <div style={{color:'var(--mut)',fontSize:'.78rem',gridColumn:'1/-1',textAlign:'center',padding:'1rem'}}>No players</div>}
          </div>
        </div>

        <button className={`advance-btn${canAdvance?(isLastRound?' end':' ready'):' waiting'}`}
          onClick={canAdvance?handleAdvance:undefined} disabled={advancing}>
          {advancing?<><span className="spinner"/>...</>
            :!canAdvance?`⏳ Waiting... (${rs.answeredCount}/${rs.totalPlayers})`
            :isLastRound?'🏁 End game & see results'
            :`▶ Next question (${(rs.currentRound||0)+2}/${rs.totalRounds})`}
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
        <div className="brand" style={{textAlign:'center',marginBottom:'.2rem'}}>Results 🏆</div>
        <div className="brand-sub" style={{textAlign:'center',marginBottom:'1rem'}}>Room {sessionCode}</div>

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
          <button className="btn" onClick={onNewGame}>🎮 New game</button>
          <button className="btn danger" onClick={handleClose} disabled={closing}>
            {closing?<><span className="spinner"/>...</>:'🚪 Close session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen: Player Instructions (full page, with ready system) ───────────────
function PlayerInstructionsScreen({ user, sessionCode, gameId, timePerRound, players, readyPlayers }) {
  const [confirmed, setConfirmed] = useState(false);
  const [lang, setLang]           = useState('en'); // 'en' | 'es'

  const handleReady = async () => {
    if (confirmed) return;
    SFX.click();
    setConfirmed(true);
    try {
      await emit('player_ready', { code: sessionCode, name: user });
    } catch { setConfirmed(false); }
  };

  const g    = GAMES[gameId];
  const info = GAME_INSTRUCTIONS[gameId]?.[lang];
  if (!g || !info) return null;

  const readyCount = readyPlayers.length;
  const totalCount = players.length;
  const color = GAME_INSTRUCTIONS[gameId].color;

  return (
    <div className="page" style={{justifyContent:'flex-start',paddingTop:'1rem',paddingBottom:'2rem'}}>
      <div className="instr-page slide-up">
        {/* brand + lang toggle */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.1rem'}}>
          <div>
            <div className="brand" style={{fontSize:'1.2rem',marginBottom:0}}>GRAMMAR <em>X</em></div>
            <div className="brand-sub" style={{marginBottom:0}}>Read the instructions before playing</div>
          </div>
          <button
            onClick={()=>setLang(l=>l==='en'?'es':'en')}
            style={{
              background:'rgba(255,255,255,.06)', border:'1px solid var(--bdr)',
              color:'var(--mut)', borderRadius:'20px', padding:'.3rem .8rem',
              fontSize:'.65rem', cursor:'pointer', letterSpacing:'.08em',
              fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap',
              transition:'all .2s',
            }}
          >
            🌐 {lang==='en' ? 'Ver en Español' : 'View in English'}
          </button>
        </div>

        {/* instructions card */}
        <div className="instr-card" style={{borderColor:color+'55',maxWidth:'100%'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',borderRadius:'16px 16px 0 0',background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
          <div className="instr-header">
            <div className="instr-icon">{g.icon}</div>
            <div>
              <div className="instr-title" style={{color}}>{g.name}</div>
              <div className="instr-grammar">{g.sub}</div>
            </div>
          </div>
          <div className="instr-how" style={{borderLeftColor:color}}>{info.how}</div>
          <ul className="instr-steps">
            {info.steps.map((step,i)=>(
              <li key={i} className="instr-step">
                <span className="instr-step-n" style={{color}}>{i+1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
          <div className="instr-tip">{info.tip}</div>
          <div className="instr-tpr">
            <span>⏱</span>
            <span><b style={{color:'#eeeae2'}}>{timePerRound}s</b> {lang==='en'?'per question':'por pregunta'}</span>
            <span style={{margin:'0 .4rem',opacity:.4}}>·</span>
            <span>{lang==='en'?'Answer quickly to earn speed bonus points ⚡':'Responde rápido para ganar puntos de velocidad ⚡'}</span>
          </div>
        </div>

        {/* ready button */}
        <button
          className={`instr-ready-btn${confirmed?' done':' active'}`}
          onClick={handleReady}
          disabled={confirmed}
        >
          {confirmed ? "✅ Ready! Waiting for others..." : "I'm ready! →"}
        </button>

        {/* player ready list */}
        <div className="instr-ready-list">
          <div className="instr-ready-header">
            <span>Players in the room</span>
            <span style={{color:readyCount>=totalCount&&totalCount>0?'var(--grn)':'var(--acc)',fontWeight:700}}>
              {readyCount}/{totalCount} ready
            </span>
          </div>
          {players.map((p,i)=>(
            <div key={i} className="instr-ready-item">
              <span style={{fontSize:'1rem',minWidth:'1.5rem',textAlign:'center'}}>
                {readyPlayers.includes(p.name)?'✅':'⏳'}
              </span>
              <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:700,flex:1,
                color:p.name===user?'var(--acc)':'#eeeae2'}}>
                {p.name}{p.name===user?' (you)':''}
              </span>
              <span style={{fontSize:'.68rem',color:readyPlayers.includes(p.name)?'var(--grn)':'var(--mut)'}}>
                {readyPlayers.includes(p.name)?'Ready ✓':'Reading...'}
              </span>
            </div>
          ))}
          {!players.length&&<div style={{color:'var(--mut)',fontSize:'.72rem',padding:'.5rem 0',textAlign:'center'}}>Loading...</div>}
        </div>

        <div style={{textAlign:'center',fontSize:'.72rem',color:'var(--mut)',marginTop:'.6rem'}}>
          The host will start the game when everyone is ready
        </div>
      </div>
    </div>
  );
}

// ── Screen: Player Lobby ───────────────────────────────────────────────────────
function PlayerLobbyScreen({ user, sessionCode, onStart }) {
  const [players, setPlayers]           = useState([]);
  const [hostName, setHostName]         = useState('');
  const [gameInfo, setGameInfo]         = useState(null);
  const [status, setStatus]             = useState('waiting');
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [gameData, setGameData]         = useState(null); // { gameId, timePerRound }
  const startedRef = useRef(false);

  useEffect(() => {
    const applyState = data => {
      if (!data) return;
      if (data.host)   setHostName(data.host);
      if (data.gameId) setGameInfo(GAMES[data.gameId]);
      setPlayers(data.players?.map(p => ({ name: p.name })) || []);
      if (data.readyPlayers) setReadyPlayers(data.readyPlayers);
      setStatus(data.status || 'waiting');
      if (data.gameId) setGameData({ gameId: data.gameId, timePerRound: data.timePerRound ?? 20 });
      // When host launches → go straight to game (instructions already shown)
      if (data.status === 'playing' && !startedRef.current) {
        startedRef.current = true;
        onStart();
      }
    };
    socket.emit('rejoin', { code: sessionCode }, applyState);
    socket.on('state', applyState);
    return () => socket.off('state', applyState);
  }, [sessionCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instructions screen — shown for every player while status = 'instructions'
  if (status === 'instructions' && gameData) {
    return <PlayerInstructionsScreen
      user={user}
      sessionCode={sessionCode}
      gameId={gameData.gameId}
      timePerRound={gameData.timePerRound}
      players={players}
      readyPlayers={readyPlayers}
    />;
  }

  return (
    <div className="page">
      <div className="lobby-wrap slide-up">
        <div style={{textAlign:'center',marginBottom:'1.2rem'}}>
          <div className="brand" style={{fontSize:'1.4rem'}}>GRAMMAR <em>X</em></div>
          <div className="brand-sub">Room {sessionCode}</div>
        </div>
        <div className="code-display" style={{borderColor:'var(--blu)'}}>
          <div className="code-label">Connected as</div>
          <div className="code-value" style={{color:'var(--blu)',fontSize:'2rem'}}>{user}</div>
          <div className="code-hint">{hostName?`Host: ${hostName} · `:''}Room: <b>{sessionCode}</b></div>
        </div>
        {gameInfo&&(
          <div className="hint-box" style={{marginBottom:'1rem',borderLeftColor:gameInfo.color}}>
            <div className="hint-label" style={{color:gameInfo.color}}>{gameInfo.icon} Selected mini-game</div>
            <div className="hint-text" style={{fontSize:'.85rem'}}>{gameInfo.name} — {gameInfo.sub}</div>
          </div>
        )}
        <div className="waiting-anim">
          <div className="waiting-dot"/><div className="waiting-dot"/><div className="waiting-dot"/>
          <span style={{marginLeft:'.6rem'}}>Waiting for the host to start</span>
        </div>
        <div className="players-box">
          <div className="players-header"><span className="players-title">In the room</span><span className="players-count">{players.length}</span></div>
          <div className="player-list">
            {!players.length?<div className="player-empty">...</div>
              :players.map((p,i)=>(
                <div key={i} className="player-item"><div className="player-dot"/>
                  <span style={p.name===user?{color:'var(--acc)',fontWeight:700}:{}}>{p.name}{p.name===user?' (you)':''}</span>
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
        {!placed.length?<span className="zone-ph">Tap words in the correct order ↓</span>
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
          <button className="btn danger" onClick={clear}>✕ Clear</button>
          <button className="btn" onClick={check}>Verify →</button>
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
          <div style={{background:'rgba(224,90,90,.07)',border:'1px solid rgba(224,90,90,.35)',borderLeft:'3px solid #e05a5a',borderRadius:'6px',padding:'1rem 1.3rem',marginBottom:'.6rem'}}>
            <div style={{fontSize:'.58rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#e05a5a',marginBottom:'.55rem',fontWeight:700}}>⚠️ Find the grammar error</div>
            <div style={{fontSize:'.92rem',lineHeight:1.6,color:'var(--txt)',fontFamily:"'JetBrains Mono',monospace"}}>{round.wrong}</div>
          </div>
          <div style={{fontSize:'.6rem',letterSpacing:'.15em',textTransform:'uppercase',color:'var(--mut)',marginBottom:'.55rem',textAlign:'center'}}>↓ Choose the correct version ↓</div>
        </>
      )}
      {gameId==='G4' && (
        <>
          <div className="crystal-ctx"><div className="ctx-label">🔮 Situation</div><div className="ctx-text">{round.ctx}</div></div>
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
  const prevSecRef     = useRef(-1);     // last integer second seen by timer (for ticks)
  const gameStartedRef = useRef(false);  // whether music+fanfare already played this game

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
        gameStartedRef.current = false; // re-arm fanfare for new game
      }

      // Game just started → fanfare + music
      if (data.status === 'playing' && !gameStartedRef.current) {
        gameStartedRef.current = true;
        SFX.gameStart();
        setTimeout(() => SFX.startMusic(), 900); // start music after fanfare
      }

      // Game ended → stop music + victory
      if (data.status === 'ended') {
        SFX.stopMusic();
      }

      // New round → reset answer state and build opts once
      const key = `${data.gameToken}-${data.currentRound}`;
      if (optsKey.current !== key) {
        if (optsKey.current !== '') SFX.roundStart(); // skip on very first load
        optsKey.current        = key;
        hasAnsweredRef.current = false;
        submitting.current     = false;
        prevSecRef.current     = -1; // reset tick tracker for new round
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
    return () => {
      socket.off('state', applyState);
      SFX.stopMusic(); // stop music when PlayerGameScreen unmounts
    };
  }, [sessionCode]);

  // Victory sound when game ends
  useEffect(() => {
    if (rs?.status === 'ended') {
      setTimeout(() => SFX.victory(), 400);
    }
  }, [rs?.status]);

  // Client-side countdown timer — reads refs directly, no stale closure issues
  useEffect(() => {
    const id = setInterval(() => {
      const cur = rsRef.current;
      if (!cur?.roundStartedAt || cur.status !== 'playing') return;
      // Subtract clock offset so we use server-equivalent time
      const syncedNow = Date.now() - clockOffset.current;
      const left = Math.max(0, cur.timePerRound - (syncedNow - cur.roundStartedAt) / 1000);
      setTimeLeft(left);

      // ── Tick sounds on each integer second change ──
      const sec = Math.ceil(left);
      if (sec !== prevSecRef.current && sec > 0 && !hasAnsweredRef.current) {
        prevSecRef.current = sec;
        if (sec <= 3) SFX.urgentTick();
        else          SFX.tick();
      }

      if (left <= 0 && !submitting.current && !hasAnsweredRef.current) {
        SFX.timeout();
        submitting.current     = true;
        hasAnsweredRef.current = true;
        setHasAnswered(true);
        setPendingFeedback({ ok: false, msg: "⏰ Time's up — +0 pts", type: 'timeout' });
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
    // ── Answer sounds ──
    if (isCorrect) SFX.correct();
    else           SFX.wrong();
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
        ? `✓ Correct! +${base} + ⚡${timeBonus} speed = ${score} pts`
        : `✓ Correct! +${score} pts`;
    } else {
      msg = '✗ Wrong — +0 pts';
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
          <div className="big-msg">Waiting for the host...</div>
          <div className="sub-msg">Room {sessionCode}</div>
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
          <div className="big-msg">Game over!</div>
          <div className="sub-msg">The host is choosing the next game...</div>
          <div style={{marginTop:'1rem',fontSize:'.9rem',color:'var(--acc)',fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:800}}>Your score: {myScore} pts</div>
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
            <div className="proom">{g.icon} {g.name} · Room {sessionCode}</div>
            <div className="pscore">Score <b>{myScore}</b></div>
          </div>
        </div>

        <div className="prog-wrap">
          <div className="prog-bar" style={{width:`${((rs.currentRound||0)/rs.totalRounds)*100}%`,background:g.color}}/>
        </div>

        <CountdownTimer timeLeft={timeLeft} totalTime={rs.timePerRound||20} color={g.color}/>

        <div className="round-meta" style={{marginTop:'.7rem'}}>
          <span className="round-lbl">Question {(rs.currentRound||0)+1}/{rs.totalRounds}</span>
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
              <span style={{marginLeft:'.5rem'}}>Waiting for the next question...</span>
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
      <div className="podium-sub">Top scores</div>
      <div className="tab-row">
        {PODIUM_TABS.map(t=>(
          <div key={t.id} className={`tab${activeTab===t.id?' active':''}`}
            style={activeTab===t.id?{background:t.color}:{}}
            onClick={()=>setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>
      {loading?<div className="status"><span className="spinner"/>Loading...</div>
        :!entries.length?<div className="status">No scores yet</div>
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
          <button className="btn secondary" style={{maxWidth:240,marginTop:'.5rem'}} onClick={fetchAll}>↻ Refresh</button>
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
  const [muted, setMuted]       = useState(false);

  const toggleMute = () => {
    const nowMuted = SFX.toggleMute();
    setMuted(nowMuted);
  };

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

      {/* ── Floating mute button ── */}
      <button
        onClick={toggleMute}
        title={muted ? 'Enable sound' : 'Mute'}
        style={{
          position:'fixed', bottom:'1rem', right:'1rem', zIndex:9999,
          width:'2.8rem', height:'2.8rem', borderRadius:'50%',
          background:'rgba(8,8,16,0.85)', border:'1px solid var(--bdr)',
          color: muted ? 'var(--mut)' : 'var(--acc)',
          fontSize:'1.2rem', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          backdropFilter:'blur(8px)', transition:'all .2s',
          boxShadow: muted ? 'none' : '0 0 10px rgba(240,192,64,.25)',
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </>
  );
}
