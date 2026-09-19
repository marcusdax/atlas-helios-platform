import React, { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  RadarTimeline, RadarLanes,
  toAlertFeatures, alertLayers,
  toPropertyFeatures, propertyLayers,
  BASEMAPS, RISK_BANDS
} from '@atlas/radar-map';
import { api, messageFor } from '../../lib/api';

/**
 * The storm map.
 *
 * Three layers stacked in the order a dispatcher reads them: an animated radar
 * mosaic underneath, NWS warning polygons over it, and this company's
 * properties on top coloured by damage probability. The question the whole
 * screen answers is "which of my roofs is under that".
 *
 * The radar animation is driven by @atlas/radar-map, whose two-lane cross-fade
 * is adapted from OpenRadar: scrubbing a two-hour loop reuses two tile sources
 * instead of rebuilding one per frame, which is the difference between a smooth
 * scrub and several hundred requests a second at a free NOAA endpoint.
 */
export default function RadarMap({
  properties = [],
  basemap = 'dark',
  height = 560,
  onPropertyClick,
  showAlerts = true
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const lanesRef = useRef(null);
  const timelineRef = useRef(null);
  const playTimerRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [opacity, setOpacity] = useState(0.7);
  const [state, setState] = useState({ index: 0, length: 0, playing: false, frame: null, progress: 1 });
  const [alertCount, setAlertCount] = useState(0);

  /* ---- map bootstrap ---- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const spec = BASEMAPS[basemap] || BASEMAPS.dark;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: spec.styleUrl || {
        version: 8,
        sources: { base: { type: 'raster', ...spec.raster, attribution: spec.attribution } },
        layers: [{ id: 'base', type: 'raster', source: 'base' }]
      },
      center: [-96.797, 32.7767],
      zoom: 6,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    map.on('load', () => {
      lanesRef.current = new RadarLanes(map, { opacity: 0.7 });
      setReady(true);
    });
    // A style that fails to load must not leave a blank rectangle with no
    // explanation; the map is the product here.
    map.on('error', (event) => {
      if (event?.error?.message) setError(event.error.message);
    });

    mapRef.current = map;
    return () => {
      clearTimeout(playTimerRef.current);
      lanesRef.current?.destroy();
      map.remove();
      mapRef.current = null;
      lanesRef.current = null;
    };
  }, [basemap]);

  /* ---- radar frames ---- */
  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();

    const timeline = new RadarTimeline({ frameMs: 450 });
    timelineRef.current = timeline;
    const unsubscribe = timeline.subscribe(setState);

    const load = async () => {
      try {
        const payload = await api.radar.frames({ forecast: true }, controller.signal);
        const provider = payload.data;
        timeline.setFrames(provider.frames.map((f) => ({
          time: f.time,
          kind: f.kind,
          tiles: {
            provider: provider.provider,
            tileUrl: f.tileUrl,
            tileSize: provider.tileSize,
            maxZoom: provider.maxZoom,
            attribution: provider.attribution
          }
        })));
      } catch (err) {
        if (!controller.signal.aborted) setError(messageFor(err));
      }
    };

    load();
    // Refresh the index periodically; setFrames keeps the playhead on the same
    // moment, so a refresh never yanks the view backwards.
    const poll = setInterval(load, 5 * 60 * 1000);

    return () => {
      controller.abort();
      clearInterval(poll);
      unsubscribe();
      timelineRef.current = null;
    };
  }, [ready]);

  /* ---- draw the current frame ---- */
  useEffect(() => {
    if (!ready || !lanesRef.current) return;
    lanesRef.current.show(state.frame?.tiles || null);
  }, [ready, state.frame]);

  useEffect(() => {
    lanesRef.current?.setOpacity(opacity);
  }, [opacity]);

  /* ---- playback ---- */
  useEffect(() => {
    clearTimeout(playTimerRef.current);
    const timeline = timelineRef.current;
    if (!timeline || !state.playing || state.length === 0) return undefined;

    // A timeout chain rather than an interval: the newest frame gets a longer
    // dwell, so a fixed interval would rush past the frame people read.
    playTimerRef.current = setTimeout(() => timeline.step(1), timeline.holdMs);
    return () => clearTimeout(playTimerRef.current);
  }, [state.playing, state.index, state.length]);

  /* ---- alerts ---- */
  useEffect(() => {
    if (!ready || !showAlerts) return undefined;
    const map = mapRef.current;
    const controller = new AbortController();

    const load = async () => {
      try {
        const payload = await api.radar.alerts({ actionable: false }, controller.signal);
        const features = toAlertFeatures(payload);
        setAlertCount(features.length);

        const data = { type: 'FeatureCollection', features };
        const source = map.getSource('atlas-alerts');
        if (source) {
          source.setData(data);
        } else {
          map.addSource('atlas-alerts', { type: 'geojson', data });
          alertLayers({ sourceId: 'atlas-alerts' }).forEach((layer) => {
            if (!map.getLayer(layer.id)) map.addLayer(layer);
          });
        }
      } catch (err) {
        if (!controller.signal.aborted && err.code !== 'ALERTS_UNAVAILABLE') setError(messageFor(err));
      }
    };

    load();
    const poll = setInterval(load, 90 * 1000);
    return () => { controller.abort(); clearInterval(poll); };
  }, [ready, showAlerts]);

  /* ---- property overlay ---- */
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const data = toPropertyFeatures(properties);

    const source = map.getSource('atlas-properties');
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource('atlas-properties', { type: 'geojson', data });
    propertyLayers({ sourceId: 'atlas-properties' }).forEach((layer) => {
      if (!map.getLayer(layer.id)) map.addLayer(layer);
    });

    map.on('click', 'atlas-properties-circles', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      new maplibregl.Popup({ closeButton: true, offset: 10 })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(
          `<div style="font:500 13px/1.5 system-ui;color:#111">
             <strong>${feature.properties.address || 'Property'}</strong><br/>
             ${feature.properties.city || ''} ${feature.properties.state || ''}<br/>
             Risk ${Math.round(feature.properties.risk)} · ${feature.properties.band}
           </div>`
        )
        .addTo(map);
      onPropertyClick?.(feature.properties.id);
    });

    map.on('mouseenter', 'atlas-properties-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'atlas-properties-circles', () => { map.getCanvas().style.cursor = ''; });
  }, [ready, properties, onPropertyClick]);

  const scrub = useCallback((event) => {
    timelineRef.current?.pause().seekFraction(Number(event.target.value));
  }, []);

  const frameLabel = state.frame
    ? new Date(state.frame.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const isForecast = state.frame?.kind === 'forecast';

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div ref={containerRef} style={{ height }} className="w-full" />

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800 bg-neutral-900/80 px-4 py-3">
        <button
          type="button"
          onClick={() => timelineRef.current?.toggle()}
          disabled={state.length === 0}
          className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-neutral-950 transition hover:bg-sky-400 disabled:bg-neutral-700 disabled:text-neutral-500"
        >
          {state.playing ? 'Pause' : 'Play'}
        </button>

        <label className="flex flex-1 items-center gap-2 text-xs text-neutral-400">
          <span className="sr-only">Radar timeline</span>
          <input
            type="range"
            min="0" max="1" step="0.001"
            value={state.progress}
            onChange={scrub}
            disabled={state.length === 0}
            className="w-full accent-sky-500"
            aria-label="Radar timeline position"
          />
        </label>

        <span className={`min-w-[6.5rem] text-right text-sm tabular-nums ${isForecast ? 'text-violet-300' : 'text-neutral-200'}`}>
          {frameLabel}{isForecast ? ' (fc)' : ''}
        </span>

        <button
          type="button"
          onClick={() => timelineRef.current?.jumpToLatest()}
          className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
        >
          Live
        </button>

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          Opacity
          <input
            type="range" min="0" max="1" step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-20 accent-sky-500"
            aria-label="Radar opacity"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-neutral-800 px-4 py-2 text-xs text-neutral-500">
        <span>{state.length} frames</span>
        {showAlerts && <span>{alertCount} active alerts</span>}
        <span className="flex items-center gap-2">
          {RISK_BANDS.map((band) => (
            <span key={band.label} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: band.color }} />
              {band.label}
            </span>
          ))}
        </span>
        {error && <span className="text-amber-400">{error}</span>}
      </div>
    </div>
  );
}
