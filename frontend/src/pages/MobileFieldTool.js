import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import { PageHeader, Card, Button, TextArea, Alert, RiskBadge, AsyncState } from '../components/ui/kit';

/**
 * The field tool: one thumb-sized flow for a rep standing on a driveway.
 *
 * Two things it does that the desktop screens do not — take the device's GPS
 * to find the nearest property on file, and queue a submission that failed
 * because the truck drove through a dead zone. Losing an inspection because
 * LTE dropped is the failure that makes field staff stop using a tool.
 */
const QUEUE_KEY = 'atlas.field.queue';

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const writeQueue = (items) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* private mode */ }
};

export default function MobileFieldTool() {
  const [position, setPosition] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [propertyId, setPropertyId] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [queued, setQueued] = useState(readQueue());
  const [online, setOnline] = useState(navigator.onLine);
  const fileRef = useRef(null);

  const nearby = useApi(
    (signal) => position
      ? api.properties.list({ latitude: position.lat, longitude: position.lng, radius: 2, limit: 25 }, signal)
      : Promise.resolve({ data: [] }),
    [position?.lat, position?.lng]
  );

  const start = useAction((formData) => api.assessments.start(formData));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const locate = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('This device has no location service.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(err.message || 'Could not read your location.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!propertyId) return;

    if (!online) {
      // Files cannot be serialised to localStorage, so the queue records the
      // intent and the rep re-attaches photos when back in signal. Honest
      // about what it can and cannot hold, rather than silently dropping them.
      const next = [...queued, { property_id: propertyId, notes, photos: files.length, queued_at: Date.now() }];
      setQueued(next); writeQueue(next);
      setNotes(''); setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const form = new FormData();
    form.append('property_id', propertyId);
    form.append('inspection_type', 'storm_damage');
    if (notes) form.append('notes', notes);
    files.forEach((f) => form.append('images', f));

    if (await start.run(form)) {
      setNotes(''); setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearQueue = () => { setQueued([]); writeQueue([]); };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Field Tool"
        subtitle="Capture an inspection from the driveway. Works one-handed; queues the note if you lose signal."
      />

      {!online && (
        <div className="mb-4">
          <Alert tone="warn" title="Offline">
            Submissions are queued locally. Photos need re-attaching once you are back in signal.
          </Alert>
        </div>
      )}

      <Card title="1. Where are you">
        <Button tone="ghost" onClick={locate} className="w-full">Use my location</Button>
        {geoError && <div className="mt-3"><Alert tone="error">{geoError}</Alert></div>}
        {position && (
          <p className="mt-3 text-xs text-neutral-500">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        )}

        {position && (
          <div className="mt-4">
            <AsyncState
              loading={nearby.loading} error={nearby.error}
              empty={!nearby.data?.data?.length}
              emptyMessage="No properties on file within two miles."
            >
              <ul className="space-y-2">
                {(nearby.data?.data || []).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPropertyId(p.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition
                        ${propertyId === p.id
                          ? 'border-sky-500 bg-sky-500/10 text-neutral-100'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800'}`}
                    >
                      <span>
                        <span className="block font-medium">{p.address}</span>
                        <span className="block text-xs text-neutral-500">
                          {p.city} · {p.distance_miles != null ? `${p.distance_miles} mi` : ''}
                        </span>
                      </span>
                      <RiskBadge score={p.damage_probability} />
                    </button>
                  </li>
                ))}
              </ul>
            </AsyncState>
          </div>
        )}
      </Card>

      <div className="mt-4">
        <Card title="2. Capture">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="capture" className="mb-1.5 block text-sm font-medium text-neutral-300">Photos</label>
              <input
                id="capture" ref={fileRef} type="file" multiple accept="image/*" capture="environment"
                onChange={(e) => setFiles([...e.target.files].slice(0, 12))}
                className="w-full text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/15 file:px-3 file:py-3 file:text-sm file:font-semibold file:text-sky-300"
              />
              <p className="mt-1 text-xs text-neutral-500">{files.length} attached</p>
            </div>
            <TextArea
              id="field-notes" label="Notes" rows={3} maxLength={2000}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Hail bruising, 4 per test square, north slope"
            />
            <Button type="submit" busy={start.pending} disabled={!propertyId} className="w-full py-3">
              {online ? 'Submit inspection' : 'Queue inspection'}
            </Button>
            {start.error && <Alert tone="error">{start.error.message}</Alert>}
            {start.data && <Alert tone="success">Submitted. Analysis runs in the background.</Alert>}
          </form>
        </Card>
      </div>

      {queued.length > 0 && (
        <div className="mt-4">
          <Card title={`Queued (${queued.length})`} actions={<Button tone="ghost" onClick={clearQueue}>Clear</Button>}>
            <ul className="space-y-2 text-sm text-neutral-400">
              {queued.map((q, i) => (
                <li key={i} className="rounded border border-neutral-800 p-2">
                  <code className="text-xs">{q.property_id}</code> · {q.photos} photo(s) ·{' '}
                  {new Date(q.queued_at).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
