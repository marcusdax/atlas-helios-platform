/**
 * Platform end-to-end check.
 *
 * Boots the real backend against a migrated database, serves the real built
 * frontend, and drives it in Chromium. It runs entirely offline: the radar and
 * alert feeds are stubbed at the network layer, so the suite exercises this
 * codebase rather than NOAA's uptime.
 *
 *   cd frontend && npm run build
 *   node tests/e2e/platform.e2e.mjs
 *
 * Needs Playwright (not a repo dependency):
 *   npm i -D playwright && npx playwright install chromium
 * CHROMIUM_PATH overrides the browser binary.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const API_PORT = process.env.E2E_API_PORT || '5407';
const WEB_PORT = process.env.E2E_WEB_PORT || '5408';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  if (process.env.E2E_VERBOSE) console.log(`  ${pass ? 'ok' : 'FAIL'} ${name}`);
};
const step = (label) => { if (process.env.E2E_VERBOSE) console.log(`> ${label}`); };

/* ---------------------------------------------------------------- fixtures */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'e2e-refresh';

// The API and this harness must share one in-memory database, so the server is
// started in-process rather than as a child.
const db = require(path.join(ROOT, 'backend/config/database'));
const { generateToken } = require(path.join(ROOT, 'backend/src/middleware/auth'));

await db.migrate.latest();

const companyId = randomUUID();
const userId = randomUUID();
await db('companies').insert({ id: companyId, name: 'E2E Restoration' });
await db('users').insert({
  id: userId, name: 'E2E', email: 'e2e@test.local', password: 'x',
  role: 'manager', company_id: companyId, status: 'active'
});

const PROPERTIES = [
  { address: '100 Hail St', lat: 32.78, lng: -96.80, risk: 92 },
  { address: '200 Wind Ave', lat: 32.76, lng: -96.79, risk: 64 },
  { address: '300 Calm Ln', lat: 32.74, lng: -96.77, risk: 12 }
];
for (const p of PROPERTIES) {
  await db('properties').insert({
    id: randomUUID(), company_id: companyId, address: p.address, city: 'Dallas', state: 'TX',
    zip_code: '75201', latitude: p.lat, longitude: p.lng, damage_probability: p.risk,
    estimated_value: 400000
  });
}
await db('storm_events').insert({
  id: randomUUID(), region_name: 'Dallas Metro', storm_type: 'hail', event_type: 'hail',
  severity: 'extreme', status: 'active', latitude: 32.7767, longitude: -96.797, radius_miles: 25,
  affected_properties: 2
});

const token = generateToken(userId, 'manager');

/* ------------------------------------------------------------------ servers */

process.env.PORT = API_PORT;
process.env.LOG_LEVEL = 'error';
require(path.join(ROOT, 'backend/server.js'));

// Static server for the CRA build, with SPA fallback.
const BUILD = path.join(ROOT, 'frontend/build');
if (!fs.existsSync(BUILD)) {
  console.error('frontend/build is missing — run `npm run build` in frontend/ first.');
  process.exit(1);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml' };

const web = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Same-origin API proxy. Serving the app and the API from one origin is what
  // the deployment does (nginx in front of both), and it keeps the browser from
  // treating every authenticated call as cross-origin.
  if (url.startsWith('/api') || url.startsWith('/socket.io') || url === '/health') {
    const upstream = http.request(
      { host: '127.0.0.1', port: Number(API_PORT), path: req.url, method: req.method, headers: req.headers },
      (proxied) => {
        res.writeHead(proxied.statusCode, proxied.headers);
        proxied.pipe(res);
      }
    );
    upstream.on('error', () => { res.writeHead(502); res.end('{"error":"upstream"}'); });
    req.pipe(upstream);
    return;
  }

  let file = path.join(BUILD, url === '/' ? 'index.html' : url);
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(BUILD, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
/**
 * Proxy the WebSocket upgrade too. Socket.IO now connects to the page's own
 * origin, so without this the handshake would 404 against the static server -
 * the same thing nginx has to be configured for in a real deployment.
 */
web.on('upgrade', (req, socket, head) => {
  const upstream = http.request({
    host: '127.0.0.1', port: Number(API_PORT), path: req.url, method: req.method,
    headers: req.headers
  });
  upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
      Object.entries(upstreamRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    if (upstreamHead?.length) socket.write(upstreamHead);
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });
  upstream.on('error', () => socket.destroy());
  if (head?.length) upstream.write(head);
  upstream.end();
});

await new Promise((r) => web.listen(Number(WEB_PORT), r));

const waitFor = async (url, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${url}`);
};

await waitFor(`http://127.0.0.1:${API_PORT}/health`);

/* -------------------------------------------------------------------- suite */

let browser;
try {
  const health = await (await fetch(`http://127.0.0.1:${API_PORT}/health`)).json();
  check('backend boots and reports healthy', health.status === 'OK', `db=${health.database}`);

  const cfg = await (await fetch(`http://127.0.0.1:${API_PORT}/api/radar/config`)).json();
  check('radar config lists providers and basemaps',
    cfg.data.providers.length >= 2 && Object.keys(cfg.data.basemaps).length >= 3);

  const storms = await (await fetch(`http://127.0.0.1:${API_PORT}/api/storms`)).json();
  check('storms endpoint serves the active event', storms.data.length === 1, storms.data[0]?.region_name);

  step('launching browser');
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });



  /**
   * Stub the third-party map and weather traffic. The point of the suite is
   * this codebase, and a real tile fetch would make it fail on NOAA's weather
   * rather than on our own bugs.
   */
  await context.route('**://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } }] })
    }));
  await context.route('**://tilecache.rainviewer.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await context.route('**://basemap.nationalmap.gov/**', (route) => route.fulfill({ status: 204, body: '' }));

  // The radar frame index and the NWS alert feed are upstream-backed. Stubbing
  // them here keeps the suite hermetic: it fails on our bugs, not on NOAA's
  // availability or on a fifteen-second upstream timeout.
  const now = Date.now();
  await context.route('**/api/radar/frames*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      data: {
        provider: 'rainviewer', tileSize: 256, maxZoom: 12, attribution: 'stub',
        frames: Array.from({ length: 12 }, (_, i) => ({
          time: now - (11 - i) * 600000,
          kind: i < 10 ? 'past' : 'forecast',
          tileUrl: 'https://tilecache.rainviewer.com/v2/radar/stub/256/{z}/{x}/{y}/4/1_1.png'
        }))
      },
      meta: { count: 12 }
    })
  }));
  await context.route('**/api/radar/alerts*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ type: 'FeatureCollection', features: [], meta: { count: 0 } })
  }));
  await context.route('**/api/radar/exposure*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [], meta: { alerts: 0, properties_checked: 3, properties_exposed: 0 } })
  }));

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const from = m.location().url || '';
    // Only errors from our own origin count. A blocked third-party fetch - the
    // Google Fonts @import, a favicon - says something about the network the
    // suite is running on, not about this application, and failing on it would
    // make the suite unusable in any restricted environment.
    const ours = from.startsWith(`http://127.0.0.1:${WEB_PORT}`) && !from.includes('favicon');
    if (ours) pageErrors.push(`${m.text()} (${from})`);
  });



  // Seed the token the same way a login would.
  await page.addInitScript((t) => {
    try { localStorage.setItem('atlas.access_token', t); } catch { /* ignore */ }
  }, token);

  step('loading shell');
  await page.goto(`http://127.0.0.1:${WEB_PORT}/`, { waitUntil: 'domcontentloaded' });
  check('the SPA shell renders', (await page.title()).includes('Atlas'));

  // ---- storm intelligence, the page built on the OpenRadar capability ----
  step('storm intelligence');
  await page.goto(`http://127.0.0.1:${WEB_PORT}/storm-intelligence`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Storm Intelligence', { timeout: 15000 });
  check('storm intelligence page renders', true);

  await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 20000 });
  check('a MapLibre GL canvas is mounted', true);

  await page.waitForSelector('text=Active storm events', { timeout: 10000 });
  // Wait for the row itself: asserting visibility straight after the card title
  // races the fetch that fills it.
  const stormRow = await page.getByText('Dallas Metro').first()
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check('the active storm reaches the page from the API', stormRow);

  const playButton = page.getByRole('button', { name: /Play|Pause/ });
  check('radar timeline controls are present', await playButton.isVisible());

  const liveButton = page.getByRole('button', { name: 'Live' });
  check('a live button is offered', await liveButton.isVisible());

  const opacitySlider = page.getByLabel('Radar opacity');
  await opacitySlider.fill('0.4');
  check('radar opacity is adjustable', (await opacitySlider.inputValue()) === '0.4');

  // ---- the rest of the routes exist and render ----
  for (const [route, marker] of [
    ['/property-assessment', 'Property Assessment'],
    ['/lead-management', 'Lead Management'],
    ['/estimate-generator', 'Estimate Generator'],
    ['/mobile-field', 'Field Tool'],
    ['/settings', 'Settings']
  ]) {
    await page.goto(`http://127.0.0.1:${WEB_PORT}${route}`, { waitUntil: 'domcontentloaded' });
    const ok = await page.getByText(marker, { exact: false }).first().isVisible().catch(() => false);
    check(`${route} renders`, ok);
  }

  // ---- a real write through the real API ----
  step('creating an estimate');
  await page.goto(`http://127.0.0.1:${WEB_PORT}/estimate-generator`, { waitUntil: 'domcontentloaded' });
  // An <option> has no layout box, so Playwright never considers it visible and
  // waitForSelector would wait forever. Wait on the option count instead.
  await page.waitForFunction(
    () => (document.querySelector('#property')?.options.length || 0) > 1,
    null, { timeout: 20000 }
  );
  await page.selectOption('#property', { index: 1 });
  await page.fill('input[placeholder="Description"]', 'Roof replacement');
  await page.fill('input[placeholder="Unit $"]', '18500');
  await page.getByRole('button', { name: 'Create estimate' }).click();
  await page.waitForSelector('text=$', { timeout: 15000 });

  const created = await db('estimates').where('company_id', companyId).first();
  check('an estimate created in the UI is persisted with a derived total',
    !!created && Number(created.total) > 18500, created ? `total=${created.total}` : 'none');

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
} finally {
  await browser?.close();
  web.close();
  await db.destroy();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} platform checks passed`);
process.exit(failed ? 1 : 0);
