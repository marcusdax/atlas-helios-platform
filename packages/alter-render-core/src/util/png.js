'use strict';

/**
 * Minimal PNG encoder (RGB, 8-bit, uncompressed deflate blocks).
 *
 * Exists so the mock provider can return a *real, visibly different* image with
 * no native dependency and no network. That matters more than it sounds: a host
 * integrating this package can wire up the full pipeline, run its tests, and
 * demo the UI before anyone provisions an API key or approves image spend.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const be32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function chunk(type, data) {
  const typeBytes = [...type].map((ch) => ch.charCodeAt(0));
  const body = typeBytes.concat(data);
  return be32(data.length).concat(body, be32(crc32(body)));
}

/** zlib stream wrapping stored (BTYPE=00) deflate blocks — no compressor needed. */
function zlibStored(raw) {
  const out = [0x78, 0x01];
  const MAX = 65535;
  for (let off = 0; off < raw.length || off === 0; off += MAX) {
    const slice = raw.slice(off, off + MAX);
    const isLast = off + MAX >= raw.length ? 1 : 0;
    out.push(isLast, slice.length & 0xff, (slice.length >>> 8) & 0xff);
    out.push(~slice.length & 0xff, (~slice.length >>> 8) & 0xff);
    for (let i = 0; i < slice.length; i++) out.push(slice[i]);
    if (isLast) break;
  }
  return out.concat(be32(adler32(raw)));
}

function base64(bytes) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHA[b0 >> 2];
    out += ALPHA[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : ALPHA[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : ALPHA[b2 & 63];
  }
  return out;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>[number,number,number]} shade RGB per pixel
 * @returns {string} base64-encoded PNG (no data URL prefix)
 */
function encodePng(width, height, shade) {
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = shade(x, y);
      raw.push(r & 0xff, g & 0xff, b & 0xff);
    }
  }

  const ihdr = be32(width).concat(be32(height), [8, 2, 0, 0, 0]);
  const bytes = SIGNATURE.concat(chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', []));
  return base64(bytes);
}

module.exports = { encodePng, crc32, adler32 };
