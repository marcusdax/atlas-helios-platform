'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RadarTimeline, framesFromRainViewer,
  RadarLanes, sourceKey,
  toAlertFeatures, propertiesInAlerts, pointInGeometry, geometryBounds,
  toPropertyFeatures, bandFor,
  severityOf, isActionable
} = require('../src/index.js');

const frames = (count, startMs = 1_000_000) =>
  Array.from({ length: count }, (_, i) => ({ time: startMs + i * 120000, path: `/f${i}` }));

/* --------------------------------------------------------------- timeline -- */

test('a new timeline opens on the most recent frame', () => {
  const timeline = new RadarTimeline({ frames: frames(12) });
  assert.equal(timeline.index, 11);
  assert.equal(timeline.atLatest, true);
  assert.equal(timeline.progress, 1);
});

test('frames are sorted oldest to newest regardless of input order', () => {
  const shuffled = [...frames(5)].reverse();
  const timeline = new RadarTimeline({ frames: shuffled });
  const times = timeline.frames.map((f) => f.time);
  assert.deepEqual([...times].sort((a, b) => a - b), times);
});

test('stepping wraps in both directions', () => {
  const timeline = new RadarTimeline({ frames: frames(5) });

  timeline.seek(4).step(1);
  assert.equal(timeline.index, 0, 'past the end wraps to the start');

  timeline.seek(0).step(-1);
  assert.equal(timeline.index, 4, 'before the start wraps to the end');
});

test('a refresh keeps the playhead on the same moment, not the same index', () => {
  // The bug this guards: a poll appends a frame and drops the oldest, so an
  // index-preserving refresh slides the view backwards in time every minute.
  const initial = frames(10);
  const timeline = new RadarTimeline({ frames: initial });
  timeline.seek(4);
  const heldTime = timeline.current.time;

  const refreshed = [...initial.slice(1), { time: initial[9].time + 120000, path: '/new' }];
  timeline.setFrames(refreshed);

  assert.equal(timeline.current.time, heldTime, 'still showing the same scan');
  assert.equal(timeline.index, 3, 'which is now one index earlier');
});

test('an empty timeline is safe to drive', () => {
  const timeline = new RadarTimeline({ frames: [] });
  assert.equal(timeline.current, null);
  assert.doesNotThrow(() => timeline.step(1).seekFraction(0.5).jumpToLatest());
  assert.equal(timeline.index, 0);
});

test('seekTime lands on the nearest frame', () => {
  const timeline = new RadarTimeline({ frames: frames(5) });
  // Just past frame 2's timestamp should still choose frame 2.
  timeline.seekTime(1_000_000 + 2 * 120000 + 1000);
  assert.equal(timeline.index, 2);
});

test('seekFraction maps 0..1 across the loop', () => {
  const timeline = new RadarTimeline({ frames: frames(11) });
  timeline.seekFraction(0);
  assert.equal(timeline.index, 0);
  timeline.seekFraction(0.5);
  assert.equal(timeline.index, 5);
  timeline.seekFraction(2);
  assert.equal(timeline.index, 10, 'out-of-range fractions are clamped');
});

test('the newest frame is held longer than the rest', () => {
  const timeline = new RadarTimeline({ frames: frames(5), frameMs: 500, dwellMs: 1000 });
  timeline.seek(2);
  const mid = timeline.holdMs;
  timeline.jumpToLatest();
  assert.ok(timeline.holdMs > mid, 'the frame people read gets a dwell');
});

test('speed scales the frame hold and is clamped to a sane range', () => {
  const timeline = new RadarTimeline({ frames: frames(5), frameMs: 800 });
  timeline.seek(1);
  const base = timeline.holdMs;
  timeline.setSpeed(2);
  assert.ok(timeline.holdMs < base);
  timeline.setSpeed(1000);
  assert.equal(timeline.speed, 8);
  timeline.setSpeed(0);
  assert.equal(timeline.speed, 0.25);
});

test('subscribers are notified and a throwing subscriber cannot stop playback', () => {
  const timeline = new RadarTimeline({ frames: frames(4) });
  const seen = [];
  timeline.subscribe(() => { throw new Error('bad listener'); });
  timeline.subscribe((s) => seen.push(s.index));

  assert.doesNotThrow(() => timeline.seek(1));
  assert.deepEqual(seen, [1]);
});

test('RainViewer frames parse onto one axis with forecast last', () => {
  const parsed = framesFromRainViewer({
    host: 'https://tilecache.rainviewer.com',
    radar: {
      past: [{ time: 100, path: '/p1' }, { time: 200, path: '/p2' }],
      nowcast: [{ time: 300, path: '/n1' }]
    }
  });

  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed.map((f) => f.kind), ['past', 'past', 'forecast']);
  assert.equal(parsed[0].time, 100000, 'seconds are converted to milliseconds');

  const noForecast = framesFromRainViewer({
    host: 'h', radar: { past: [{ time: 1, path: '/a' }], nowcast: [{ time: 2, path: '/b' }] }
  }, { includeForecast: false });
  assert.equal(noForecast.length, 1);

  assert.deepEqual(framesFromRainViewer({}), [], 'a payload with no host yields nothing');
});

/* ------------------------------------------------------------------ lanes -- */

/** Minimal stand-in for a MapLibre map, recording what the lanes ask of it. */
function fakeMap() {
  const state = { sources: new Map(), layers: new Map(), calls: [] };
  return {
    state,
    getSource: (id) => state.sources.get(id),
    getLayer: (id) => state.layers.get(id),
    addSource(id, spec) {
      state.calls.push(['addSource', id]);
      state.sources.set(id, {
        spec,
        setTiles(tiles) { this.spec.tiles = tiles; state.calls.push(['setTiles', id]); }
      });
    },
    removeSource(id) { state.calls.push(['removeSource', id]); state.sources.delete(id); },
    addLayer(spec) { state.calls.push(['addLayer', spec.id]); state.layers.set(spec.id, spec); },
    removeLayer(id) { state.calls.push(['removeLayer', id]); state.layers.delete(id); },
    setPaintProperty(layerId, prop, value) {
      const layer = state.layers.get(layerId);
      if (layer) layer.paint = { ...layer.paint, [prop]: value };
      state.calls.push(['setPaintProperty', layerId, value]);
    }
  };
}

const tilesFor = (path) => ({
  provider: 'rainviewer',
  tileUrl: `https://host${path}/256/{z}/{x}/{y}/4/1_1.png`,
  tileSize: 256,
  maxZoom: 12,
  attribution: 'RainViewer'
});

test('scrubbing reuses two sources instead of creating one per frame', () => {
  const map = fakeMap();
  const lanes = new RadarLanes(map, { opacity: 0.7 });

  for (let i = 0; i < 20; i++) lanes.show(tilesFor(`/f${i}`));

  const added = map.state.calls.filter((c) => c[0] === 'addSource');
  assert.equal(added.length, 2, 'exactly two sources for twenty frames');
  assert.equal(map.state.sources.size, 2);
  // Every frame after the first two updates an existing source in place.
  assert.equal(map.state.calls.filter((c) => c[0] === 'setTiles').length, 18);
});

test('a parked lane is faded, never removed, so its tiles survive', () => {
  const map = fakeMap();
  const lanes = new RadarLanes(map);

  lanes.show(tilesFor('/a'));
  lanes.show(tilesFor('/b'));

  assert.equal(map.state.calls.filter((c) => c[0] === 'removeSource').length, 0);
  assert.equal(map.state.layers.size, 2);

  const opacities = [...map.state.layers.values()].map((l) => l.paint['raster-opacity']);
  assert.ok(opacities.includes(0), 'one lane is parked at zero');
  assert.ok(opacities.some((o) => o > 0), 'the other holds the playhead');
});

test('lanes alternate so the outgoing frame keeps its cache', () => {
  const map = fakeMap();
  const lanes = new RadarLanes(map);

  lanes.show(tilesFor('/a'));
  const first = lanes.active;
  lanes.show(tilesFor('/b'));
  assert.notEqual(lanes.active, first);
  lanes.show(tilesFor('/c'));
  assert.equal(lanes.active, first);
});

test('changing provider forces a new source, changing frame does not', () => {
  const map = fakeMap();
  const lanes = new RadarLanes(map);

  lanes.show(tilesFor('/a'));
  lanes.show(tilesFor('/b'));
  const before = map.state.calls.filter((c) => c[0] === 'removeSource').length;

  // Same lane, different provider: tile size and pyramid belong to the source.
  lanes.show({ ...tilesFor('/c'), provider: 'nowcoast', tileSize: 512 });
  lanes.show({ ...tilesFor('/d'), provider: 'nowcoast', tileSize: 512 });

  assert.ok(
    map.state.calls.filter((c) => c[0] === 'removeSource').length > before,
    'a provider change rebuilds the source'
  );
});

test('sourceKey distinguishes what belongs to a source from what does not', () => {
  const a = tilesFor('/1');
  const b = tilesFor('/2');
  assert.equal(sourceKey(a), sourceKey(b), 'a new frame is the same source');
  assert.notEqual(sourceKey(a), sourceKey({ ...a, tileSize: 512 }));
  assert.notEqual(sourceKey(a), sourceKey({ ...a, provider: 'nowcoast' }));
});

test('clear fades both lanes but destroy removes them', () => {
  const map = fakeMap();
  const lanes = new RadarLanes(map);
  lanes.show(tilesFor('/a'));
  lanes.show(tilesFor('/b'));

  lanes.clear();
  assert.equal(map.state.layers.size, 2, 'clear keeps the layers');
  assert.ok([...map.state.layers.values()].every((l) => l.paint['raster-opacity'] === 0));

  lanes.destroy();
  assert.equal(map.state.layers.size, 0);
  assert.equal(map.state.sources.size, 0);
});

/* ----------------------------------------------------------------- alerts -- */

const polygon = (ring) => ({ type: 'Polygon', coordinates: [ring] });
const SQUARE = [[-97, 32], [-96, 32], [-96, 33], [-97, 33], [-97, 32]];

test('alerts without geometry are dropped rather than drawn at null island', () => {
  const features = toAlertFeatures({
    features: [
      { geometry: polygon(SQUARE), properties: { event: 'Tornado Warning', severity: 'Extreme' } },
      { geometry: null, properties: { event: 'Heat Advisory', severity: 'Minor' } }
    ]
  });

  assert.equal(features.length, 1);
  assert.equal(features[0].properties.event, 'Tornado Warning');
});

test('alerts are ordered so the most severe draws last', () => {
  const features = toAlertFeatures({
    features: [
      { geometry: polygon(SQUARE), properties: { event: 'Tornado Warning', severity: 'Extreme' } },
      { geometry: polygon(SQUARE), properties: { event: 'Frost Advisory', severity: 'Minor' } }
    ]
  });

  assert.deepEqual(features.map((f) => f.properties.severity), ['Minor', 'Extreme']);
});

test('actionable filtering keeps the events that generate work', () => {
  const payload = {
    features: [
      { geometry: polygon(SQUARE), properties: { event: 'Tornado Warning', severity: 'Extreme' } },
      { geometry: polygon(SQUARE), properties: { event: 'Air Quality Alert', severity: 'Minor' } }
    ]
  };
  assert.equal(toAlertFeatures(payload).length, 2);
  assert.equal(toAlertFeatures(payload, { actionableOnly: true }).length, 1);
});

test('severity lookup falls back rather than throwing on an unknown value', () => {
  assert.equal(severityOf({ properties: { severity: 'Nonsense' } }).rank, 0);
  assert.equal(severityOf(null).rank, 0);
  assert.equal(isActionable({ properties: { event: 'Tornado Warning' } }), true);
});

test('point in polygon honours holes', () => {
  const donut = {
    type: 'Polygon',
    coordinates: [
      [[-98, 31], [-95, 31], [-95, 34], [-98, 34], [-98, 31]],
      [[-97, 32], [-96, 32], [-96, 33], [-97, 33], [-97, 32]]
    ]
  };
  assert.equal(pointInGeometry(-97.5, 31.5, donut), true, 'inside the ring');
  assert.equal(pointInGeometry(-96.5, 32.5, donut), false, 'inside the hole is outside');
  assert.equal(pointInGeometry(-90, 32, donut), false, 'well outside');
});

test('MultiPolygon geometry is supported', () => {
  const multi = {
    type: 'MultiPolygon',
    coordinates: [[SQUARE], [[[-80, 25], [-79, 25], [-79, 26], [-80, 26], [-80, 25]]]]
  };
  assert.equal(pointInGeometry(-96.5, 32.5, multi), true);
  assert.equal(pointInGeometry(-79.5, 25.5, multi), true);
  assert.equal(pointInGeometry(0, 0, multi), false);
});

test('property exposure returns the worst covering alert, sorted', () => {
  const features = toAlertFeatures({
    features: [
      { geometry: polygon(SQUARE), properties: { event: 'Severe Thunderstorm Warning', severity: 'Severe' } },
      { geometry: polygon(SQUARE), properties: { event: 'Tornado Warning', severity: 'Extreme' } }
    ]
  });

  const exposed = propertiesInAlerts([
    { id: 'in', latitude: 32.5, longitude: -96.5 },
    { id: 'out', latitude: 47.6, longitude: -122.3 },
    { id: 'ungeocoded', latitude: null, longitude: null }
  ], features);

  assert.equal(exposed.length, 1);
  assert.equal(exposed[0].id, 'in');
  assert.equal(exposed[0].alert_count, 2);
  assert.equal(exposed[0].worst_alert.event, 'Tornado Warning');
});

test('geometryBounds computes a usable prefilter box', () => {
  const bounds = geometryBounds(polygon(SQUARE));
  assert.deepEqual(bounds, { north: 33, south: 32, east: -96, west: -97 });
  assert.equal(geometryBounds({ type: 'Point', coordinates: [0, 0] }), null);
});

/* ------------------------------------------------------------- properties -- */

test('property features drop ungeocoded rows and carry a risk band', () => {
  const collection = toPropertyFeatures([
    { id: '1', address: '1 A St', latitude: 32.7, longitude: -96.8, damage_probability: 85 },
    { id: '2', address: '2 B St', latitude: null, longitude: null, damage_probability: 20 }
  ]);

  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0].properties.band, 'Severe');
  assert.deepEqual(collection.features[0].geometry.coordinates, [-96.8, 32.7]);
});

test('risk bands cover the whole scale', () => {
  assert.equal(bandFor(95).label, 'Severe');
  assert.equal(bandFor(70).label, 'High');
  assert.equal(bandFor(50).label, 'Moderate');
  assert.equal(bandFor(0).label, 'Low');
  assert.equal(bandFor(undefined).label, 'Low');
});
