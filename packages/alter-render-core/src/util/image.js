'use strict';

const { invalid } = require('../errors');

const DATA_URL_RE = /^data:([a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126});base64,([A-Za-z0-9+/]+={0,2})$/;

const DEFAULT_LIMITS = {
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 12 * 1024 * 1024 // ~12 MB decoded; providers reject well before this
};

/** base64 decodes to 3 bytes per 4 chars, minus padding. No decode required. */
function base64Bytes(b64) {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Parse and validate a `data:` image URL.
 *
 * Images are passed as data URLs rather than files because that is the one
 * representation every host shares — a browser FileReader, a Node Buffer
 * (`buffer.toString('base64')`), a mobile webview, and an HTTP JSON body all
 * produce it without a multipart pipeline in between.
 */
function parseDataUrl(value, limits = {}) {
  const { mimeTypes, maxBytes } = { ...DEFAULT_LIMITS, ...limits };

  if (typeof value !== 'string' || value.length === 0) {
    throw invalid('image must be a base64 data URL string');
  }
  const match = DATA_URL_RE.exec(value.trim());
  if (!match) {
    throw invalid('image must match "data:<mime>;base64,<data>"');
  }

  const [, mimeType, data] = match;
  if (!mimeTypes.includes(mimeType)) {
    throw invalid(`unsupported image type "${mimeType}"`, { allowed: mimeTypes });
  }

  const bytes = base64Bytes(data);
  if (bytes > maxBytes) {
    throw invalid(`image is ${bytes} bytes, limit is ${maxBytes}`, { bytes, maxBytes });
  }
  if (bytes < 64) {
    throw invalid('image payload is too small to be a valid image');
  }

  return { mimeType, data, bytes, dataUrl: value.trim() };
}

const toDataUrl = (mimeType, data) => `data:${mimeType};base64,${data}`;

module.exports = { parseDataUrl, toDataUrl, base64Bytes, DEFAULT_LIMITS };
