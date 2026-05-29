import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const BASE = 'https://grammarx-production.up.railway.app';
const OUT  = 'C:/Users/Jonathan/Desktop/GrammarX/screenshots';

if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1280, height: 820 },
});

const delay = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✅  ${name}.png`);
}

// ── Helper: fill a React-controlled input ────────────────────────────────────
async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value, { delay: 40 });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — HOST
// ─────────────────────────────────────────────────────────────────────────────
const host = await browser.newPage();
await host.setViewport({ width: 1280, height: 820 });
await host.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
await delay(800);

// 1. Login screen (default player role)
await shot(host, '01_login');

// 2. Select HOST role
await host.evaluate(() => {
  [...document.querySelectorAll('.role-card')].find(c => c.innerText.includes('Host'))?.click();
});
await delay(300);
await shot(host, '02_login_host_role');

// 3. Fill name and create room
await fillInput(host, 'input[type="text"]', 'Profesor');
await delay(200);
await host.evaluate(() => {
  [...document.querySelectorAll('button.btn')]
    .find(b => !b.classList.contains('secondary'))?.click();
});
await delay(3000); // wait for lobby
await shot(host, '03_host_lobby');

// 4. Show QR code
await host.evaluate(() => {
  [...document.querySelectorAll('button')]
    .find(b => b.innerText.includes('QR') || b.innerText.includes('Mostrar'))?.click();
});
await delay(1200);
await shot(host, '04_host_lobby_qr');

// Grab room code
const code = await host.evaluate(() =>
  document.querySelector('.code-value')?.innerText?.trim() ?? null
);
console.log(`  Room code: ${code}`);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — PLAYER (mobile viewport)
// ─────────────────────────────────────────────────────────────────────────────
const player = await browser.newPage();
await player.setViewport({ width: 390, height: 844 });
await player.goto(BASE, { waitUntil: 'networkidle0', timeout: 20000 });
await delay(800);

// 5. Player login screen (mobile)
await shot(player, '05_player_login_mobile');

// Fill player name → click join
await fillInput(player, 'input[type="text"]', 'Estudiante');
await delay(200);
await player.evaluate(() => {
  [...document.querySelectorAll('button.btn')]
    .find(b => !b.classList.contains('secondary'))?.click();
});
await delay(1500);

// 6. Join screen (code input)
await shot(player, '06_player_join_screen');

// Enter code
if (code) {
  await fillInput(player, 'input[type="text"]', code);
  await delay(200);
  await player.evaluate(() => {
    [...document.querySelectorAll('button.btn')]
      .find(b => !b.classList.contains('secondary'))?.click();
  });
  await delay(2500);
}

// 7. Player lobby (waiting)
await shot(player, '07_player_lobby_waiting');

// 8. Host sees player connected
await shot(host, '08_host_lobby_player_connected');

// ── Start Game — G1 Time Machine ─────────────────────────────────────────────
// Ensure G1 is selected (default) then start
await host.evaluate(() => {
  [...document.querySelectorAll('button.btn')]
    .find(b => b.innerText.includes('INICIAR') || b.innerText.includes('▶'))?.click();
});
await delay(4000);

// 9. Host dashboard — G1
await shot(host, '09_host_dashboard_g1');

// 10. Player game — G1 word ordering
await shot(player, '10_player_game_g1');

// Player clicks some chips
await player.evaluate(() => {
  const chips = [...document.querySelectorAll('.chip:not(.placed):not(.sel)')];
  chips.slice(0, 3).forEach(c => c.click());
});
await delay(500);
await shot(player, '11_player_placing_words');

// ── Advance through all rounds to reach results ───────────────────────────────
for (let i = 0; i < 12; i++) {
  const clicked = await host.evaluate(() => {
    const btn = document.querySelector('.advance-btn.ready, .advance-btn.end');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) await delay(2000); // wait for timer
  await delay(1500);
}
await delay(2000);

// 12. Host results
await shot(host, '12_host_results');

// 13. Player podium
await shot(player, '13_player_podium');

await browser.close();
console.log(`\n🎉  All screenshots → ${OUT}`);
