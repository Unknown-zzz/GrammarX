import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'fs';

const OUT = 'C:/Users/Jonathan/Desktop/GrammarX/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1260, height: 900 },
  protocolTimeout: 60000,
});

const page = await browser.newPage();
await page.setViewport({ width: 1260, height: 900, deviceScaleFactor: 2 });

await page.goto('file:///C:/Users/Jonathan/Desktop/Triptico_GrammarX.html', {
  waitUntil: 'networkidle0',
  timeout: 30000,
});

// Wait for QR codes (loaded from CDN) and fonts
await delay(4000);

// Disable animations
await page.addStyleTag({ content: `
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
` });
await delay(500);

const pages = await page.$$('.page');
console.log(`Found ${pages.length} page(s)`);

for (let i = 0; i < pages.length; i++) {
  const box = await pages[i].boundingBox();
  if (!box) { console.log(`Page ${i+1}: no bounding box`); continue; }
  await page.screenshot({
    path: `${OUT}/triptico_p${i+1}.png`,
    clip: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
  });
  console.log(`✅ triptico_p${i+1}.png  (${Math.round(box.width)}×${Math.round(box.height)} px)`);
}

await browser.close();
console.log(`\n🎉  Done → ${OUT}`);
