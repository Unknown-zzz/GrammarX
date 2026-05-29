import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';

const BASE = 'https://grammarx-production.up.railway.app';
const OUT  = 'C:/Users/Jonathan/Desktop/GrammarX/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1280, height: 820 },
  protocolTimeout: 60000,
});

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 30000 });
    console.log(`  ✅  ${name}.png`);
  } catch(e) { console.log(`  ⚠️  ${name} failed: ${e.message}`); }
}

async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await delay(100);
  await page.keyboard.type(value, { delay: 30 });
}

// ── HOST page ────────────────────────────────────────────────────────────────
const host = await browser.newPage();
await host.setViewport({ width: 1280, height: 820 });
await host.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
await delay(600);

// Select Host role, fill name, create room
await host.evaluate(() =>
  [...document.querySelectorAll('.role-card')].find(c => c.innerText.includes('Host'))?.click()
);
await delay(200);
await fillInput(host, 'input[type="text"]', 'Profesor');
await delay(200);
await host.evaluate(() =>
  [...document.querySelectorAll('button.btn')].find(b => !b.classList.contains('secondary') && !b.disabled)?.click()
);
await delay(3000);

const code = await host.evaluate(() => document.querySelector('.code-value')?.innerText?.trim() ?? null);
console.log(`  Room: ${code}`);
if (!code) { await browser.close(); process.exit(1); }

// ── PLAYER page ──────────────────────────────────────────────────────────────
const player = await browser.newPage();
await player.setViewport({ width: 390, height: 844 });
await player.goto(BASE, { waitUntil: 'networkidle0', timeout: 20000 });
await delay(600);

await fillInput(player, 'input[type="text"]', 'Estudiante');
await delay(200);
await player.evaluate(() =>
  [...document.querySelectorAll('button.btn')].find(b => !b.classList.contains('secondary') && !b.disabled)?.click()
);
await delay(1500);

await fillInput(player, 'input[type="text"]', code);
await delay(200);
await player.evaluate(() =>
  [...document.querySelectorAll('button.btn')].find(b => !b.disabled && (b.innerText.includes('Entrar') || b.innerText.includes('→')))?.click()
);
await delay(2500);

// ── Capture lobby with player connected ──────────────────────────────────────
await shot(host, '08_host_lobby_player_connected');
await shot(player, '07_player_lobby_waiting');   // overwrite with real version

// ── START GAME (G1 default) ───────────────────────────────────────────────────
await host.evaluate(() =>
  [...document.querySelectorAll('button.btn')].find(b => b.innerText.includes('INICIAR') || b.innerText.includes('▶'))?.click()
);
await delay(4000);

await shot(host, '09_host_dashboard_g1');
await shot(player, '10_player_game_g1');

// Player places some words
await player.evaluate(() => {
  [...document.querySelectorAll('.chip:not(.placed):not(.sel)')].slice(0,3).forEach(c => c.click());
});
await delay(400);
await shot(player, '11_player_placing_words');

// ── Advance rounds until game ends ────────────────────────────────────────────
for (let i = 0; i < 15; i++) {
  const ok = await host.evaluate(() => {
    const btn = document.querySelector('.advance-btn.ready, .advance-btn.end');
    if (btn) { btn.click(); return true; }
    return false;
  });
  await delay(ok ? 1800 : 2500);
  // Check if already on results
  const onResults = await host.evaluate(() => !!document.querySelector('.results-wrap, .brand'));
  if (onResults && i > 5) break;
}
await delay(2000);

await shot(host, '12_host_results');
await shot(player, '13_player_podium');

await browser.close();
console.log(`\n🎉  Done → ${OUT}`);
