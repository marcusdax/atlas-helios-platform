import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, messageFor } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import {
  PageHeader, Card, Button, Input, TextArea, Field, control,
  AsyncState, Table, Badge, Alert, money, when
} from '../components/ui/kit';

/**
 * Estimates.
 *
 * The old page listed a hardcoded `mockEstimates` array and "created" an
 * estimate by pushing an object onto it, so every figure on screen was invented
 * and nothing survived a reload.
 *
 * The money is the part worth being careful about. The old form priced an
 * estimate in the browser as `subtotal + subtotal * (taxRate / 100) -
 * subtotal * (discountRate / 100)`, in floating point. The API prices in
 * integer cents, applies overhead and profit to the subtotal *before* tax, and
 * has no notion of a discount at all - so the number the old form showed could
 * not be produced by the server under any input.
 *
 * This page therefore does not compute a total. It previews the subtotal, which
 * is an unambiguous sum, and states which rates the server will apply; the
 * authoritative subtotal, overhead, profit, tax and total come back from the
 * save and are what the table shows. Reimplementing the server's rounding here
 * would mean two pricing engines that agree until the day they do not, and a
 * penny of disagreement on a roof estimate is what an adjuster queries.
 */

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'];
const CATEGORIES = ['roofing', 'siding', 'gutters', 'windows', 'interior', 'labor', 'materials', 'other'];

const STATUS_TONE = {
  draft: 'neutral', sent: 'info', viewed: 'info',
  accepted: 'good', declined: 'bad', expired: 'warn'
};

const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ALL = 'all';

export default function EstimateGenerator() {
  const [status, setStatus] = useState(ALL);
  const [showCreate, setShowCreate] = useState(false);

  const estimates = useApi(
    (signal) => api.estimates.list({ status: status === ALL ? undefined : status, limit: 100 }, signal),
    [status]
  );

  const rows = useMemo(() => estimates.data?.data ?? [], [estimates.data]);

  const totals = useMemo(() => ({
    count: estimates.data?.meta?.total ?? rows.length,
    draft: rows.filter((e) => e.status === 'draft').length,
    accepted: rows.filter((e) => e.status === 'accepted').length,
    // Only accepted work is money the company can count on, so the headline
    // figure is deliberately not the sum of every estimate ever drafted.
    acceptedValue: rows.filter((e) => e.status === 'accepted')
      .reduce((sum, e) => sum + (Number(e.total) || 0), 0)
  }), [rows, estimates.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        subtitle="Priced by the API in integer cents: overhead and profit are applied to the subtotal, then tax."
        actions={<Button onClick={() => setShowCreate(true)}>New estimate</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ['Estimates', estimates.loading ? '—' : totals.count],
          ['Draft', estimates.loading ? '—' : totals.draft],
          ['Accepted', estimates.loading ? '—' : totals.accepted],
          ['Accepted value', estimates.loading ? '—' : money(totals.acceptedValue)]
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="text-2xl font-bold tabular-nums text-neutral-100">{value}</div>
            <div className="text-sm text-neutral-400">{label}</div>
          </Card>
        ))}
      </div>

      <Card
        title="All estimates"
        actions={
          <div className="flex items-end gap-2">
            <select
              aria-label="Filter by status" className={control} value={status}
              onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}
            >
              <option value={ALL}>All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
            <Button tone="ghost" onClick={estimates.reload} busy={estimates.loading}>Refresh</Button>
          </div>
        }
      >
        <AsyncState
          loading={estimates.loading}
          error={estimates.error}
          empty={rows.length === 0}
          emptyMessage="No estimates yet."
        >
          <Table
            columns={[
              {
                key: 'title',
                label: 'Estimate',
                render: (e) => (
                  <div>
                    <div className="font-medium text-neutral-100">{e.title}</div>
                    <div className="text-xs text-neutral-500">created {when(e.created_at)}</div>
                  </div>
                )
              },
              {
                key: 'property',
                label: 'Property',
                render: (e) => (
                  <div className="text-xs">
                    <div className="text-neutral-200">{e.address || '—'}</div>
                    <div className="text-neutral-500">{[e.city, e.state].filter(Boolean).join(', ') || '—'}</div>
                  </div>
                )
              },
              { key: 'status', label: 'Status', render: (e) => <Badge tone={STATUS_TONE[e.status]}>{humanize(e.status)}</Badge> },
              { key: 'subtotal', label: 'Subtotal', render: (e) => <span className="tabular-nums">{money(e.subtotal)}</span> },
              { key: 'tax', label: 'Tax', render: (e) => <span className="tabular-nums">{money(e.tax)}</span> },
              {
                key: 'total',
                label: 'Total',
                render: (e) => <span className="font-semibold tabular-nums text-neutral-100">{money(e.total)}</span>
              },
              { key: 'valid_until', label: 'Valid until', render: (e) => <span className="text-xs">{when(e.valid_until)}</span> }
            ]}
            rows={rows}
            keyOf={(e) => e.id}
          />
        </AsyncState>
      </Card>

      {showCreate && (
        <CreateEstimate
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); estimates.reload(); }}
        />
      )}
    </div>
  );
}

/** A blank line, with the fields the API's lineItemSchema requires. */
const blankLine = () => ({
  key: Math.random().toString(36).slice(2),
  description: '', category: 'roofing', quantity: '', unit: 'EA', unit_price: ''
});

function CreateEstimate({ onClose, onCreated }) {
  const properties = useApi((signal) => api.properties.list({ limit: 100 }, signal), []);
  const propertyRows = useMemo(() => properties.data?.data ?? [], [properties.data]);

  const [form, setForm] = useState({
    property_id: '',
    title: 'Property Restoration Estimate',
    // Percentages in the UI because that is how a user thinks about them;
    // converted to the fractions the API validates (tax <= 0.3, the others
    // <= 0.5) at the point of submit, once.
    taxPct: '8.25', overheadPct: '10', profitPct: '10',
    notes: ''
  });
  const [lines, setLines] = useState([blankLine()]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const setLine = (key, field) => (e) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: e.target.value } : l)));

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );

  const usable = lines.filter((l) => l.description.trim() && Number(l.quantity) > 0 && l.unit_price !== '');

  const create = useAction(async () => {
    const result = await api.estimates.create({
      property_id: form.property_id,
      title: form.title.trim() || undefined,
      line_items: usable.map((l) => ({
        description: l.description.trim(),
        category: l.category,
        quantity: Number(l.quantity),
        unit: l.unit.trim() || 'EA',
        unit_price: Number(l.unit_price)
      })),
      tax_rate: (Number(form.taxPct) || 0) / 100,
      overhead_rate: (Number(form.overheadPct) || 0) / 100,
      profit_rate: (Number(form.profitPct) || 0) / 100,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {})
    });
    toast.success('Estimate created');
    onCreated();
    return result;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-estimate-title"
        className="my-8 w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 id="create-estimate-title" className="mb-4 text-lg font-semibold text-neutral-100">New estimate</h2>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (!create.pending) create.run(); }}
        >
          <Field id="est-property" label="Property">
            {properties.loading ? (
              <p className="text-sm text-neutral-500">Loading properties…</p>
            ) : properties.error ? (
              <Alert tone="error">{messageFor(properties.error)}</Alert>
            ) : propertyRows.length === 0 ? (
              <Alert tone="warn">No properties on file yet.</Alert>
            ) : (
              <select id="est-property" required className={control} value={form.property_id} onChange={set('property_id')}>
                <option value="">Select a property…</option>
                {propertyRows.map((p) => (
                  <option key={p.id} value={p.id}>{p.address}{p.city ? `, ${p.city}` : ''}</option>
                ))}
              </select>
            )}
          </Field>

          <Input id="est-title" label="Title" value={form.title} onChange={set('title')} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-300">Line items</span>
              <Button type="button" tone="ghost" onClick={() => setLines((p) => [...p, blankLine()])}>
                Add line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.key} className="rounded-lg border border-neutral-800 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-12">
                      <input
                        aria-label="Description" className={control} placeholder="Description"
                        value={l.description} onChange={setLine(l.key, 'description')}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select aria-label="Category" className={control} value={l.category} onChange={setLine(l.key, 'category')}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        aria-label="Quantity" className={control} type="number" min="0" step="any"
                        placeholder="Qty" value={l.quantity} onChange={setLine(l.key, 'quantity')}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        aria-label="Unit" className={control} placeholder="EA"
                        value={l.unit} onChange={setLine(l.key, 'unit')}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        aria-label="Unit price" className={control} type="number" min="0" step="0.01"
                        placeholder="Unit price" value={l.unit_price} onChange={setLine(l.key, 'unit_price')}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                    <span className="tabular-nums">
                      {money((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}
                    </span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input id="est-tax" label="Tax %" type="number" min="0" max="30" step="0.01"
              value={form.taxPct} onChange={set('taxPct')} />
            <Input id="est-overhead" label="Overhead %" type="number" min="0" max="50" step="0.01"
              value={form.overheadPct} onChange={set('overheadPct')} />
            <Input id="est-profit" label="Profit %" type="number" min="0" max="50" step="0.01"
              value={form.profitPct} onChange={set('profitPct')} />
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Subtotal of {usable.length} line{usable.length === 1 ? '' : 's'}</span>
              <span className="font-semibold tabular-nums text-neutral-100">{money(subtotal)}</span>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Overhead, profit and tax are applied by the server when this is saved, in integer cents.
              The final total comes back from that save rather than being guessed here.
            </p>
          </div>

          <TextArea id="est-notes" label="Notes" rows={3} value={form.notes} onChange={set('notes')} />

          {create.error && <Alert tone="error" title="Could not create the estimate">{messageFor(create.error)}</Alert>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" busy={create.pending}
              disabled={!form.property_id || usable.length === 0}>
              Create estimate
            </Button>
            <Button type="button" tone="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
          {usable.length === 0 && (
            <p className="text-xs text-neutral-500">
              At least one line needs a description, a quantity above zero and a unit price.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
