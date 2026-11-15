import { useState } from 'react';
import CesiumGlobe, { type CesiumOpenImageryMode } from '../maps/cesium/CesiumGlobe';
import ArchivalMapLibrePlate from '../maps/ArchivalMapLibrePlate';

const OPEN_SOURCE_PROVIDERS = [
  {
    code: 'PRV-01',
    name: 'OpenFreeMap + MapLibre GL JS',
    layer: 'Vector GL + 3D Extruded Buildings',
    license: 'BSD-3 / ODbL (OpenStreetMap)',
    keyRequired: 'ZERO KEYS',
    palette: 'Restyled to #F1F2EA Parchment, #D5DAC6 Water, #8C2F22 Oxblood',
  },
  {
    code: 'PRV-02',
    name: 'USGS 3DEP / NAIP + Esri Clarity',
    layer: 'Sub-Meter Roof Orthoimagery',
    license: 'Public Domain / Community',
    keyRequired: 'ZERO KEYS',
    palette: 'True-Color High-Res Roof Facet Inspection',
  },
  {
    code: 'PRV-03',
    name: 'Copernicus Sentinel-2 Cloudless (EOX)',
    layer: '10m Global Multispectral Mosaic',
    license: 'CC-BY 4.0 (ESA / EOX)',
    keyRequired: 'ZERO KEYS',
    palette: 'Global Cloudless Satellite Base',
  },
  {
    code: 'PRV-04',
    name: 'Iowa State Mesonet (IEM) NEXRAD N0Q',
    layer: 'Live & Archival NOAA Weather Radar',
    license: 'Public Domain (NOAA / NWS)',
    keyRequired: 'ZERO KEYS',
    palette: 'Level-III Base Reflectivity Overlay',
  },
  {
    code: 'PRV-05',
    name: 'Photon OpenStreetMap Geocoder (Komoot)',
    layer: 'Instant Parcel & Street Address Search',
    license: 'Apache 2.0 / ODbL',
    keyRequired: 'ZERO KEYS',
    palette: 'GeoJSON Coordinate & Parcel Resolver',
  },
];

export default function GlobePage() {
  const [engine, setEngine] = useState<'maplibre-archival' | 'cesium-3d-globe' | 'split-plate'>('split-plate');
  const [cesiumImagery, setCesiumImagery] = useState<CesiumOpenImageryMode>('usgs-aerial');
  const [layerRadar, setLayerRadar] = useState(true);

  return (
    <div className="min-h-screen bg-[var(--parchment)] p-6 text-[var(--ink)]">
      <div className="mx-auto max-w-7xl">
        {/* Folio Kicker & Statement Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker">FOLIO 05 — OPEN-SOURCE GEOSPATIAL & 3D ORBITAL STUDIO</p>
            <hr className="rule my-3" />
            <h1 className="statement text-3xl md:text-4xl text-[var(--ink)]">
              MapLibre GL · OpenFreeMap · Cesium 3D · IEM NEXRAD
            </h1>
            <p className="deck mt-1.5 text-base">
              100% open-source, zero-API-key cartography restyled in the AUCTUM Archival Ledger palette (#F1F2EA parchment, #D5DAC6 water, #17231D ink, #8C2F22 oxblood).
            </p>
          </div>

          {/* Engine Mode Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['split-plate', '01 · DUAL PLATE (MAPLIBRE + CESIUM 3D)'],
                ['maplibre-archival', '02 · MAPLIBRE GL + OPENFREEMAP'],
                ['cesium-3d-globe', '03 · CESIUM 3D ORBITAL GLOBE'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEngine(id)}
                className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  engine === id
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--parchment)]'
                    : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--ink)] hover:bg-[var(--parchment-deep)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Geospatial Plates */}
        <div className="mt-6 space-y-6">
          {(engine === 'maplibre-archival' || engine === 'split-plate') && (
            <ArchivalMapLibrePlate
              heightClassName={engine === 'split-plate' ? 'h-[440px]' : 'h-[580px]'}
              folioCode="PLATE 05A · MAPLIBRE GL JS + OPENFREEMAP ARCHIVAL VECTOR"
              plateTitle="Custom Parchment Cartography (#F1F2EA), 3D Building Extrusions & Live NEXRAD Radar"
            />
          )}

          {(engine === 'cesium-3d-globe' || engine === 'split-plate') && (
            <div className="border border-[var(--ink)] bg-[var(--parchment)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--parchment-deep)] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--oxblood)]">
                    PLATE 05B · CESIUMJS 3D ORBITAL GLOBE (ZERO-TOKEN STACK)
                  </span>
                  <span className="font-display text-sm text-[var(--ink)]">
                    USGS Aerial Ortho · EOX Sentinel-2 · IEM NEXRAD Swath Cylinders
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['usgs-aerial', 'USGS / ESRI AERIAL'],
                      ['eox-sentinel2', 'EOX SENTINEL-2'],
                      ['osm-archival', 'OPENSTREETMAP'],
                    ] as const
                  ).map(([modeId, label]) => (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => setCesiumImagery(modeId)}
                      className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                        cesiumImagery === modeId
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--parchment)]'
                          : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--ink)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setLayerRadar((v) => !v)}
                    className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                      layerRadar
                        ? 'border-[var(--oxblood)] bg-[var(--oxblood)] text-[var(--parchment)]'
                        : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--slate)]'
                    }`}
                  >
                    {layerRadar ? '◆ NEXRAD WMS: ON' : '◇ NEXRAD WMS: OFF'}
                  </button>
                </div>
              </div>

              <div className={engine === 'split-plate' ? 'h-[440px]' : 'h-[580px]'}>
                <CesiumGlobe
                  center={{ lat: 32.86, lon: -96.81 }}
                  zoom={12}
                  radarEnabled={layerRadar}
                  imageryMode={cesiumImagery}
                />
              </div>
            </div>
          )}
        </div>

        {/* Open-Source Geospatial Provider Ledger Table */}
        <section className="mt-8 border border-[var(--hairline)] bg-[var(--parchment)]">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--parchment-deep)] px-4 py-2.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--oxblood)]">
              INDEX · VERIFIED OPEN-SOURCE GEOSPATIAL PROVIDERS
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--status-verified)]">
              5/5 ZERO-KEY PROVIDERS ACTIVE
            </span>
          </div>
          <div className="divide-y divide-[var(--hairline)]">
            {OPEN_SOURCE_PROVIDERS.map((p) => (
              <div
                key={p.code}
                className="grid grid-cols-1 gap-2 px-4 py-3 font-mono text-xs md:grid-cols-12 md:items-center"
              >
                <div className="text-[var(--oxblood)] md:col-span-1">{p.code}</div>
                <div className="font-display text-sm text-[var(--ink)] md:col-span-3">{p.name}</div>
                <div className="text-[var(--slate)] md:col-span-3">{p.layer}</div>
                <div className="text-[var(--ink)] md:col-span-3">{p.palette}</div>
                <div className="text-right text-[var(--status-verified)] md:col-span-2">
                  ✓ {p.keyRequired}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
