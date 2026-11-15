import { useEffect, useRef, useState } from 'react';

interface UseCesiumGlobeOptions {
  onReady?: (viewer: any) => void;
  autoResize?: boolean;
}

export function useCesiumGlobe({ onReady, autoResize = true }: UseCesiumGlobeOptions = {}) {
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

        viewer = new Cesium.Viewer(containerRef.current!, {
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              credit: '© OpenStreetMap contributors',
            })
          ),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          animation: false,
          timeline: false,
          navigationHelpButton: false,
          homeButton: false,
          sceneModePicker: false,
          navigationInstructionsInitiallyVisible: false,
          requestRenderMode: true,
          baseLayerPicker: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
        });

        if (cancelled) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;
        setReady(true);
        if (onReady) onReady(viewer);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Cesium viewer');
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
  }, [onReady]);

  // Auto-resize on window changes
  useEffect(() => {
    if (!autoResize || !viewerRef.current) return;

    const handleResize = () => {
      if (viewerRef.current) {
        viewerRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoResize, ready]);

  const flyTo = (lat: number, lon: number, height: number = 10000) => {
    if (!viewerRef.current) return;
    import('cesium').then((Cesium) => {
      viewerRef.current!.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      });
    });
  };

  const addMarker = (id: string, lat: number, lon: number, name?: string, description?: string) => {
    if (!viewerRef.current) return;
    import('cesium').then((Cesium) => {
      viewerRef.current!.entities.add({
        id,
        name,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 8,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: name || id,
          font: '12px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          pixelOffset: new Cesium.Cartesian2(10, -10),
        },
        description: description || name,
      });
    });
  };

  return { containerRef, viewerRef, ready, error, flyTo, addMarker };
}