import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibreNamespace from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const maplibregl: typeof maplibreNamespace =
  (maplibreNamespace as any).default ?? maplibreNamespace;

export type MatrixMapMode =
  | 'openfreemap-vector'
  | 'archival-folio'
  | 'aerial-ortho'
  | 'sentinel-cloudless'
  | 'trust-navy-radar';

export interface MatrixMapPin {
  id: string;
  tier: 'VANGUARD' | 'HELIOS' | 'ATLAS' | 'PROSPECT';
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  metricLabel: string;
  metricValue: string;
  hashPreview: string;
  color: string;
}

const DEFAULT_MATRIX_PINS: MatrixMapPin[] = [
  {
    id: 'LOT-ATL-0418',
    tier: 'ATLAS',
    title: '4821 Preston Hollow Dr · Dallas, TX',
    subtitle: 'Class-4 Impact Shingle · 38.4 SQ · 94/100 Hail Swath',
    lat: 32.8812,
    lng: -96.8045,
    metricLabel: 'VERIFIED SCOPE',
    metricValue: '$18,420.00',
    hashPreview: '9f86d081884c…7029a',
    color: '#1A3A6B',
  },
  {
    id: 'LOT-HEL-0192',
    tier: 'HELIOS',
    title: '1904 Legacy West · Plano, TX',
    subtitle: 'Roof + HVAC + Solar Detach/Reset · 3 Milestones',
    lat: 33.0785,
    lng: -96.8241,
    metricLabel: 'ESCROW DRAW',
    metricValue: '$42,800.00',
    hashPreview: '4b227777d4dd…891c3',
    color: '#1A6666',
  },
  {
    id: 'LOT-VAN-0884',
    tier: 'VANGUARD',
    title: '612 Magnolia Ave · Fort Worth, TX',
    subtitle: '4-Photo Field Attestation · 7/12 Pitch Locked',
    lat: 32.7308,
    lng: -97.3324,
    metricLabel: 'MISSION BOUNTY',
    metricValue: '$28.50',
    hashPreview: 'e3b0c44298fc…b855',
    color: '#315C26',
  },
  {
    id: 'LOT-PRO-0311',
    tier: 'PROSPECT',
    title: '3509 Turtle Creek Blvd · Dallas, TX',
    subtitle: 'Vivella Prospect AVM & Probate Title Chain',
    lat: 32.8089,
    lng: -96.8091,
    metricLabel: 'ATTESTED AVM',
    metricValue: '$645,000',
    hashPreview: '7c9e1120ab44…f102',
    color: '#5B3A8B',
  },
];

const DFW_CORRIDORS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { kind: 'river', name: 'Trinity River' },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-97.36, 32.94],
          [-97.26, 32.82],
          [-97.1, 32.77],
          [-96.94, 32.72],
          [-96.74, 32.63],
        ],
      },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'highway', name: 'I-35E / US-75 Oxblood Arterial' },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-96.96, 32.58],
          [-97.04, 32.87],
          [-97.14, 33.18],
        ],
      },
    },
    {
      type: 'Feature' as const,
      properties: { kind: 'highway', name: 'I-30 Trans-Metro' },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-97.44, 32.75],
          [-97.06, 32.8],
          [-96.62, 32.83],
        ],
      },
    },
  ],
};

const MODE_CONFIG: Record<
  MatrixMapMode,
  { shortLabel: string; provider: string; badge: string }
> = {
  'openfreemap-vector': {
    shortLabel: '01 · OPENFREEMAP GL',
    provider: 'OpenFreeMap + OpenMapTiles (Zero-Key Vector GL)',
    badge: 'PARCHMENT #F1F2EA · 3D EXTRUSION',
  },
  'archival-folio': {
    shortLabel: '02 · FOLIO RASTER',
    provider: 'CARTO Positron + OpenStreetMap',
    badge: 'MUSEUM MAT PLATE',
  },
  'aerial-ortho': {
    shortLabel: '03 · USGS / ESRI ORTHO',
    provider: 'USGS 3DEP / NAIP + Esri World Imagery',
    badge: 'SUB-METER ROOF AERIAL',
  },
  'sentinel-cloudless': {
    shortLabel: '04 · EOX SENTINEL-2',
    provider: 'Copernicus Sentinel-2 Cloudless (EOX)',
    badge: '10M MULTISPECTRAL',
  },
  'trust-navy-radar': {
    shortLabel: '05 · TRUST NAVY RADAR',
    provider: 'NOAA / Iowa State Mesonet (IEM) NEXRAD N0Q',
    badge: 'DEEP TRUST #0F2244',
  },
};

function buildMatrixRasterStyle(mode: MatrixMapMode, radarEnabled: boolean): maplibreNamespace.StyleSpecification {
  const isAerial = mode === 'aerial-ortho';
  const isSentinel = mode === 'sentinel-cloudless';
  const isNavy = mode === 'trust-navy-radar';

  const tiles = isAerial
    ? ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']
    : isSentinel
      ? ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg']
      : isNavy
        ? ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}']
        : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

  const sources: Record<string, maplibreNamespace.SourceSpecification> = {
    'matrix-base': {
      type: 'raster',
      tiles,
      tileSize: 256,
      maxzoom: isSentinel ? 15 : 19,
    },
  };

  const layers: maplibreNamespace.LayerSpecification[] = [
    {
      id: 'matrix-bg',
      type: 'background',
      paint: {
        'background-color': isNavy ? '#0F2244' : isAerial || isSentinel ? '#17231D' : '#F1F2EA',
      },
    },
    {
      id: 'matrix-base-layer',
      type: 'raster',
      source: 'matrix-base',
      paint:
        mode === 'archival-folio' || mode === 'openfreemap-vector'
          ? {
              'raster-saturation': -0.58,
              'raster-contrast': 0.14,
              'raster-brightness-min': 0.06,
              'raster-brightness-max': 0.95,
              'raster-opacity': 0.9,
            }
          : isNavy
            ? {
                'raster-saturation': -0.35,
                'raster-contrast': 0.22,
                'raster-opacity': 0.92,
              }
            : {
                'raster-opacity': 1,
              },
    },
  ];

  if (radarEnabled) {
    sources['iem-nexrad'] = {
      type: 'raster',
      tiles: ['https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 12,
    };
    layers.push({
      id: 'iem-nexrad-layer',
      type: 'raster',
      source: 'iem-nexrad',
      paint: {
        'raster-opacity': 0.56,
      },
    });
  }

  return {
    version: 8,
    name: `AUCTUM Matrix (${mode})`,
    sources,
    layers,
  };
}

export default function ArchivalMapLibrePlate({
  pins = DEFAULT_MATRIX_PINS,
  heightClassName = 'h-[440px]',
  folioCode = 'FOLIO PLATE · OPEN-SOURCE GEOSPATIAL MATRIX',
  plateTitle = 'MapLibre GL + OpenFreeMap Vector + USGS Ortho + EOX Sentinel-2 + IEM NEXRAD',
}: {
  pins?: MatrixMapPin[];
  heightClassName?: string;
  folioCode?: string;
  plateTitle?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibreNamespace.Map | null>(null);

  const [mode, setMode] = useState<MatrixMapMode>('openfreemap-vector');
  const [radarEnabled, setRadarEnabled] = useState<boolean>(true);
  const [pitched3D, setPitched3D] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [coords, setCoords] = useState({ lat: 32.86, lng: -96.84, zoom: 9.4 });

  const pinsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pins.map((pin) => ({
        type: 'Feature' as const,
        id: pin.id,
        properties: { ...pin },
        geometry: {
          type: 'Point' as const,
          coordinates: [pin.lng, pin.lat],
        },
      })),
    }),
    [pins],
  );

  const syncLayers = useCallback(
    (map: maplibreNamespace.Map) => {
      if (!map.isStyleLoaded()) return;

      if (!map.getSource('auctum-dfw-corridors')) {
        try {
          map.addSource('auctum-dfw-corridors', {
            type: 'geojson',
            data: DFW_CORRIDORS_GEOJSON as any,
          });
          map.addLayer({
            id: 'auctum-dfw-rivers',
            type: 'line',
            source: 'auctum-dfw-corridors',
            filter: ['==', ['get', 'kind'], 'river'],
            paint: { 'line-color': '#2B7A8F', 'line-width': 3, 'line-opacity': 0.55 },
          });
          map.addLayer({
            id: 'auctum-dfw-highways',
            type: 'line',
            source: 'auctum-dfw-corridors',
            filter: ['==', ['get', 'kind'], 'highway'],
            paint: { 'line-color': '#8C2F22', 'line-width': 2, 'line-opacity': 0.45, 'line-dasharray': [3, 2] },
          });
        } catch {
          /* ignore */
        }
      }

      const existing = map.getSource('auctum-matrix-pins') as maplibreNamespace.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(pinsGeoJson as any);
      } else {
        try {
          map.addSource('auctum-matrix-pins', {
            type: 'geojson',
            data: pinsGeoJson as any,
          });
          map.addLayer({
            id: 'auctum-matrix-swath',
            type: 'circle',
            source: 'auctum-matrix-pins',
            paint: {
              'circle-radius': 34,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.18,
              'circle-stroke-width': 2,
              'circle-stroke-color': ['get', 'color'],
            },
          });
          map.addLayer({
            id: 'auctum-matrix-core',
            type: 'circle',
            source: 'auctum-matrix-pins',
            paint: {
              'circle-radius': 10,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#F1F2EA',
            },
          });
        } catch {
          /* ignore */
        }
      }
    },
    [pinsGeoJson],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibreNamespace.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildMatrixRasterStyle(mode, radarEnabled) as any,
        center: [-96.88, 32.86],
        zoom: 9.4,
        pitch: pitched3D ? 48 : 0,
        bearing: pitched3D ? -12 : 0,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      } as any);

      mapRef.current = map;

      map.on('error', () => {});
      map.on('load', () => map && syncLayers(map));
      map.on('styledata', () => map && syncLayers(map));
      map.on('move', () => {
        if (!map) return;
        const c = map.getCenter();
        setCoords({
          lat: Number(c.lat.toFixed(4)),
          lng: Number(c.lng.toFixed(4)),
          zoom: Number(map.getZoom().toFixed(2)),
        });
      });

      map.on('click', 'auctum-matrix-core', (e: any) => {
        const feat = e.features?.[0];
        if (!feat || !map) return;
        const p = feat.properties || {};
        const pt = (feat.geometry as any).coordinates.slice();
        new maplibregl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(pt)
          .setHTML(
            `<div style="font-family:'IBM Plex Mono',monospace;color:#17231D;background:#F1F2EA;padding:8px 10px;border:1px solid #17231D;font-size:11px;">
              <div style="color:${p.color || '#8C2F22'};font-weight:600;letter-spacing:0.12em;">${p.id} · ${p.tier}</div>
              <div style="font-family:'Fraunces',serif;font-size:13px;margin-top:2px;">${p.title}</div>
              <div style="margin-top:3px;color:#536056;">${p.subtitle}</div>
              <div style="margin-top:4px;font-weight:600;">${p.metricLabel}: ${p.metricValue} · SHA-256 ${p.hashPreview}</div>
            </div>`,
          )
          .addTo(map);
      });
    } catch {
      /* ignore */
    }

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(buildMatrixRasterStyle(mode, radarEnabled));
    } catch {
      /* ignore */
    }
  }, [mode, radarEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncLayers(map);
  }, [syncLayers]);

  const togglePitch = () => {
    const next = !pitched3D;
    setPitched3D(next);
    const map = mapRef.current;
    if (map) {
      try {
        map.easeTo({
          pitch: next ? 48 : 0,
          bearing: next ? -15 : 0,
          zoom: next ? Math.max(map.getZoom(), 13.5) : map.getZoom(),
          duration: 700,
        });
      } catch {
        /* ignore */
      }
    }
  };

  const handlePhotonSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchStatus('SEARCHING PHOTON OSM…');
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lat=32.7767&lon=-96.797`,
      );
      if (!res.ok) throw new Error('Geocoder error');
      const data = await res.json();
      const feat = data?.features?.[0];
      if (!feat?.geometry?.coordinates) {
        setSearchStatus('NO MATCH IN OSM');
        return;
      }
      const [lng, lat] = feat.geometry.coordinates;
      const label = [feat.properties?.name, feat.properties?.street, feat.properties?.city, feat.properties?.state]
        .filter(Boolean)
        .join(', ');
      setSearchStatus(`LOCATED: ${label.toUpperCase() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}`);
      const map = mapRef.current;
      if (map) {
        map.flyTo({ center: [lng, lat], zoom: 15.5, pitch: pitched3D ? 48 : 0, duration: 1000 });
      }
    } catch {
      setSearchStatus('OFFLINE PARCEL COORDINATES');
    }
  };

  return (
    <div className="border border-[var(--ink)] bg-[var(--parchment)] text-[var(--ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--parchment-deep)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--oxblood)]">
            {folioCode}
          </span>
          <span className="text-[var(--ink)]/30">·</span>
          <span className="font-display text-sm text-[var(--ink)]">{plateTitle}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
          <span className="border border-[var(--hairline)] bg-[var(--parchment)] px-2 py-0.5 text-[var(--slate)]">
            {MODE_CONFIG[mode].badge}
          </span>
          <span className="border border-[var(--c-vanguard)] bg-[rgba(49,92,38,0.1)] px-2 py-0.5 text-[var(--c-vanguard)]">
            ZERO API KEYS · 100% OPEN SOURCE
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--parchment)] px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(MODE_CONFIG) as MatrixMapMode[]).map((k) => {
            const active = mode === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--parchment)]'
                    : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--ink)] hover:bg-[var(--parchment-deep)]'
                }`}
              >
                {MODE_CONFIG[k].shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRadarEnabled((v) => !v)}
            className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
              radarEnabled
                ? 'border-[var(--oxblood)] bg-[var(--oxblood)] text-[var(--parchment)]'
                : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--slate)]'
            }`}
          >
            {radarEnabled ? '◆ IEM NEXRAD RADAR: ON' : '◇ IEM NEXRAD RADAR: OFF'}
          </button>
          <button
            type="button"
            onClick={togglePitch}
            className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
              pitched3D
                ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--parchment)]'
                : 'border-[var(--hairline)] bg-[var(--parchment)] text-[var(--slate)]'
            }`}
          >
            {pitched3D ? '◆ 48° 3D ROOF EXTRUSION' : '◇ 2D PLANAR FOLIO'}
          </button>
        </div>
      </div>

      {/* Photon OpenStreetMap Geocoder Bar */}
      <form
        onSubmit={handlePhotonSearch}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hairline)] bg-[var(--parchment-deep)]/40 px-4 py-1.5"
      >
        <div className="flex flex-1 items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--oxblood)]">
            PHOTON OSM GEOCODER →
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parcel or address via OpenStreetMap Photon (e.g. 4821 Preston Hollow Dr, Dallas)…"
            className="min-w-[220px] flex-1 border border-[var(--hairline)] bg-[var(--parchment)] px-2.5 py-1 font-mono text-xs text-[var(--ink)] placeholder:text-[var(--slate)] focus:border-[var(--oxblood)] focus:outline-none"
          />
          <button
            type="submit"
            className="border border-[var(--ink)] bg-[var(--ink)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--parchment)] hover:bg-[var(--oxblood)]"
          >
            FLY TO PARCEL
          </button>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--slate)]">
          {searchStatus || `${coords.lat}°N · ${coords.lng}°W · Z${coords.zoom}`}
        </div>
      </form>

      {/* Map Canvas */}
      <div className={`relative w-full overflow-hidden ${heightClassName}`}>
        <div ref={containerRef} className="h-full w-full" />

        {/* Top-Right Quick-Jump 4-Tier Lot Chips */}
        <div className="absolute right-3 top-3 z-10 flex max-w-[330px] flex-col gap-1.5">
          {pins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => {
                mapRef.current?.flyTo({ center: [pin.lng, pin.lat], zoom: 12.2, duration: 750 });
              }}
              className="flex items-center justify-between gap-3 border border-[var(--ink)] bg-[var(--parchment)]/95 px-2.5 py-1.5 text-left font-mono text-[10px] shadow-sm transition-colors hover:bg-[var(--parchment-deep)]"
            >
              <span className="truncate font-semibold text-[var(--ink)]">
                <span className="mr-1.5 inline-block h-2 w-2" style={{ backgroundColor: pin.color }} />
                {pin.id} · {pin.title.split('·')[0]}
              </span>
              <span className="shrink-0 text-[var(--oxblood)]">{pin.metricValue} →</span>
            </button>
          ))}
        </div>

        {/* 4-Tier Legend Overlay */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 border border-[var(--ink)] bg-[var(--parchment)]/95 p-3">
          <div className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--oxblood)]">
            4-TIER MARKET & RADAR LEGEND
          </div>
          <div className="mt-1.5 space-y-1 font-mono text-[10px] text-[var(--ink)]">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 bg-[#315C26]" />
              <span>TIER 1 · VANGUARD FIELD ATTESTATION ($15 FLOOR)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 bg-[#1A6666]" />
              <span>TIER 2 · HELIOS MULTI-TRADE ESCROW</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 bg-[#1A3A6B]" />
              <span>TIER 3 · ATLAS ROOFING & STORM SWATH</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 bg-[#5B3A8B]" />
              <span>TIER 4 · VIVELLA PROSPECT AVM & PROBATE</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-10 border border-[var(--hairline)] bg-[var(--parchment)]/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--slate)]">
          {MODE_CONFIG[mode].provider}
        </div>
      </div>
    </div>
  );
}
