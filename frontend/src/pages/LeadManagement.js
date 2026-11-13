import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, messageFor } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import {
  PageHeader, Card, Button, Input, Select, TextArea, Field, control,
  AsyncState, Table, Badge, RiskBadge, Alert, money, when
} from '../components/ui/kit';

/**
 * The lead pipeline.
 *
 * This page used to render a hardcoded `mockLeads` array - two invented people
 * with invented phone numbers at Florida addresses, while the product's data is
 * in Texas - and creating a lead appended an object to that array with
 * `Math.floor(Math.random() * 40) + 60` as its score. A lead score drives who a
 * crew calls first, so a random one is worse than none: it is a real number,
 * shown with authority, meaning nothing.
 *
 * Three things the mock implied are not true of the real model, and the form
 * below is shaped by all three:
 *
 * - A lead belongs to a *property*. `property_id` is required by the API, which
 *   is why the form picks from real properties instead of taking a typed
 *   address. The address, city and risk shown in the table come from that join,
 *   so they cannot disagree with the property record.
 * - The score is computed server-side from the property's damage probability
 *   and the lead's own state. The client reads it and never invents it.
 * - `priority` did not exist. It had no column, no API field and no storage, so
 *   the value picked in the old form was discarded on the next read. It is gone
 *   rather than reimplemented, because the real ordering signal is the score.
 *
 * The old status list offered "converted", which the API rejects: the real
 * terminal states are won, lost and closed.
 */

/** The API's own enums. Kept here so an invalid value cannot reach it. */
const STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'closed'];
const SOURCES = ['storm_alert', 'canvass', 'referral', 'inbound', 'campaign'];

const STATUS_TONE = {
  new: 'info', contacted: 'warn', qualified: 'good',
  quoted: 'good', won: 'good', lost: 'bad', closed: 'neutral'
};

/** The one step forward from each state, or null where the pipeline ends. */
const NEXT = { new: 'contacted', contacted: 'qualified', qualified: 'quoted', quoted: 'won' };

const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ALL = 'all';
const asParam = (v) => (v === ALL ? undefined : v);

export default function LeadManagement() {
  const [filters, setFilters] = useState({ status: ALL, source: ALL, minScore: '' });
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const leads = useApi(
    (signal) => api.leads.list({
      status: asParam(filters.status),
      source: asParam(filters.source),
      min_score: filters.minScore === '' ? undefined : Number(filters.minScore),
      limit: 100
    }, signal),
    [filters.status, filters.source, filters.minScore]
  );

  // Needed by the create form, and only there. Loaded alongside rather than on
  // open so the picker is populated the moment the form appears.
  const properties = useApi((signal) => api.properties.list({ limit: 100 }, signal), []);

  // Memoised because `?? []` yields a fresh array on every render, which would
  // make the counts below recompute each time and defeat their useMemo.
  const rows = useMemo(() => leads.data?.data ?? [], [leads.data]);
  const propertyRows = useMemo(() => properties.data?.data ?? [], [properties.data]);

  const counts = useMemo(() => {
    const by = (s) => rows.filter((l) => l.status === s).length;
    return { total: leads.data?.meta?.total ?? rows.length, qualified: by('qualified'), contacted: by('contacted'), won: by('won') };
  }, [rows, leads.data]);

  const advance = useAction(async (lead) => {
    const next = NEXT[lead.status];
    if (!next) return undefined;
    const result = await api.leads.update(lead.id, { status: next });
    toast.success(`Lead moved to ${humanize(next)}`);
    leads.reload();
    if (selected?.id === lead.id) setSelected({ ...lead, status: next });
    return result;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Management"
        subtitle="Leads raised against tracked properties, scored by the API from each property's damage probability."
        actions={<Button onClick={() => setShowCreate(true)}>Add lead</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Total leads', counts.total],
          ['Contacted', counts.contacted],
          ['Qualified', counts.qualified],
          ['Won', counts.won]
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="text-2xl font-bold tabular-nums text-neutral-100">
              {leads.loading ? '—' : value}
            </div>
            <div className="text-sm text-neutral-400">{label}</div>
          </Card>
        ))}
      </div>

      <Card title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Select
            id="f-status" label="Status" value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            options={[{ value: ALL, label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: humanize(s) }))]}
          />
          <Select
            id="f-source" label="Source" value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            options={[{ value: ALL, label: 'All sources' }, ...SOURCES.map((s) => ({ value: s, label: humanize(s) }))]}
          />
          <Input
            id="f-score" label="Minimum score" type="number" min="0" max="100"
            placeholder="any" value={filters.minScore}
            onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
          />
          <div className="flex items-end">
            <Button tone="ghost" className="w-full"
              onClick={() => setFilters({ status: ALL, source: ALL, minScore: '' })}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Pipeline"
        actions={<Button tone="ghost" onClick={leads.reload} busy={leads.loading}>Refresh</Button>}
      >
        <AsyncState
          loading={leads.loading}
          error={leads.error}
          empty={rows.length === 0}
          emptyMessage="No leads match these filters."
        >
          <Table
            columns={[
              {
                key: 'contact',
                label: 'Contact',
                render: (l) => (
                  <div>
                    <div className="font-medium text-neutral-100">{l.contact_name || 'No contact name'}</div>
                    <div className="text-xs text-neutral-500">added {when(l.created_at)}</div>
                  </div>
                )
              },
              {
                key: 'reach',
                label: 'Reach',
                render: (l) => (
                  <div className="text-xs">
                    <div>{l.contact_email || '—'}</div>
                    <div className="text-neutral-500">{l.contact_phone || '—'}</div>
                  </div>
                )
              },
              {
                key: 'property',
                label: 'Property',
                render: (l) => (
                  <div className="text-xs">
                    <div className="text-neutral-200">{l.address || '—'}</div>
                    <div className="text-neutral-500">
                      {[l.city, l.state].filter(Boolean).join(', ') || '—'}
                      {l.estimated_value != null && ` · ${money(l.estimated_value)}`}
                    </div>
                  </div>
                )
              },
              { key: 'status', label: 'Status', render: (l) => <Badge tone={STATUS_TONE[l.status]}>{humanize(l.status)}</Badge> },
              { key: 'score', label: 'Score', render: (l) => <RiskBadge score={l.score} /> },
              { key: 'source', label: 'Source', render: (l) => <span className="text-xs text-neutral-400">{humanize(l.source)}</span> },
              {
                key: 'actions',
                label: '',
                render: (l) => (NEXT[l.status] ? (
                  <Button
                    tone="ghost"
                    busy={advance.pending}
                    onClick={(e) => { e.stopPropagation(); advance.run(l); }}
                  >
                    Mark {humanize(NEXT[l.status]).toLowerCase()}
                  </Button>
                ) : null)
              }
            ]}
            rows={rows}
            keyOf={(l) => l.id}
            onRowClick={setSelected}
          />
        </AsyncState>

        {advance.error && (
          <div className="mt-4"><Alert tone="error" title="Could not update that lead">{messageFor(advance.error)}</Alert></div>
        )}
      </Card>

      {selected && (
        <Card
          title="Lead detail"
          actions={<Button tone="ghost" onClick={() => setSelected(null)}>Close</Button>}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <dl className="space-y-2 text-sm">
              {[
                ['Contact', selected.contact_name || '—'],
                ['Email', selected.contact_email || '—'],
                ['Phone', selected.contact_phone || '—'],
                ['Source', humanize(selected.source)]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-neutral-400">{k}</dt>
                  <dd className="text-right text-neutral-100">{v}</dd>
                </div>
              ))}
            </dl>
            <dl className="space-y-2 text-sm">
              {[
                ['Address', selected.address || '—'],
                ['Damage probability', selected.damage_probability != null ? `${Math.round(selected.damage_probability)}%` : '—'],
                ['Property value', money(selected.estimated_value)],
                ['Last contact', when(selected.last_contact_attempt)]
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-neutral-400">{k}</dt>
                  <dd className="text-right text-neutral-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {selected.notes && (
            <p className="mt-4 whitespace-pre-wrap border-t border-neutral-800 pt-4 text-sm text-neutral-300">
              {selected.notes}
            </p>
          )}
        </Card>
      )}

      {showCreate && (
        <CreateLead
          properties={propertyRows}
          propertiesState={properties}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); leads.reload(); }}
        />
      )}
    </div>
  );
}

/**
 * The create form.
 *
 * Kept as its own component so its state dies with it: the old page held the
 * draft in the page body and hand-reset every field after a submit, which is
 * how a half-typed lead survived a cancel and reappeared next time.
 */
function CreateLead({ properties, propertiesState, onClose, onCreated }) {
  const [form, setForm] = useState({
    property_id: '', contact_name: '', contact_email: '', contact_phone: '',
    source: 'storm_alert', notes: ''
  });
  /** Set when the API reports an open lead already covers this property. */
  const [existing, setExisting] = useState(null);

  const create = useAction(async () => {
    const body = { property_id: form.property_id, source: form.source };
    // Only send what was filled in: the API validates an empty string as an
    // invalid email rather than treating it as absent.
    ['contact_name', 'contact_email', 'contact_phone', 'notes'].forEach((k) => {
      if (form[k].trim()) body[k] = form[k].trim();
    });
    const result = await api.leads.create(body);

    // The API keeps one open lead per property, so that two reps do not knock
    // on the same door. When one already exists it answers 200 with
    // `created: false` and hands back the existing lead instead of making a
    // second. That is a success at the HTTP level and a no-op at the business
    // level, so reporting it as "Lead created" would be the familiar lie: a
    // green toast, a closed dialog, and no new row anywhere.
    if (result?.meta?.created === false) {
      setExisting(result.data);
      return result;
    }

    toast.success('Lead created');
    onCreated();
    return result;
  });

  const set = (k) => (e) => {
    // The "already has an open lead" notice is about one property, so it stops
    // applying the moment a different one is chosen.
    if (k === 'property_id') setExisting(null);
    setForm({ ...form, [k]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-lead-title"
        className="w-full max-w-md overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-6"
        style={{ maxHeight: '90vh' }}>
        <h2 id="create-lead-title" className="mb-4 text-lg font-semibold text-neutral-100">Add lead</h2>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (!create.pending) create.run(); }}
        >
          <Field id="property" label="Property" hint="A lead is raised against a property already on file.">
            {propertiesState.loading ? (
              <p className="text-sm text-neutral-500">Loading properties…</p>
            ) : propertiesState.error ? (
              <Alert tone="error">{messageFor(propertiesState.error)}</Alert>
            ) : properties.length === 0 ? (
              <Alert tone="warn">No properties on file yet. Add one before raising a lead.</Alert>
            ) : (
              <select id="property" required className={control} value={form.property_id} onChange={set('property_id')}>
                <option value="">Select a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}{p.city ? `, ${p.city}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Input id="name" label="Contact name" value={form.contact_name} onChange={set('contact_name')} />
          <Input id="email" label="Email" type="email" value={form.contact_email} onChange={set('contact_email')} />
          <Input id="phone" label="Phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />

          <Select
            id="source" label="Source" value={form.source} onChange={set('source')}
            options={SOURCES.map((s) => ({ value: s, label: humanize(s) }))}
          />

          <TextArea id="notes" label="Notes" rows={3} value={form.notes} onChange={set('notes')} />

          {create.error && <Alert tone="error" title="Could not create the lead">{messageFor(create.error)}</Alert>}

          {existing && (
            <Alert tone="warn" title="That property already has an open lead">
              {existing.contact_name ? `It is held by "${existing.contact_name}" and is ` : 'It is '}
              currently <strong>{humanize(existing.status)}</strong>. Nothing was created — the API keeps one
              open lead per property so two reps do not work the same door. Close or win the existing lead
              first, or pick a different property.
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" busy={create.pending} disabled={!form.property_id}>
              Add lead
            </Button>
            <Button type="button" tone="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
