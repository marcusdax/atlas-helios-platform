import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, messageFor } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import {
  PageHeader, Card, Button, Select, TextArea, Field, control, Alert, Badge
} from '../components/ui/kit';

/**
 * The field capture tool.
 *
 * This page made three claims that were not true, and the first one could cost
 * someone their work.
 *
 * 1. **"All data synced successfully."** `handleSync` waited two seconds on a
 *    `setTimeout`, set `synced: true` on every photo and showed that message.
 *    Nothing was uploaded. A technician standing in a hailed-out street, told
 *    their photos were safe on the server, has every reason to clear their
 *    phone — and the evidence for a claim would be gone. There is no
 *    incremental sync endpoint to call, so the button is not reimplemented: it
 *    is replaced by a submit that really uploads, and a status that only says
 *    "uploaded" after the API has said so.
 * 2. **"Voice note recorded."** The handler asked for microphone permission,
 *    stopped the stream immediately, waited three seconds and appended
 *    "[Voice note recorded]" to the notes. No audio was ever captured, and the
 *    assessment then carried a note asserting a recording existed. Removed
 *    rather than stubbed; there is no endpoint that accepts audio.
 * 3. **A saved assessment.** `handleSaveAssessment` ended at `console.log`.
 *
 * What the API actually offers is one multipart call: a property, an inspection
 * type, notes and up to twelve images, answered 202 because the damage analysis
 * runs out of band. The form is shaped to that.
 *
 * Known limitation, stated on the page rather than papered over: captures live
 * in this tab until submitted. There is no durable offline queue — building one
 * means IndexedDB and a retry policy, which is a feature, not a detail — so the
 * page says so instead of implying otherwise.
 */

const INSPECTION_TYPES = ['exterior', 'roof', 'full', 'storm_damage'];

/** Mirrors the API's multer fileFilter, so a doomed upload is caught here. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILES = 12;
const MAX_BYTES = 15 * 1024 * 1024;

const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function MobileFieldTool() {
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [inspectionType, setInspectionType] = useState('storm_damage');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [submitted, setSubmitted] = useState(null);

  const fileInput = useRef(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const properties = useApi((signal) => api.properties.list({ limit: 100 }, signal), []);
  const propertyRows = useMemo(() => properties.data?.data ?? [], [properties.data]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('This device reports no location support.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      // Location is useful context, not a requirement, so a refusal is reported
      // quietly and the capture still works.
      (err) => setLocationError(err.message || 'Location unavailable.')
    );
  }, []);

  // Object URLs are revoked on unmount; the old page created one per photo and
  // never released any, so a long shift leaked every image it had previewed.
  useEffect(() => () => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  const addPhotos = (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const room = MAX_FILES - photos.length;
    const rejected = [];
    const accepted = [];

    picked.forEach((file) => {
      if (!ACCEPTED.includes(file.type)) { rejected.push(`${file.name}: ${file.type || 'unknown type'} is not accepted`); return; }
      if (file.size > MAX_BYTES) { rejected.push(`${file.name}: over 15 MB`); return; }
      if (accepted.length >= room) { rejected.push(`${file.name}: over the ${MAX_FILES}-photo limit`); return; }
      accepted.push({ key: `${file.name}-${file.lastModified}-${file.size}`, file, url: URL.createObjectURL(file) });
    });

    if (accepted.length) setPhotos((prev) => [...prev, ...accepted]);
    // Rejections are named individually: "some photos could not be added" sends
    // someone back to the property to re-shoot the wrong ones.
    rejected.forEach((r) => toast.error(r));
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (key) => setPhotos((prev) => {
    const found = prev.find((p) => p.key === key);
    if (found) URL.revokeObjectURL(found.url);
    return prev.filter((p) => p.key !== key);
  });

  const submit = useAction(async () => {
    const body = new FormData();
    body.append('property_id', propertyId);
    body.append('inspection_type', inspectionType);

    // Location rides along in the notes because the API has no coordinate
    // field on an assessment; putting it somewhere it is not stored would be
    // the same class of lie this page is being rid of.
    const trimmed = notes.trim();
    const stamp = location
      ? `GPS at capture: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} (±${Math.round(location.accuracy)}m)`
      : null;
    const composed = [trimmed, stamp].filter(Boolean).join('\n\n');
    if (composed) body.append('notes', composed.slice(0, 2000));

    photos.forEach((p) => body.append('images', p.file, p.file.name));

    const result = await api.assessments.start(body);
    const queued = result?.meta?.images_queued ?? 0;

    setSubmitted({ id: result?.data?.id, queued });
    toast.success(queued ? `Assessment submitted, ${queued} photo${queued === 1 ? '' : 's'} uploaded` : 'Assessment submitted');

    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setNotes('');
    return result;
  });

  const canSubmit = Boolean(propertyId) && online && !submit.pending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Capture"
        subtitle="Record an on-site assessment and upload its photos in one submission."
        actions={
          <Badge tone={online ? 'good' : 'bad'}>{online ? 'Online' : 'Offline'}</Badge>
        }
      />

      {!online && (
        <Alert tone="warn" title="This device is offline">
          Captures are held in this tab and cannot be submitted until the connection returns.
          Keep the tab open: nothing here is stored on the device.
        </Alert>
      )}

      {submitted && (
        <Alert tone="success" title="Assessment submitted">
          {submitted.queued > 0
            ? `${submitted.queued} photo${submitted.queued === 1 ? '' : 's'} uploaded. Damage analysis runs on the server and the result appears under assessment history.`
            : 'No photos were attached. Damage analysis runs on the server once photos are added.'}
        </Alert>
      )}

      <Card title="Property">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="fc-property" label="Property" hint="An assessment is recorded against a property already on file.">
            {properties.loading ? (
              <p className="text-sm text-neutral-500">Loading properties…</p>
            ) : properties.error ? (
              <Alert tone="error">{messageFor(properties.error)}</Alert>
            ) : propertyRows.length === 0 ? (
              <Alert tone="warn">No properties on file yet.</Alert>
            ) : (
              <select id="fc-property" className={control} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Select a property…</option>
                {propertyRows.map((p) => (
                  <option key={p.id} value={p.id}>{p.address}{p.city ? `, ${p.city}` : ''}</option>
                ))}
              </select>
            )}
          </Field>

          <Select
            id="fc-type" label="Inspection type" value={inspectionType}
            onChange={(e) => setInspectionType(e.target.value)}
            options={INSPECTION_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
          />
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          {location
            ? `Location captured: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} (±${Math.round(location.accuracy)}m). It is recorded in the notes.`
            : locationError
              ? `No location: ${locationError}`
              : 'Requesting location…'}
        </p>
      </Card>

      <Card
        title={`Photos (${photos.length}/${MAX_FILES})`}
        actions={
          <Button
            tone="ghost" type="button"
            onClick={() => fileInput.current?.click()}
            disabled={photos.length >= MAX_FILES}
          >
            Add photos
          </Button>
        }
      >
        <input
          ref={fileInput} type="file" accept={ACCEPTED.join(',')} multiple capture="environment"
          onChange={addPhotos} className="hidden"
        />

        {photos.length === 0 ? (
          <p className="py-6 text-sm text-neutral-500">
            No photos yet. JPEG, PNG, WebP or HEIC, up to 15 MB each.
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <li key={p.key} className="overflow-hidden rounded-lg border border-neutral-800">
                  <img src={p.url} alt={p.file.name} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="truncate text-xs text-neutral-400" title={p.file.name}>
                      {(p.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button" onClick={() => removePhoto(p.key)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              Held in this tab only. They reach the server when you submit below — there is no
              background upload, and closing the tab loses them.
            </p>
          </>
        )}
      </Card>

      <Card title="Notes">
        <TextArea
          id="fc-notes" rows={5} value={notes} maxLength={1800}
          placeholder="What you can see: damage, access, anything the office needs to know."
          onChange={(e) => setNotes(e.target.value)}
          label="" hint={`${notes.length}/1800 characters`}
        />
      </Card>

      {submit.error && (
        <Alert tone="error" title="Submission failed — nothing was uploaded">
          {messageFor(submit.error)} Your photos and notes are still here; try again.
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submit.run()} busy={submit.pending} disabled={!canSubmit}>
          {submit.pending ? 'Uploading…' : `Submit assessment${photos.length ? ` with ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}`}
        </Button>
        {!propertyId && <p className="self-center text-xs text-neutral-500">Select a property to submit.</p>}
      </div>
    </div>
  );
}
