import { createRenderClient, AlterRenderEngine, mockProvider } from '@alter/render-core';

/**
 * The single place the app decides where renders come from.
 *
 * Both branches satisfy the same `render()` contract, so no component below
 * this file knows or cares which one is live. That is what makes the feature
 * demoable on a laptop with no backend, and what keeps the provider key on the
 * server in every other case.
 *
 * Set REACT_APP_ALTER_RENDER_MODE=offline to develop the UI without the API.
 */
const OFFLINE = process.env.REACT_APP_ALTER_RENDER_MODE === 'offline';

export const renderer = OFFLINE
  ? new AlterRenderEngine({ provider: mockProvider({ latencyMs: 900 }) })
  : createRenderClient({
      endpoint: process.env.REACT_APP_ALTER_RENDER_ENDPOINT || '/api/renders',
      credentials: 'include'
    });

export const isOfflineRenderer = OFFLINE;

/** Browser File -> data URL, the input format the engine and client both take. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale before upload.
 *
 * A modern phone photo is 4-12 MB, and the models cap the resolution they
 * actually use well below that. Shrinking client-side cuts upload time on the
 * LTE connection a field rep is standing on, and keeps request bodies inside
 * the proxy's limit. 1600px is comfortably above what the providers consume.
 */
export async function prepareImage(file, { maxEdge = 1600, quality = 0.86 } = {}) {
  const dataUrl = await fileToDataUrl(file);

  if (typeof document === 'undefined' || !/^data:image\/(jpeg|png|webp)/.test(dataUrl)) {
    return dataUrl;
  }

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be decoded as an image.'));
    img.src = dataUrl;
  });

  if (Math.max(image.width, image.height) <= maxEdge) return dataUrl;

  const scale = maxEdge / Math.max(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}
