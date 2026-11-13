# Mapping stack

Atlas renders its own maps from open data. Nothing in this stack needs an API
key, a billing account, or a per-view charge, and no layer is locked to a
vendor.

The reason to write it down is that open-source mapping separates three things
that commercial SDKs sell as one, and only the middle one is a real decision
for this product.

| Layer | What Atlas uses | Licence | Why |
|---|---|---|---|
| Data | **OpenStreetMap** | ODbL | The foundational open map of the world. Every vector option below is OSM underneath, so changing host does not change the map's content. |
| Tile hosting | **OpenFreeMap** (default) or **Protomaps / PMTiles** (self-hosted) | Open source · free | The only genuine choice here. See below. |
| Tile schema | **OpenMapTiles** | Open source | Standard vector layer names, so one style serves both hosts. |
| Renderer | **MapLibre GL JS** | BSD-3 | Hardware-accelerated vector rendering; the community fork of Mapbox GL JS v1. Already the renderer here. |
| Imagery | **USGS The National Map** | Public domain | Raster aerial. Not OSM, and the only basemap on which roof condition is legible. |

## The hosting choice

Set with `REACT_APP_BASEMAP_PROVIDER`.

### `hosted` — OpenFreeMap (default)

A public instance of an open-source vector tile stack, serving OSM data in the
OpenMapTiles schema. No API key, no registration, no view or rate limit, and
commercial use is permitted.

Nothing to run, which is why it is the default: a storm-response tool should
not have an outage because a tile plan lapsed.

### `pmtiles` — Protomaps, self-hosted

A whole region packaged as a single static `.pmtiles` archive. The browser
fetches byte ranges over HTTP, so there is no tile server and no PostGIS —
"hosting" is anything that can serve a byte range: Cloudflare R2, S3, a static
host, or a file on a laptop in a truck.

```bash
REACT_APP_BASEMAP_PROVIDER=pmtiles
REACT_APP_PMTILES_URL=https://tiles.example.com/dfw.pmtiles
# only for an archive built with the Protomaps schema rather than OpenMapTiles:
REACT_APP_PMTILES_STYLE_URL=https://example.com/style.json
```

Choose this for:

- **Air-gapped or poor-connectivity work.** The archive can sit on the device.
- **Traffic heavy enough that leaning on a free public instance would be rude.**
- **Predictable cost.** Static storage, no per-request tile pricing.

Building an archive is outside this repo: `planetiler` produces OpenMapTiles-schema
`.pmtiles` from an OSM extract, and Protomaps publishes daily global builds.

### Falling back

If `pmtiles` is selected without `REACT_APP_PMTILES_URL`, the map falls back to
the hosted provider and **says so** in the map footer. A missing archive should
degrade to a working map, not to a blank canvas — but silently serving a
different host than the operator configured is its own problem, so the fallback
is stated rather than hidden.

## Styling

Both hosts serve the **OpenMapTiles schema**, so one style works for either.

The built-in style in `packages/atlas-radar-map/src/basemaps.js` is written out
rather than fetched. A self-hosted archive exists so the map works without the
public internet; a style fetched from a CDN at boot would put that dependency
straight back. It covers what matters when someone is looking for a roof —
water, land, buildings, the road hierarchy, boundaries, place and street labels
— in the engine palette, so the basemap recedes behind the damage overlays.

An archive built with the **Protomaps basemap schema** uses different layer
names and needs its own style; pass `REACT_APP_PMTILES_STYLE_URL` for that.

## What this stack does not use, deliberately

### `tile.openstreetmap.org`

Refused in code, not merely discouraged. `assertUsableTileUrl` throws on that
host and on its `tile.osm.org` alias, so it cannot arrive later through
configuration.

Those raster tiles run on donated, volunteer-operated infrastructure under a
usage policy that forbids heavy and commercial traffic, and OSMF blocks clients
that ignore it. For a commercial product this is not a shortcut — it is using
someone else's donated bandwidth, and it will break in production.

### GLG Toolkit Community Edition (GLG-CE)

Evaluated and **not usable here**, on licence grounds rather than technical
ones. It is a capable real-time HMI/SCADA engine with an integrated map server,
orthographic globe projection and high-frequency moving-object overlays — a
genuinely good fit for fleet and telemetry work on paper.

Three things rule it out:

1. **Non-commercial only.** It is free for academic, evaluation, personal or
   non-commercial use where the resulting application is distributed free of
   charge. Atlas is a commercial platform that charges a disclosed fee, so it
   does not qualify.
2. **Proprietary freeware, not open source.** "Free" here means zero cost, not
   licensed to modify or redistribute, which is a different thing from every
   other row in the table above.
3. **Format lock-in.** Drawings and map configurations authored in the
   Community Edition cannot be loaded by the paid Production Edition, so
   "prototype now, licence later" is not actually available — the prototype
   would have to be rebuilt.

If a commercial GLG licence is ever bought, revisit it for the C2/telemetry
surfaces specifically. It should not be adopted on the Community Edition.

## Attribution

OSM data is ODbL and requires attribution. MapLibre's attribution control
carries it on the canvas; the map footer additionally names which host served
the tiles, so the two never disagree.
