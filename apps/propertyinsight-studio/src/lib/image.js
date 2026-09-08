const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('That file could not be read.'));
  reader.readAsDataURL(file);
});

/**
 * Prepare a camera photo for upload.
 *
 * A phone photo is 4-12 MB and base64 inflates it by a third, so posting the
 * original means a slow upload over the LTE connection a rep is standing on,
 * and a body that can exceed the proxy limit. Providers consume far less
 * resolution than that, so 1600px on the long edge costs nothing visible.
 *
 * Downscaling also strips EXIF as a side effect, which keeps the GPS
 * coordinates embedded in a job-site photo from travelling to a model vendor.
 */
export async function prepareImage(file, { maxEdge = 1600, quality = 0.86 } = {}) {
  if (!file) throw new Error('No file selected.');
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP image.');
  }

  const dataUrl = await readAsDataUrl(file);

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be decoded as an image.'));
    img.src = dataUrl;
  });

  if (Math.max(image.naturalWidth, image.naturalHeight) <= maxEdge) return dataUrl;

  const scale = maxEdge / Math.max(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}
