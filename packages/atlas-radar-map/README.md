# @atlas/radar-map

Weather radar mapping for Atlas & Helios: an animated NOAA radar mosaic, NWS
warning polygons, and a property-risk overlay on a MapLibre GL map.

Framework-agnostic and DOM-free — it manipulates a map object and transforms
data. The React component that uses it lives in
`frontend/src/components/maps/RadarMap.js`.

```js
const { RadarTimeline, RadarLanes, toAlertFeatures, alertLayers } = require('@atlas/radar-map');

const lanes = new RadarLanes(map, { opacity: 0.7 });
const timeline = new RadarTimeline({ frames });

timeline.subscribe(({ frame }) => lanes.show(frame?.tiles || null));
timeline.play();
```

---

## Adapted from OpenRadar

The radar approach here is adapted from
[OpenRadar](https://github.com/marcusdax/OpenRadar) (MIT), whose premise this
package keeps: **the data is public**. NOAA publishes every MRMS grid, radar
mosaic and warning polygon free to anyone who asks, so a storm-intelligence
product has no reason to rent its weather picture from a reseller. Nothing here
needs an API key.

What carried over, and what did not:

| OpenRadar | Here | Why |
|---|---|---|
| Two-lane radar cross-fade | **Ported** | The core insight — see below |
| Public NOAA/NWS/RainViewer source catalogue | **Ported** | Same data, no key |
| MapLibre GL vector rendering | **Ported** | Zooms to a single roof |
| Rust NEXRAD Level II / GRIB2 decoding | Not ported | A desktop app with a native sidecar; this is a browser in a field truck |
| Tauri native tile cache | Not ported | No native side to cache into |

### The two-lane cross-fade

The one piece worth explaining, because the naive version looks correct and is
not.

Point a single raster source at the current frame's URL and update it as the
playhead moves, and every update invalidates the whole tile pyramid. The map
refetches every visible tile, every frame — a few hundred requests a second on
a 30-frame loop at 2x, against a free public endpoint, with the picture
flashing white between frames.

So there are two lanes. The playhead lives in one while the other pre-loads the
next frame, and they hand over by opacity. Tiles already fetched stay resident,
the seam is a fade rather than a blank, and the request rate drops to one
frame's worth of new tiles.

A lane with nothing to show is faded to zero and **left in place**. Removing it
would discard its tile cache and refetch on the way back — which happens every
time the playhead crosses between lanes.

`sourceKey()` decides what forces a genuinely new source (provider, tile size,
native zoom) versus what is just a new address (the frame).

---

## What's in it

| Module | What it does |
|---|---|
| `sources` | `RADAR_PROVIDERS`, `BASEMAPS`, NWS endpoint, severity ranking |
| `timeline` | `RadarTimeline` — frames, playhead, play/scrub/speed, `framesFromRainViewer` |
| `lanes` | `RadarLanes`, `syncLane` — the cross-fade above |
| `alerts` | `toAlertFeatures`, `propertiesInAlerts`, point-in-polygon, `alertLayers` |
| `properties` | `toPropertyFeatures`, `propertyLayers`, risk bands |

### Two behaviours worth knowing

**The playhead follows the moment, not the index.** A refresh appends a new
frame and drops the oldest. Holding the index would slide the view backwards in
time on every poll — a "live" radar that quietly drifts into the past.
`setFrames()` re-finds the nearest timestamp instead.

**Ungeocoded rows are dropped, not plotted.** `Number(null)` is `0` and
`Number.isFinite(0)` is `true`, so a naive check places a property with no
coordinates in the Gulf of Guinea. Coordinates are parsed strictly.

---

## Alerts as a dispatch list

The map layer is half of it. `propertiesInAlerts()` does the point-in-polygon
test that turns a weather feed into a work list — each property returned with
its **worst** covering alert, sorted, because that is what a dispatcher acts on.
A bounding-box pre-filter keeps a national alert sweep against a large book of
business near-linear.

Served by the backend at `GET /api/radar/exposure`, which crosses the feed with
the caller's own properties.

---

## Tests

```bash
npm test --workspace=@atlas/radar-map     # 27 tests, no network, no DOM
```

They cover the parts that break quietly: loop-boundary wrapping, the
moment-preserving refresh, that scrubbing 20 frames creates exactly two tile
sources, that a parked lane is faded rather than removed, polygon holes, and
severity ordering.

The map itself is verified in `tests/e2e/platform.e2e.mjs`, which drives the
real page in Chromium with the tile hosts stubbed.
