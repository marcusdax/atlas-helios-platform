/**
 * End-to-end check for PropertyInsight Studio.
 *
 * Boots the production server against the built client and drives the real UI
 * in Chromium: upload, render, compare, and each assist feature. It runs fully
 * offline on the mock render provider and the stub text provider, so it is
 * suitable for CI and needs no credential.
 *
 *   npm run build
 *   npm i -D playwright && npx playwright install chromium
 *   node test/e2e.mjs
 *
 * CHROMIUM_PATH overrides the browser binary for environments that ship one.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { encodePng } = require('@alter/render-core');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = process.env.E2E_PORT || '5199';
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

// A real file on disk for the upload input to consume. Flat magenta, so the
// pixel probe below can tell the uploaded photo apart from the mock render and
// from the panel's own surface colour.
const PHOTO_RGB = [255, 0, 255];
const photo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-e2e-')), 'property.png');
fs.writeFileSync(photo, Buffer.from(encodePng(320, 240, () => PHOTO_RGB), 'base64'));

/**
 * Read one painted pixel from the live page. DOM assertions cannot tell a
 * visible image from one hidden behind an opaque overlay, and that distinction
 * is the entire product here.
 */
async function pixelAt(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const parts = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  return [raw[1], raw[2], raw[3]];
}

const near = (actual, expected, tolerance = 24) =>
  actual.every((channel, i) => Math.abs(channel - expected[i]) <= tolerance);

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT, NODE_ENV: 'production', ALTER_RENDER_PROVIDER: 'mock', ALTER_RENDER_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return response.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start:\n${serverLog.join('')}`);
}

let browser;
try {
  const health = await waitForServer();
  check('server boots and reports health', health.status === 'ok' && health.provider === 'mock');

  browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.includes('favicon')) pageErrors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // ---- shell ----
  check('app renders the shell', (await page.title()) === 'PropertyInsight Studio');
  check('offline banner is shown when no key is configured',
    await page.getByText('Offline mode').isVisible());

  // Trades are fetched from the API, not hardcoded in the client.
  const trades = await page.locator('#industry option').allTextContents();
  check('trade picker is populated from the server', trades.includes('Roofing') && trades.length >= 7,
    `${trades.length} trades`);

  // ---- render studio ----
  check('render button is disabled before any input',
    await page.getByRole('button', { name: 'Render the improvement' }).isDisabled());

  await page.setInputFiles('#photo', photo);
  await page.fill('#description', 'Curling shingles and moss across the north slope');
  await page.selectOption('#industry', 'roofing');

  const compare = page.locator('alter-compare');
  check('before image reaches the comparison element',
    Boolean(await compare.evaluate((el) => el.before)));

  await page.getByRole('button', { name: 'Render the improvement' }).click();
  await page.waitForFunction(() => document.querySelector('alter-compare')?.after, null, { timeout: 30000 });

  check('render completes and produces an after image',
    await compare.evaluate((el) => el.after.startsWith('data:image/png;base64,')));
  check('after image differs from before',
    await compare.evaluate((el) => el.after !== el.before));
  check('render-complete badge appears', await page.getByText('Render complete').isVisible());
  check('marketing copy is displayed', await page.getByText('Personalized marketing copy').isVisible());

  // What the user actually sees: the uploaded photo left of the seam, the
  // render right of it, neither hidden behind the working overlay.
  {
    await compare.scrollIntoViewIfNeeded();
    const b = await compare.boundingBox();
    const midY = Math.round(b.y + b.height / 2);
    const left = await pixelAt(page, Math.round(b.x + b.width * 0.15), midY);
    const right = await pixelAt(page, Math.round(b.x + b.width * 0.85), midY);

    check('the uploaded photo is painted left of the seam', near(left, PHOTO_RGB), `rgb(${left})`);
    check('the render is painted right of the seam', !near(right, PHOTO_RGB), `rgb(${right})`);
  }

  // ---- the slider, inside the real page ----
  await page.waitForFunction(() => document.querySelector('alter-compare')?.getAttribute('role') === 'slider');
  const box = await compare.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  const dragged = Number(await compare.getAttribute('aria-valuenow'));
  check('comparison slider drags inside the app', Math.abs(dragged - 20) <= 3, `position=${dragged}`);

  await compare.focus();
  await page.keyboard.press('Home');
  check('comparison slider is keyboard operable',
    (await compare.getAttribute('aria-valuenow')) === '0');

  // ---- idempotency, end to end ----
  await page.getByRole('button', { name: 'Render the improvement' }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes('served from cache'),
    null, { timeout: 30000 }
  );
  check('an identical re-render is served from cache', true);

  // ---- market analysis ----
  await page.fill('#market-location', 'Dallas, TX');
  await page.getByRole('button', { name: 'Analyze this market' }).click();
  await page.waitForSelector('text=Offline assist', { timeout: 20000 });
  check('market analysis returns through the API', true);

  // ---- suggestions, and handing one to the render input ----
  await page.getByRole('button', { name: 'Suggest improvements' }).click();
  await page.waitForSelector('text=Suggested improvements', { timeout: 20000 });
  const suggestionButtons = await page.getByRole('button', { name: 'Render this' }).count();
  check('suggestions render with a hand-off control', suggestionButtons > 0, `${suggestionButtons} items`);

  const firstSuggestion = (await page.locator('#suggestions li span.flex-1').first().textContent()).trim();
  await page.getByRole('button', { name: 'Render this' }).first().click();
  await page.waitForFunction(
    (expected) => document.getElementById('description')?.value === expected,
    firstSuggestion, { timeout: 5000 }
  );
  check('a suggestion populates the render description', true);

  // ---- targeting ----
  await page.fill('#lat', '999');
  check('invalid coordinates are rejected before loading a map',
    await page.getByText('Enter a latitude between').isVisible());
  await page.fill('#lat', '32.7767');
  await page.getByRole('button', { name: 'Load OpenStreetMap' }).click();
  check('map frame is created for valid coordinates',
    await page.locator('iframe[title*="Map centred"]').count() === 1);

  await page.getByRole('button', { name: 'Refine criteria' }).click();
  await page.waitForSelector('text=Refined criteria', { timeout: 20000 });
  check('vision parameter refinement returns', true);

  // ---- campaign ----
  await page.fill('#addresses', '123 Main St\n456 Oak Ave\n789 Pine Ln');
  await page.getByRole('button', { name: 'Generate one-pagers' }).click();
  await page.waitForSelector('table', { timeout: 20000 });
  const rows = await page.locator('table tbody tr').count();
  check('a one-pager row is produced per address', rows === 3, `${rows} rows`);

  const links = await page.locator('table tbody tr td:nth-child(2) code').allTextContents();
  check('one-pager links are server-derived and unique',
    links.length === 3 && new Set(links).size === 3 && links.every((l) => l.startsWith('/c/')),
    links.join(' '));

  // ---- modal focus behaviour ----
  await page.getByRole('button', { name: 'How it works' }).click();
  check('info dialog opens as a modal',
    await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  check('Escape closes the dialog', (await page.getByRole('dialog').count()) === 0);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  fs.rmSync(path.dirname(photo), { recursive: true, force: true });
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} end-to-end checks passed`);
process.exit(failed ? 1 : 0);
