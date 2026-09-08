/**
 * Browser verification for <alter-compare>.
 *
 * The slider's contract is a browser contract - pointer capture, focus, ARIA
 * state, computed clip-path, shadow-DOM style isolation - and none of it can be
 * asserted in jsdom. This drives a real Chromium instead.
 *
 * Playwright is not a dependency of this package; install it to run this:
 *   npm i -D playwright && npx playwright install chromium
 *   node test/browser.test.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { encodePng } = require('@alter/render-core');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Flat, maximally distinct colours: the pixel probe below asserts which of the
// two is actually painted where, so they must not be confusable with each
// other, with the surface colour, or with a label background.
const BEFORE_RGB = [255, 0, 0];
const AFTER_RGB = [0, 255, 0];
const BEFORE = `data:image/png;base64,${encodePng(200, 150, () => BEFORE_RGB)}`;
const AFTER = `data:image/png;base64,${encodePng(200, 150, () => AFTER_RGB)}`;

const PAGE = `<!doctype html><meta charset="utf-8">
<style>body{margin:0}alter-compare{width:600px}</style>
<alter-compare id="c"></alter-compare>
<div id="log"></div>
<script type="module">
  import '/src/alter-compare.js';
  const el = document.getElementById('c');
  window.__events = [];
  el.addEventListener('input', e => window.__events.push(['input', e.detail.position]));
  el.addEventListener('change', e => window.__events.push(['change', e.detail.position]));
  window.__setImages = (b, a) => { el.before = b; el.after = a; };
  window.__el = el;
</script>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const file = path.join(ROOT, url);
  if (url === '/favicon.ico' || !file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  res.end(fs.readFileSync(file));
});

// Playwright resolves its own browser by default; CHROMIUM_PATH overrides it for
// environments that ship a pre-installed binary.
const CHROMIUM = process.env.CHROMIUM_PATH;

/**
 * Read one painted pixel.
 *
 * Everything else here inspects the DOM, which is exactly how the bug this
 * guards against slipped through: `.state` reported `hidden === true` while an
 * author `display: grid` kept the opaque overlay painted over both images. Only
 * the rendered output could catch that, so this screenshots a single pixel and
 * decodes it - Chromium emits 8-bit RGBA, and for a 1x1 image every PNG filter
 * degenerates to the raw bytes, so no image library is needed.
 */
async function pixelAt(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });

  // The zlib stream may be split across several IDAT chunks, so collect them
  // all before inflating rather than assuming one.
  const parts = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (parts.length === 0) throw new Error('no IDAT chunk in screenshot');

  const raw = zlib.inflateSync(Buffer.concat(parts));
  return [raw[1], raw[2], raw[3]];          // skip the per-row filter byte
}

const near = (actual, expected, tolerance = 24) =>
  actual.every((channel, i) => Math.abs(channel - expected[i]) <= tolerance);

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon.ico')) pageErrors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__el && customElements.get('alter-compare'));

// 1. Empty state: not a slider, not focusable.
check('empty state exposes no slider role',
  (await page.getAttribute('#c', 'role')) === null && (await page.getAttribute('#c', 'tabindex')) === null);
check('empty state shows the placeholder prompt',
  (await page.locator('#c').evaluate((el) => el.shadowRoot.querySelector('.state').textContent)).includes('Add a property photo'));

// 2. Loading state.
await page.evaluate(() => { window.__el.loading = true; });
check('loading state announces via role=status',
  (await page.locator('#c').evaluate((el) => el.shadowRoot.querySelector('.state').getAttribute('role'))) === 'status');
await page.evaluate(() => { window.__el.loading = false; });

// 3. Ready state after both images set.
await page.evaluate(([b, a]) => window.__setImages(b, a), [BEFORE, AFTER]);
await page.waitForFunction(() => document.getElementById('c').getAttribute('role') === 'slider');
check('ready state becomes a slider', true);
check('aria values are published',
  (await page.getAttribute('#c', 'aria-valuenow')) === '50' &&
  (await page.getAttribute('#c', 'aria-valuemin')) === '0' &&
  (await page.getAttribute('#c', 'aria-valuemax')) === '100' &&
  (await page.getAttribute('#c', 'aria-orientation')) === 'horizontal');
check('labels render', (await page.locator('#c').evaluate((el) =>
  [...el.shadowRoot.querySelectorAll('.label')].map((n) => n.textContent).join(','))) === 'Before,After');

// 4. Both images loaded and painted at identical geometry (the pixel-alignment claim).
const geometry = await page.locator('#c').evaluate((el) => {
  const b = el.shadowRoot.querySelector('.before-img').getBoundingClientRect();
  const a = el.shadowRoot.querySelector('.after-img').getBoundingClientRect();
  const loaded = [...el.shadowRoot.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0);
  return { same: b.width === a.width && b.height === a.height && b.left === a.left && b.top === a.top, loaded, w: b.width };
});
check('both images decoded (PNG encoder output is a valid image)', geometry.loaded);
check('before/after layers are geometrically identical', geometry.same, `w=${geometry.w}`);

// 4b. The overlay must cover while loading and *uncover* when done. This is the
// regression guard: el.hidden alone was true in both states.
{
  const b = await page.locator('#c').boundingBox();
  const probe = [Math.round(b.x + b.width * 0.25), Math.round(b.y + b.height / 2)];

  const ready = await pixelAt(page, ...probe);
  check('the original is painted once both images are set', near(ready, BEFORE_RGB), `rgb(${ready})`);

  await page.evaluate(() => { window.__el.loading = true; });
  const covered = await pixelAt(page, ...probe);
  check('the working overlay covers the image while loading',
    !near(covered, BEFORE_RGB) && !near(covered, AFTER_RGB), `rgb(${covered})`);

  await page.evaluate(() => { window.__el.loading = false; });
  const uncovered = await pixelAt(page, ...probe);
  check('the working overlay stops painting when loading ends', near(uncovered, BEFORE_RGB), `rgb(${uncovered})`);
}

// 5. Drag with pointer, releasing OUTSIDE the element (the bug in the original).
const box = await page.locator('#c').boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 6 });
await page.mouse.move(box.x + box.width * 0.25, box.y + box.height + 250, { steps: 4 }); // leave the element
await page.mouse.up();
const afterDrag = Number(await page.getAttribute('#c', 'aria-valuenow'));
check('drag tracks the pointer', Math.abs(afterDrag - 25) <= 2, `position=${afterDrag}`);

const events = await page.evaluate(() => window.__events);
check('drag emits input events then a single change', events.filter((e) => e[0] === 'input').length > 1 && events.filter((e) => e[0] === 'change').length === 1,
  `inputs=${events.filter((e) => e[0] === 'input').length} changes=${events.filter((e) => e[0] === 'change').length}`);

// 6. What is actually painted, at the position set by the drag above (~25%).
{
  const b = await page.locator('#c').boundingBox();
  const midY = Math.round(b.y + b.height / 2);
  const leftPixel = await pixelAt(page, Math.round(b.x + b.width * 0.10), midY);
  const rightPixel = await pixelAt(page, Math.round(b.x + b.width * 0.60), midY);

  check('the original is painted before the seam', near(leftPixel, BEFORE_RGB), `rgb(${leftPixel})`);
  check('the render is painted after the seam', near(rightPixel, AFTER_RGB), `rgb(${rightPixel})`);
}

// 7. Keyboard operation.
await page.focus('#c');
await page.keyboard.press('ArrowRight');
const afterArrow = Number(await page.getAttribute('#c', 'aria-valuenow'));
check('ArrowRight nudges by 1', Math.abs(afterArrow - (afterDrag + 1)) <= 1, `${afterDrag} -> ${afterArrow}`);

await page.keyboard.press('Shift+ArrowLeft');
const afterShift = Number(await page.getAttribute('#c', 'aria-valuenow'));
check('Shift+Arrow moves by 10', Math.abs(afterShift - (afterArrow - 10)) <= 1, `${afterArrow} -> ${afterShift}`);

await page.keyboard.press('Home');
check('Home jumps to 0', (await page.getAttribute('#c', 'aria-valuenow')) === '0');
await page.keyboard.press('End');
check('End jumps to 100', (await page.getAttribute('#c', 'aria-valuenow')) === '100');

// 8. Disabled freezes interaction.
await page.evaluate(() => { window.__el.disabled = true; });
check('disabled removes the slider role', (await page.getAttribute('#c', 'role')) === null);
await page.mouse.move(box.x + 20, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 4 });
await page.mouse.up();
check('disabled ignores drags', (await page.evaluate(() => window.__el.position)) === 100);
await page.evaluate(() => { window.__el.disabled = false; });

// 9. Vertical orientation.
await page.evaluate(() => { window.__el.setAttribute('orientation', 'vertical'); window.__el.position = 50; });
const box2 = await page.locator('#c').boundingBox();
await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.5);
await page.mouse.down();
await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.8, { steps: 5 });
await page.mouse.up();
const vertical = Number(await page.getAttribute('#c', 'aria-valuenow'));
check('vertical orientation tracks the Y axis', Math.abs(vertical - 80) <= 3, `position=${vertical}`);

// 10. Style isolation: a hostile host stylesheet must not reach inside.
await page.addStyleTag({ content: 'img { display:none !important; width:1px !important } div { background: red !important }' });
const isolated = await page.locator('#c').evaluate((el) => {
  const img = el.shadowRoot.querySelector('.before-img');
  return getComputedStyle(img).display !== 'none' && img.getBoundingClientRect().width > 100;
});
check('shadow DOM isolates the element from host CSS', isolated);

// 11. Double registration must not throw.
await page.evaluate(async () => { await import('/src/alter-compare.js?again=1'); });
check('re-importing the module does not throw on duplicate define', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
server.close();

let failures = 0;
for (const r of results) {
  if (!r.pass) failures++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(`\n${results.length - failures}/${results.length} browser checks passed`);
if (pageErrors.length) console.log('page errors:', pageErrors);
process.exit(failures ? 1 : 0);
