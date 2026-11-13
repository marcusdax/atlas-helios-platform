/**
 * Resolves the two checks the brand set leaves open:
 *   01 §8 constraint 7 — "Helios accent must be perceptually distinct from Atlas (ΔE2000 >= 15)",
 *                        status "Keep, unresolved. Accent still marked TO CONFIRM;
 *                        no colour-vision or contrast check recorded."
 *   README decision 8  — "Helios accent — confirm #C4873A after a ΔE2000 and contrast check?"
 *
 * CIEDE2000 per Sharma, Wu & Dalal (2005). WCAG 2.x contrast per the relative
 * luminance definition. No dependencies, so the numbers can be re-derived by
 * anyone without installing anything.
 */
'use strict';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function hexToLab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  // sRGB D65 -> XYZ
  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  // D65 reference white
  const [Xn, Yn, Zn] = [0.95047, 1.0, 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(X / Xn); const fy = f(Y / Yn); const fz = f(Z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(hex1, hex2) {
  const [L1, a1, b1] = hexToLab(hex1);
  const [L2, a2, b2] = hexToLab(hex2);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hp = (bb, ap) => {
    if (bb === 0 && ap === 0) return 0;
    const h = Math.atan2(bb, ap) * deg;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else dhp = h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;

  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;

  const T = 1
    - 0.17 * Math.cos((hbp - 30) * rad)
    + 0.24 * Math.cos(2 * hbp * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad)
    - 0.20 * Math.cos((4 * hbp - 63) * rad);

  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2)
    + Math.pow(dCp / SC, 2)
    + Math.pow(dHp / SH, 2)
    + RT * (dCp / SC) * (dHp / SH)
  );
}

/* ---------------------------------------------------------------- inputs -- */

const INK_950 = '#0A0D11';   // app canvas, the ground every accent sits on
const ATLAS = '#D08A3E';
const HELIOS = '#C4873A';    // marked (TO CONFIRM) in the brand matrix

const ENGINE = {
  'ink-950': '#0A0D11', 'ink-900': '#11161C', 'ink-800': '#182028',
  'ink-700': '#222A33', 'slate-600': '#34404D', 'slate-300': '#9AA4AE',
  ivory: '#F6F1E7', brass: '#C9A15A', proof: '#2E8B6B', alert: '#D9534F'
};

const pad = (s, n) => String(s).padEnd(n);
const r2 = (n) => n.toFixed(2);

console.log('CONTRAST ON ink-950 (' + INK_950 + ') — WCAG AA large/UI 3:1, body text 4.5:1\n');
const rows = [['atlas', ATLAS], ['helios (TO CONFIRM)', HELIOS], ...Object.entries(ENGINE).filter(([k]) => k !== 'ink-950')];
for (const [name, hex] of rows) {
  const c = contrast(hex, INK_950);
  const verdict = c >= 4.5 ? 'AA text' : c >= 3 ? 'AA UI only' : 'FAIL';
  console.log(`  ${pad(name, 22)} ${hex}  ${pad(r2(c) + ':1', 9)} ${verdict}`);
}

console.log('\nΔE2000 — brand constraint: Atlas vs Helios must be >= 15\n');
const d = deltaE2000(ATLAS, HELIOS);
console.log(`  atlas ${ATLAS}  vs  helios ${HELIOS}   ΔE2000 = ${r2(d)}   ${d >= 15 ? 'PASS' : 'FAIL'}`);

console.log('\n  for scale, the same pair against other estate colours:');
for (const [name, hex] of [['brass', ENGINE.brass], ['proof', ENGINE.proof], ['alert', ENGINE.alert]]) {
  console.log(`    atlas vs ${pad(name, 8)} ΔE2000 = ${r2(deltaE2000(ATLAS, hex))}`);
}

if (d < 15) {
  console.log('\nSEARCH — hues that clear ΔE2000 >= 15 from Atlas and 4.5:1 on ink-950,');
  console.log('         staying in the warm gold family Helios asks for:\n');
  const found = [];
  for (let L = 55; L <= 88; L += 1) {
    for (let h = 30; h <= 60; h += 1) {
      for (let C = 30; C <= 75; C += 1) {
        // Lab -> sRGB
        const hr = h * (Math.PI / 180);
        const a = C * Math.cos(hr); const b = C * Math.sin(hr);
        const fy = (L + 16) / 116; const fx = fy + a / 500; const fz = fy - b / 200;
        const fi = (t) => (Math.pow(t, 3) > 216 / 24389 ? Math.pow(t, 3) : (116 * t - 16) / (24389 / 27));
        const X = fi(fx) * 0.95047; const Y = fi(fy) * 1.0; const Z = fi(fz) * 1.08883;
        const lr = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
        const lg = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
        const lb = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
        const g = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
        const rgb = [g(lr), g(lg), g(lb)];
        if (rgb.some((c) => c < 0 || c > 1)) continue;
        const hex = '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
        const dd = deltaE2000(ATLAS, hex);
        const cc = contrast(hex, INK_950);
        if (dd >= 15 && cc >= 4.5) found.push({ hex, dd, cc, L, h, C });
      }
    }
  }
  found.sort((x, y) => x.dd - y.dd);
  const seen = new Set();
  found.filter((f) => { const k = f.hex; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8)
    .forEach((f) => console.log(`    ${f.hex}  ΔE2000 ${r2(f.dd)}  contrast ${r2(f.cc)}:1`));
  console.log(`\n  (${found.length} candidates in that range; the closest ones are listed, since the`);
  console.log('   brand wants Helios to read as a sibling of Atlas, not a different family.)');
}
