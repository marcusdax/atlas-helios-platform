import React, { useState } from 'react';
import { api } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import {
  PageHeader, Card, AsyncState, Table, Button, Select, TextArea,
  Alert, Badge, when
} from '../components/ui/kit';

const STATUS_TONE = { completed: 'good', processing: 'warn', pending: 'neutral', failed: 'bad', needs_review: 'warn' };

/**
 * Helios: start an AI assessment and review what came back.
 *
 * Photo analysis is asynchronous by design (a vision pass outlives a mobile
 * socket), so this screen submits and then reads from history rather than
 * blocking on a result.
 */
export default function PropertyAssessment() {
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState('exterior');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);

  const history = useApi((signal) => api.assessments.history({ limit: 25 }, signal), []);
  const properties = useApi((signal) => api.properties.list({ limit: 100 }, signal), []);
  const start = useAction((formData) => api.assessments.start(formData));

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData();
    form.append('property_id', propertyId);
    form.append('inspection_type', type);
    if (notes) form.append('notes', notes);
    files.forEach((file) => form.append('images', file));

    const result = await start.run(form);
    if (result) { setNotes(''); setFiles([]); history.reload(); }
  };

  return (
    <div>
      <PageHeader
        title="Property Assessment"
        subtitle="Run computer-vision damage analysis against inspection photos. Results are reviewed by an inspector before they drive an estimate."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card title="New assessment">
          <form onSubmit={submit} className="space-y-4">
            <Select
              id="property" label="Property"
              value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              options={[
                { value: '', label: properties.loading ? 'Loading…' : 'Select a property' },
                ...(properties.data?.data || []).map((p) => ({ value: p.id, label: `${p.address}, ${p.city}` }))
              ]}
            />
            <Select
              id="type" label="Inspection type"
              value={type} onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'exterior', label: 'Exterior' },
                { value: 'roof', label: 'Roof' },
                { value: 'storm_damage', label: 'Storm damage' },
                { value: 'full', label: 'Full' }
              ]}
            />
            <div>
              <label htmlFor="images" className="mb-1.5 block text-sm font-medium text-neutral-300">
                Inspection photos
              </label>
              <input
                id="images" type="file" multiple accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFiles([...e.target.files].slice(0, 12))}
                className="w-full text-sm text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-300"
              />
              <p className="mt-1 text-xs text-neutral-500">{files.length} selected · up to 12</p>
            </div>
            <TextArea
              id="notes" label="Field notes" rows={3} maxLength={2000}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Hail bruising on the south slope, gutter separation at the rear corner"
            />
            <Button type="submit" busy={start.pending} disabled={!propertyId}>Start assessment</Button>

            <div aria-live="polite" className="empty:hidden">
              {start.error && <Alert tone="error">{start.error.message}</Alert>}
              {start.data && (
                <Alert tone="success">
                  Queued. Photos are analysed in the background — this list updates when it completes.
                </Alert>
              )}
            </div>
          </form>
        </Card>

        <Card title="Assessment history" actions={<Button tone="ghost" onClick={history.reload}>Refresh</Button>}>
          <AsyncState
            loading={history.loading} error={history.error}
            empty={!history.data?.data?.length}
            emptyMessage="No assessments have been run yet."
          >
            <Table
              keyOf={(a) => a.id}
              rows={history.data?.data || []}
              columns={[
                { key: 'address', label: 'Property' },
                { key: 'assessment_type', label: 'Type' },
                { key: 'status', label: 'Status', render: (a) => <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge> },
                { key: 'damage_score', label: 'Damage', render: (a) => a.damage_score ?? '—' },
                { key: 'created_at', label: 'Started', render: (a) => when(a.created_at) }
              ]}
            />
          </AsyncState>
        </Card>
      </div>
    </div>
  );
}
