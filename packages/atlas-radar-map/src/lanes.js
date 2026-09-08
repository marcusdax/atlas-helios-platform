'use strict';

/**
 * Two radar lanes that hand over by opacity.
 *
 * Adapted from OpenRadar's `syncRadarLane` (MIT), whose insight is worth
 * restating because it is not obvious: a scrubbing radar loop must NOT swap
 * the tile source on every frame.
 *
 * The naive implementation points one raster source at the current frame's
 * URL and updates it as the playhead moves. Every update invalidates the whole
 * tile pyramid, so the map refetches every visible tile, every frame — which
 * on a 30-frame loop at 2x is a few hundred requests a second against a free
 * NOAA endpoint, and a picture that flashes white between frames.
 *
 * Instead there are two lanes. The playhead lives in one while the other is
 * pre-loaded with the next frame, and they cross-fade. Tiles already fetched
 * stay resident, the seam between frames is a fade rather than a blank, and
 * the request rate falls to one frame's worth of new tiles.
 *
 * A lane with nothing to show is faded to zero and LEFT IN PLACE. Removing it
 * would discard its tile cache and refetch on the way back — which is exactly
 * what happens every time the playhead crosses between the lanes.
 */

/** What makes a source a different source, rather than the same one at a new address. */
const sourceKey = (tiles) =>
  [tiles.provider, tiles.tileSize, tiles.maxZoom, tiles.scheme || 'xyz'].join('|');

/**
 * @typedef {object} LanePlan
 * @property {string} sourceId
 * @property {string} layerId
 */

/**
 * Put one lane on the map, or fade it out of the way.
 *
 * @param {object} map        a MapLibre/Mapbox GL map (or anything with the same six methods)
 * @param {LanePlan} plan
 * @param {object|null} tiles what the lane should show, or null when the other lane has the playhead
 * @param {number} opacity    0 hands over without tearing anything down
 * @param {string|null} heldKey the key this lane's source was last built for
 * @param {(layerId: string) => string|undefined} [before] which layer to insert beneath
 * @returns {{ added: boolean, opacity: number, key: string|null }}
 */
function syncLane(map, plan, tiles, opacity, heldKey, before) {
  let added = false;
  let key = heldKey;

  if (tiles) {
    const nextKey = sourceKey(tiles);

    // Tile size, native zoom and provider belong to the source, so a change in
    // any of them means a genuinely new source rather than a new URL.
    if (map.getSource(plan.sourceId) && heldKey !== nextKey) {
      if (map.getLayer(plan.layerId)) map.removeLayer(plan.layerId);
      map.removeSource(plan.sourceId);
    }
    key = nextKey;

    const source = map.getSource(plan.sourceId);
    if (source) {
      // Same source, new address: setTiles keeps the cache and the layer.
      if (typeof source.setTiles === 'function') source.setTiles([tiles.tileUrl]);
    } else {
      map.addSource(plan.sourceId, {
        type: 'raster',
        tiles: [tiles.tileUrl],
        tileSize: tiles.tileSize,
        maxzoom: tiles.maxZoom,
        attribution: tiles.attribution
      });
    }

    if (!map.getLayer(plan.layerId)) {
      map.addLayer({
        id: plan.layerId,
        type: 'raster',
        source: plan.sourceId,
        paint: {
          'raster-opacity': opacity,
          // No fade: the cross-fade between lanes is the transition, and
          // MapLibre's own per-tile fade on top of it reads as a stutter.
          'raster-fade-duration': 0
        }
      }, before ? before(plan.layerId) : undefined);
      added = true;
    } else {
      map.setPaintProperty(plan.layerId, 'raster-opacity', opacity);
    }

    return { added, opacity, key };
  }

  // Nothing to show: fade to nothing, but leave the lane standing so its tiles
  // survive until the playhead comes back.
  if (map.getLayer(plan.layerId)) {
    map.setPaintProperty(plan.layerId, 'raster-opacity', 0);
  }
  return { added, opacity: 0, key };
}

/**
 * Drives both lanes from one playhead.
 *
 * `render(frame, nextFrame, opacity)` is called on every timeline change: the
 * active lane is drawn at the layer opacity, the other is parked at zero, and
 * the two swap on each frame so the outgoing lane keeps its tiles.
 */
class RadarLanes {
  constructor(map, {
    idPrefix = 'atlas-radar',
    opacity = 0.7,
    before
  } = {}) {
    this.map = map;
    this.opacity = opacity;
    this.before = before;
    this.plans = [
      { sourceId: `${idPrefix}-a-src`, layerId: `${idPrefix}-a` },
      { sourceId: `${idPrefix}-b-src`, layerId: `${idPrefix}-b` }
    ];
    this.keys = [null, null];
    this.active = 0;
  }

  setOpacity(opacity) {
    this.opacity = Math.min(1, Math.max(0, opacity));
    const result = syncLane(this.map, this.plans[this.active], null, 0, this.keys[this.active], this.before);
    this.keys[this.active] = result.key;
    if (this.map.getLayer(this.plans[this.active].layerId)) {
      this.map.setPaintProperty(this.plans[this.active].layerId, 'raster-opacity', this.opacity);
    }
    return this;
  }

  /**
   * Draw a frame. Alternating lanes on each call is what keeps the previous
   * frame's tiles resident while the next one loads.
   */
  show(tiles) {
    if (!tiles) return this.clear();

    const next = this.active === 0 ? 1 : 0;
    const incoming = syncLane(this.map, this.plans[next], tiles, this.opacity, this.keys[next], this.before);
    this.keys[next] = incoming.key;

    // Park the outgoing lane rather than removing it.
    syncLane(this.map, this.plans[this.active], null, 0, this.keys[this.active], this.before);

    this.active = next;
    return incoming.added;
  }

  /** Fade both lanes out without discarding their tiles. */
  clear() {
    for (let i = 0; i < this.plans.length; i++) {
      syncLane(this.map, this.plans[i], null, 0, this.keys[i], this.before);
    }
    return false;
  }

  /** Remove everything — only on unmount, where the cache dies anyway. */
  destroy() {
    for (const plan of this.plans) {
      if (this.map.getLayer(plan.layerId)) this.map.removeLayer(plan.layerId);
      if (this.map.getSource(plan.sourceId)) this.map.removeSource(plan.sourceId);
    }
    this.keys = [null, null];
  }
}

module.exports = { RadarLanes, syncLane, sourceKey };
