'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BASEMAPS, basemapsFor, hostedBasemaps, pmtilesBasemaps,
  openMapTilesStyle, assertUsableTileUrl
} = require('../src/basemaps');

const PMTILES = 'https://tiles.example.com/dfw.pmtiles';

/* ------------------------------------------------------------- refusals -- */

test('the OSM volunteer tile host is refused, not merely discouraged', () => {
  assert.throws(
    () => assertUsableTileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    /Refusing tile host tile\.openstreetmap\.org/
  );
  assert.throws(() => assertUsableTileUrl('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'), /Refusing/);
  assert.throws(() => assertUsableTileUrl('https://tile.osm.org/{z}/{x}/{y}.png'), /Refusing/);
});

test('the refusal explains itself, so the fix does not need the commit log', () => {
  try {
    assertUsableTileUrl('https://tile.openstreetmap.org/0/0/0.png');
    assert.fail('expected a throw');
  } catch (error) {
    assert.match(error.message, /commercial/i);
    assert.match(error.message, /OpenFreeMap|PMTiles/);
  }
});

test('hosts that merely contain the string are not refused', () => {
  // A self-hosted mirror is a different thing from the OSMF servers.
  assert.doesNotThrow(() => assertUsableTileUrl('https://tile.openstreetmap.org.example.com/0/0/0.png'));
  assert.doesNotThrow(() => assertUsableTileUrl('https://my-tile.openstreetmap.org.internal/0/0/0.png'));
});

test('a relative path or template fragment passes through untouched', () => {
  assert.equal(assertUsableTileUrl('/tiles/{z}/{x}/{y}.pbf'), '/tiles/{z}/{x}/{y}.pbf');
  assert.equal(assertUsableTileUrl(''), '');
  assert.equal(assertUsableTileUrl(undefined), undefined);
});

/* -------------------------------------------------------------- hosted --- */

test('the hosted provider needs no key and names its attribution', () => {
  const maps = hostedBasemaps();
  for (const id of ['streets', 'dark']) {
    assert.match(maps[id].styleUrl, /^https:\/\/tiles\.openfreemap\.org\//);
    assert.doesNotMatch(maps[id].styleUrl, /key|token|apikey/i);
    assert.match(maps[id].attribution, /OpenStreetMap contributors/);
  }
});

/* ------------------------------------------------------------- pmtiles --- */

test('a pmtiles basemap points MapLibre at the archive over the pmtiles protocol', () => {
  const maps = pmtilesBasemaps({ url: PMTILES });
  assert.equal(maps.dark.style.sources.omt.url, `pmtiles://${PMTILES}`);
  assert.equal(maps.dark.style.sources.omt.type, 'vector');
  assert.equal(maps.dark.pmtilesUrl, PMTILES);
});

test('a supplied style URL wins over the built-in one', () => {
  const maps = pmtilesBasemaps({ url: PMTILES, styleUrl: 'https://cdn.example.com/protomaps-dark.json' });
  assert.equal(maps.dark.styleUrl, 'https://cdn.example.com/protomaps-dark.json');
  assert.equal(maps.dark.style, undefined, 'the two must not both be set, or the caller has to pick');
});

test('the built-in style carries attribution, since ODbL requires it', () => {
  const maps = pmtilesBasemaps({ url: PMTILES });
  assert.match(maps.dark.style.sources.omt.attribution, /OpenStreetMap contributors/);
});

test('a refused host cannot be smuggled in as a pmtiles archive', () => {
  assert.throws(() => pmtilesBasemaps({ url: 'https://tile.openstreetmap.org/x.pmtiles' }), /Refusing/);
});

/* --------------------------------------------------------------- style --- */

test('the built-in style is a valid MapLibre style skeleton', () => {
  const style = openMapTilesStyle({ source: { type: 'vector', url: 'pmtiles://x' } });
  assert.equal(style.version, 8);
  assert.ok(Array.isArray(style.layers) && style.layers.length > 0);
  assert.equal(style.layers[0].type, 'background');

  // Every layer must reference a source that exists, or MapLibre throws at load.
  const defined = new Set(Object.keys(style.sources));
  for (const layer of style.layers) {
    if (layer.type === 'background') continue;
    assert.ok(defined.has(layer.source), `layer ${layer.id} references unknown source ${layer.source}`);
    assert.ok(layer['source-layer'], `layer ${layer.id} needs a source-layer in a vector schema`);
  }
});

test('layer ids are unique', () => {
  const ids = openMapTilesStyle({ source: { type: 'vector', url: 'pmtiles://x' } }).layers.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('themes differ, and both set an explicit background', () => {
  const dark = openMapTilesStyle({ source: {}, theme: 'dark' });
  const light = openMapTilesStyle({ source: {}, theme: 'light' });
  const bg = (s) => s.layers[0].paint['background-color'];
  assert.notEqual(bg(dark), bg(light));
  assert.match(bg(dark), /^#[0-9A-Fa-f]{6}$/);
  assert.match(bg(light), /^#[0-9A-Fa-f]{6}$/);
});

test('an unknown theme falls back to dark rather than rendering colourless', () => {
  const unknown = openMapTilesStyle({ source: {}, theme: 'chartreuse' });
  const dark = openMapTilesStyle({ source: {}, theme: 'dark' });
  assert.equal(unknown.layers[0].paint['background-color'], dark.layers[0].paint['background-color']);
});

/* ---------------------------------------------------------- resolution --- */

test('the default configuration is the hosted provider', () => {
  const maps = basemapsFor();
  assert.equal(maps.meta.provider, 'hosted');
  assert.equal(maps.meta.needsPmtilesProtocol, false);
  assert.equal(maps.meta.fellBack, false);
});

test('choosing pmtiles with a url selects it and asks for the protocol handler', () => {
  const maps = basemapsFor({ provider: 'pmtiles', pmtilesUrl: PMTILES });
  assert.equal(maps.meta.provider, 'pmtiles');
  assert.equal(maps.meta.needsPmtilesProtocol, true);
  assert.equal(maps.meta.fellBack, false);
});

test('choosing pmtiles without a url degrades to a working map and says so', () => {
  const maps = basemapsFor({ provider: 'pmtiles' });
  assert.equal(maps.meta.provider, 'hosted', 'a missing archive must not yield a blank canvas');
  assert.equal(maps.meta.requested, 'pmtiles');
  assert.equal(maps.meta.fellBack, true, 'the caller has to be able to tell the operator');
  assert.ok(maps.dark.styleUrl, 'and the fallback must actually be usable');
});

test('every provider offers the same basemap ids, so switching host changes nothing else', () => {
  const hosted = basemapsFor();
  const archive = basemapsFor({ provider: 'pmtiles', pmtilesUrl: PMTILES });
  const ids = (m) => Object.keys(m).filter((k) => k !== 'meta').sort();
  assert.deepEqual(ids(hosted), ids(archive));
});

test('imagery stays raster and stays available under either provider', () => {
  for (const maps of [basemapsFor(), basemapsFor({ provider: 'pmtiles', pmtilesUrl: PMTILES })]) {
    assert.ok(maps.imagery.raster.tiles[0].startsWith('https://basemap.nationalmap.gov/'));
    assert.equal(maps.imagery.style, undefined);
  }
});

test('the legacy BASEMAPS export still resolves to the hosted provider', () => {
  assert.ok(BASEMAPS.dark.styleUrl.includes('openfreemap'));
  assert.ok(BASEMAPS.imagery.raster);
});
