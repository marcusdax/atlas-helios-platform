import { useEffect, useRef, useState } from 'react';

export type CesiumOpenImageryMode = 'usgs-aerial' | 'eox-sentinel2' | 'osm-archival';

interface CesiumGlobeProps {
  center?: { lat: number; lon: number };
  zoom?: number;
  onReady?: (viewer: any) => void;
  radarEnabled?: boolean;
  imageryMode?: CesiumOpenImageryMode;
}

export default function CesiumGlobe({
  center = { lat: 32.86, lon: -96.81 },
  zoom = 12,
  onReady,
  radarEnabled = true,
  imageryMode = 'usgs-aerial',
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: any | null = null;
    let cancelled = false;

    async function initViewer() {
      try {
        const Cesium = await import('cesium');

        const createImageryProvider = () => {
          if (imageryMode === 'usgs-aerial') {
            return new Cesium.UrlTemplateImageryProvider({
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              credit: 'Tiles © Esri, USGS, USDA NAIP',
              maximumLevel: 19,
            });
          }
          if (imageryMode === 'eox-sentinel2') {
            return new Cesium.UrlTemplateImageryProvider({
              url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
              credit: 'Sentinel-2 cloudless by EOX IT Services GmbH (Copernicus Sentinel data)',
              maximumLevel: 15,
            });
          }
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
            credit: '© OpenStreetMap contributors',
          });
        };

        viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: new Cesium.ImageryLayer(createImageryProvider()),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          skyBox: false,
          skyAtmosphere: false,
          animation: false,
          timeline: false,
          navigationHelpButton: false,
          homeButton: false,
          sceneModePicker: false,
          navigationInstructionsInitiallyVisible: false,
          requestRenderMode: false,
          baseLayerPicker: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
          contextOptions: {
            webgl: {
              preserveDrawingBuffer: true,
            },
          },
        } as any);

        if (cancelled) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;

        if (viewer.scene) {
          viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0F2244');
          if (viewer.scene.globe) {
            viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#17231D');
          }
          if (viewer.scene.sun) viewer.scene.sun.show = false;
          if (viewer.scene.moon) viewer.scene.moon.show = false;
        }

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            center.lon,
            center.lat,
            zoom === 12 ? 32000 : zoom * 2500,
          ),
        });

        // Iowa State Mesonet (IEM) Live NEXRAD Weather Radar Tile Overlay
        if (radarEnabled && typeof Cesium.UrlTemplateImageryProvider !== 'undefined') {
          try {
            const radarLayer = viewer.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
                credit: 'NOAA/NWS NEXRAD via Iowa State Mesonet (IEM)',
                maximumLevel: 12,
              }),
            );
            radarLayer.alpha = 0.58;
          } catch {
            /* ignore */
          }
        }

        // AUCTUM 4-Tier Market Lots & Storm Swath Cylinders
        const archivalLots = [
          {
            id: 'LOT-ATL-0418',
            name: 'LOT-ATL-0418 · 4821 Preston Hollow Dr (Atlas Tier 3)',
            lat: 32.8812,
            lon: -96.8045,
            colorHex: '#1A3A6B',
            radius: 2200,
          },
          {
            id: 'LOT-HEL-0192',
            name: 'LOT-HEL-0192 · 1904 Legacy West (Helios Tier 2)',
            lat: 33.0785,
            lon: -96.8241,
            colorHex: '#1A6666',
            radius: 1900,
          },
          {
            id: 'LOT-VAN-0884',
            name: 'LOT-VAN-0884 · 612 Magnolia Ave (Vanguard Tier 1)',
            lat: 32.7308,
            lon: -97.3324,
            colorHex: '#315C26',
            radius: 1700,
          },
          {
            id: 'SWATH-OXBLOOD-01',
            name: 'DFW Supercell Hail Core · 2.25" Hail (Oxblood Alert)',
            lat: 32.9483,
            lon: -96.7299,
            colorHex: '#8C2F22',
            radius: 3600,
          },
        ];

        archivalLots.forEach((lot) => {
          const color = Cesium.Color.fromCssColorString(lot.colorHex);
          viewer.entities.add({
            id: lot.id,
            name: lot.name,
            position: Cesium.Cartesian3.fromDegrees(lot.lon, lot.lat),
            ellipse: {
              semiMinorAxis: lot.radius,
              semiMajorAxis: lot.radius,
              material: color.withAlpha(0.28),
              outline: true,
              outlineColor: color,
              height: 0,
            },
            point: {
              pixelSize: 11,
              color,
              outlineColor: Cesium.Color.fromCssColorString('#F1F2EA'),
              outlineWidth: 2,
            },
            label: {
              text: lot.name,
              font: '600 11px "IBM Plex Mono", monospace',
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.fromCssColorString('#F1F2EA'),
              outlineColor: Cesium.Color.fromCssColorString('#17231D'),
              outlineWidth: 3,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              pixelOffset: new Cesium.Cartesian2(12, -10),
            },
          });
        });

        setReady(true);
        if (onReady) onReady(viewer);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Cesium 3D globe');
        }
      }
    }

    initViewer();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [center.lat, center.lon, zoom, radarEnabled, imageryMode, onReady]);

  if (error) {
    return (
      <div className="flex h-full min-h-[420px] w-full items-center justify-center border border-[var(--oxblood)] bg-[var(--parchment)] p-6 text-[var(--ink)]">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oxblood)]">
            CESIUM 3D GLOBE FALLBACK
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--slate)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[440px] w-full overflow-hidden border border-[var(--ink)] bg-[#0F2244]"
    >
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0F2244] text-[var(--parchment)]">
          <div className="text-center font-mono text-xs uppercase tracking-[0.16em]">
            INITIALIZING ZERO-KEY CESIUM 3D GLOBE + NEXRAD…
          </div>
        </div>
      )}
    </div>
  );
}
