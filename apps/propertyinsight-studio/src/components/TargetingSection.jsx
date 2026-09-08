import React, { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';
import { Alert, Button, Panel, Section, TextArea, TextInput } from './ui';

/** Latitude/longitude are the one place a typo silently produces a valid-looking map. */
function parseCoordinate(value, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > max) return null;
  return parsed;
}

export default function TargetingSection({ industry }) {
  const [lat, setLat] = useState('32.7767');
  const [lng, setLng] = useState('-96.7970');
  const [showMap, setShowMap] = useState(false);
  const [parameters, setParameters] = useState(
    'Detect degraded roof surfaces, identify missing shingles and moss growth.'
  );

  const visionParams = useAsyncAction((body, signal) => api.visionParams(body, signal));

  const coordinates = useMemo(() => {
    const latitude = parseCoordinate(lat, 90);
    const longitude = parseCoordinate(lng, 180);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }, [lat, lng]);

  // OpenStreetMap's embed takes a bounding box, not a centre and zoom.
  const mapUrl = useMemo(() => {
    if (!coordinates) return '';
    const { latitude, longitude } = coordinates;
    const offset = 0.005;
    const bbox = [longitude - offset, latitude - offset, longitude + offset, latitude + offset].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  }, [coordinates]);

  return (
    <Section
      id="targeting"
      kicker="Targeting"
      title="Geospatial screening"
      description="Locate a target area on open cartography, then sharpen the criteria used to screen its imagery. OpenStreetMap keeps this layer free of per-lookup licensing on a workflow that runs across whole neighbourhoods."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="1. Locate the area" description="Coordinates render an OpenStreetMap view with a marker.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              id="lat"
              label="Latitude"
              inputMode="decimal"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              placeholder="32.7767"
            />
            <TextInput
              id="lng"
              label="Longitude"
              inputMode="decimal"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
              placeholder="-96.7970"
            />
          </div>

          {!coordinates && (lat.trim() || lng.trim()) && (
            <Alert tone="error">
              Enter a latitude between −90 and 90 and a longitude between −180 and 180.
            </Alert>
          )}

          <Button tone="neutral" disabled={!coordinates} onClick={() => setShowMap(true)}>
            Load OpenStreetMap
          </Button>

          {showMap && mapUrl ? (
            <div className="h-72 overflow-hidden rounded-lg border border-slate-300">
              <iframe
                key={mapUrl}
                src={mapUrl}
                title={`Map centred on ${lat}, ${lng}`}
                className="h-full w-full"
                // The embed is third-party: sandbox it, and never send our URL
                // as a referrer to it.
                loading="lazy"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-popups"
              />
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
              <p className="px-6 text-center text-sm text-slate-400">
                Enter coordinates and load the map to preview the target area.
              </p>
            </div>
          )}
        </Panel>

        <Panel
          title="2. Sharpen the screening criteria"
          description="Turn a rough instruction into observable detection criteria — including the look-alikes a pass should not flag."
        >
          <TextArea
            id="vision-params"
            label="Screening parameters"
            rows={4}
            maxLength={600}
            counter
            value={parameters}
            onChange={(event) => setParameters(event.target.value)}
          />

          <Button
            busy={visionParams.isPending}
            busyLabel="Refining…"
            disabled={!parameters.trim()}
            onClick={() => visionParams.run({ industry, parameters })}
          >
            Refine criteria
          </Button>

          <div aria-live="polite" className="empty:hidden">
            {visionParams.errorMessage && <Alert tone="error">{visionParams.errorMessage}</Alert>}
            {!visionParams.errorMessage && visionParams.data && (
              <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
                <p className="text-sm font-semibold text-sky-900">Refined criteria</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {visionParams.data.parameters}
                </p>
                <button
                  type="button"
                  onClick={() => setParameters(visionParams.data.parameters.slice(0, 600))}
                  className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                >
                  Use as input
                </button>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </Section>
  );
}
