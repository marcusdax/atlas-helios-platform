import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { basemapsFor } from '@atlas/radar-map';

/**
 * Which basemap host this deployment uses, and the one-time wiring it needs.
 *
 * The choice is deployment configuration rather than a code change, because
 * the right answer differs per install:
 *
 *   REACT_APP_BASEMAP_PROVIDER   'hosted' (default) | 'pmtiles'
 *   REACT_APP_PMTILES_URL        .pmtiles archive, e.g. https://…/dfw.pmtiles
 *   REACT_APP_PMTILES_STYLE_URL  optional; required only for an archive built
 *                                with the Protomaps schema instead of
 *                                OpenMapTiles
 *
 * `hosted` points at OpenFreeMap's public instance: no key, no registration,
 * no rate limit, commercial use allowed. `pmtiles` points at a single static
 * archive and makes the basemap work with no tile server at all — the case
 * for an air-gapped truck, or for traffic heavy enough that leaning on a free
 * public instance would be rude.
 */

const env = (name) => {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export const basemapConfig = {
  provider: env('REACT_APP_BASEMAP_PROVIDER') || 'hosted',
  pmtilesUrl: env('REACT_APP_PMTILES_URL'),
  pmtilesStyleUrl: env('REACT_APP_PMTILES_STYLE_URL')
};

/**
 * Resolved once at module load. `basemapsFor` falls back to the hosted
 * provider when `pmtiles` is selected without an archive URL, and reports that
 * through `meta.fellBack` rather than silently serving something the operator
 * did not choose.
 */
export const basemaps = basemapsFor(basemapConfig);

/**
 * Register the `pmtiles://` protocol with MapLibre.
 *
 * It resolves each tile request into an HTTP range request against the single
 * archive. Registration is global and must happen once before any map is
 * constructed, and registering twice throws, hence the guard — React in
 * development mounts every effect twice.
 */
let registered = false;

export function ensurePmtilesProtocol() {
  if (registered || !basemaps.meta.needsPmtilesProtocol) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}

/**
 * What to tell the operator about the basemap, or null when there is nothing
 * worth saying. A fallback is worth saying: the map works, but it is not the
 * one they configured, and finding that out from a network tab is worse.
 */
export function basemapNotice() {
  if (basemaps.meta.fellBack) {
    return 'REACT_APP_BASEMAP_PROVIDER is set to pmtiles but REACT_APP_PMTILES_URL is empty, '
      + 'so the map is using the hosted OpenFreeMap tiles instead.';
  }
  return null;
}
