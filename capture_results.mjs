import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';

const BASE = 'https://grammarx-production.up.railway.app';
const OUT  = 'C:/Users/Jonathan/Desktop/GrammarX/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));

// Disable CSS animations to avoid screenshot timeouts
const NO_ANIM = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 820 },
  protocolTimeout: 180000,
});

async function shot(page, name) {
  // Disable animations, then screenshot
  await page.addStyleTag({ content: NO_ANIM }).catch(() => {});
  await delay(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✅  ${name}.png`);
}
async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.type(value, { delay: 25 });
}
async function injectNoAnim(page) {
  await page.addStyleTag({ content: NO_ANIM }).catch(() => {});
}

// ── HOST ─────────────────────────────────────────────────────────────────────
const host = await browser.newPage();
await host.setViewport({ width: 1280, height: 820 });
// Inject no-animation CSS on every navigation
host.on('load', () => injectNoAnim(host));
await host.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
await delay(600);

await host.evaluate(() => [...document.querySelectorAll('.role-card')].find(c=>c.innerText.includes('Host'))?.click());
await delay(200);
await fillInput(host, 'input[type="text"]', 'Profesor');
await delay(200);
await host.evaluate(() => [...document.querySelectorAll('button.btn')].find(b=>!b.classList.contains('secondary')&&!b.disabled)?.click());
await delay(3500);
const code = await host.evaluate(() => document.querySelector('.code-value')?.innerText?.trim());
console.log(`  Room: ${code}`);

// ── PLAYER ───────────────────────────────────────────────────────────────────
const p1 = await browser.newPage();
await p1.setViewport({ width: 390, height: 844 });
await p1.goto(BASE, { waitUntil: 'networkidle0', timeout: 20000 });
await delay(600);
await fillInput(p1, 'input[type="text"]', 'Jona');
await delay(200);
await p1.evaluate(() => [...document.querySelectorAll('button.btn')].find(b=>!b.classList.contains('secondary')&&!b.disabled)?.click());
await delay(1500);
await fillInput(p1, 'input[type="text"]', code);
await delay(200);
await p1.evaluate(() => [...document.querySelectorAll('button.btn')].find(b=>!b.disabled&&(b.innerText.includes('Entrar')||b.innerText.includes('→')))?.click());
await delay(2000);

// ── START (10s rounds) ───────────────────────────────────────────────────────
await host.evaluate(() => [...document.querySelectorAll('.time-btn')].find(b=>b.innerText.trim()==='10s')?.click());
await delay(300);
await host.evaluate(() => [...document.querySelectorAll('button.btn')].find(b=>b.innerText.includes('INICIAR')||b.innerText.includes('▶'))?.click());
await delay(3000);

// ── ADVANCE all rounds ────────────────────────────────────────────────────────
for (let round = 0; round < 12; round++) {
  // Wait for .ready or .end
  for (let t = 0; t < 20; t++) {
    const ok = await host.evaluate(() => !!document.querySelector('.advance-btn.ready,.advance-btn.end'));
    if (ok) break;
    await delay(600);
  }
  const isEnd = await host.evaluate(() => !!document.querySelector('.advance-btn.end'));
  await host.evaluate(() => document.querySelector('.advance-btn.ready,.advance-btn.end')?.click());
  console.log(`  Round ${round+1}${isEnd?' (LAST)':''}`);
  if (isEnd) { await delay(5000); break; }
  await delay(800);
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
await injectNoAnim(host);
await delay(1000);
const state = await host.evaluate(() => ({
  hasResults: !!document.querySelector('.results-wrap'),
  text: document.body.innerText.slice(0, 200),
}));
console.log(`  Results state:`, state);

await shot(host, '14_host_final_results');

await injectNoAnim(p1);
await delay(800);
await shot(p1,   '15_player_final_podium');

await browser.close();
console.log(`\n🎉  Done → ${OUT}`);
