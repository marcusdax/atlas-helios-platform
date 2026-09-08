import React, { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import { PageHeader, Card, AsyncState, Table, Button, Input, Select, Badge, money, Alert, when } from '../components/ui/kit';

const blankItem = () => ({ description: '', quantity: 1, unit: 'EA', unit_price: 0, category: 'roofing' });
const TONE = { draft: 'neutral', sent: 'warn', accepted: 'good', declined: 'bad', expired: 'bad' };

/**
 * Build an estimate from line items.
 *
 * The totals shown here are only a preview: the server recomputes them from the
 * items on write, in whole cents, so what the homeowner receives can never
 * disagree with the lines it was built from.
 */
export default function EstimateGenerator() {
  const [propertyId, setPropertyId] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [taxRate, setTaxRate] = useState(0.0825);

  const properties = useApi((signal) => api.properties.list({ limit: 100 }, signal), []);
  const estimates = useApi((signal) => api.estimates.list({ limit: 25 }, signal), []);
  const create = useAction((body) => api.estimates.create(body));
  const send = useAction((id) => api.estimates.send(id, {}));

  const preview = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
    const overhead = subtotal * 0.1;
    const profit = subtotal * 0.1;
    const tax = (subtotal + overhead + profit) * (Number(taxRate) || 0);
    return { subtotal, overhead, profit, tax, total: subtotal + overhead + profit + tax };
  }, [items, taxRate]);

  const setItem = (index, patch) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const submit = async (event) => {
    event.preventDefault();
    const usable = items.filter((i) => i.description.trim() && Number(i.unit_price) > 0);
    if (usable.length === 0) return;

    const created = await create.run({
      property_id: propertyId,
      line_items: usable.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
      tax_rate: Number(taxRate)
    });
    if (created) { setItems([blankItem()]); estimates.reload(); }
  };

  return (
    <div>
      <PageHeader
        title="Estimate Generator"
        subtitle="Line-item estimates with overhead, profit and tax derived server-side. A sent estimate is frozen — revise by creating a new one."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card title="New estimate">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="property" label="Property"
                value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
                options={[
                  { value: '', label: properties.loading ? 'Loading…' : 'Select a property' },
                  ...(properties.data?.data || []).map((p) => ({ value: p.id, label: `${p.address}, ${p.city}` }))
                ]}
              />
              <Input
                id="tax" label="Tax rate" type="number" step="0.0001" min="0" max="0.3"
                value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                hint="As a decimal, e.g. 0.0825"
              />
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_auto]">
                  <input
                    className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-neutral-100"
                    placeholder="Description" value={item.description}
                    onChange={(e) => setItem(index, { description: e.target.value })}
                    aria-label={`Line ${index + 1} description`}
                  />
                  <input
                    className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-neutral-100"
                    type="number" min="0" placeholder="Qty" value={item.quantity}
                    onChange={(e) => setItem(index, { quantity: e.target.value })}
                    aria-label={`Line ${index + 1} quantity`}
                  />
                  <input
                    className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-neutral-100"
                    type="number" min="0" step="0.01" placeholder="Unit $" value={item.unit_price}
                    onChange={(e) => setItem(index, { unit_price: e.target.value })}
                    aria-label={`Line ${index + 1} unit price`}
                  />
                  <button
                    type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== index))}
                    disabled={items.length === 1}
                    className="rounded-lg border border-neutral-700 px-2 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-40"
                    aria-label={`Remove line ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <Button tone="ghost" type="button" onClick={() => setItems((p) => [...p, blankItem()])}>
                Add line item
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm">
              {[['Subtotal', preview.subtotal], ['Overhead (10%)', preview.overhead],
                ['Profit (10%)', preview.profit], ['Tax', preview.tax]].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <dt className="text-neutral-400">{label}</dt>
                    <dd className="text-right text-neutral-200">{money(value)}</dd>
                  </React.Fragment>
                ))}
              <dt className="border-t border-neutral-800 pt-2 font-semibold text-neutral-200">Total</dt>
              <dd className="border-t border-neutral-800 pt-2 text-right font-semibold text-emerald-300">{money(preview.total)}</dd>
            </dl>
            <p className="text-xs text-neutral-500">Preview only — the server recomputes these figures on save.</p>

            <Button type="submit" busy={create.pending} disabled={!propertyId}>Create estimate</Button>
            {create.error && <Alert tone="error">{create.error.message}</Alert>}
          </form>
        </Card>

        <Card title="Recent estimates" actions={<Button tone="ghost" onClick={estimates.reload}>Refresh</Button>}>
          <AsyncState
            loading={estimates.loading} error={estimates.error}
            empty={!estimates.data?.data?.length}
            emptyMessage="No estimates yet."
          >
            <Table
              keyOf={(e) => e.id}
              rows={estimates.data?.data || []}
              columns={[
                { key: 'address', label: 'Property' },
                { key: 'total', label: 'Total', render: (e) => money(e.total ?? e.total_amount) },
                { key: 'status', label: 'Status', render: (e) => <Badge tone={TONE[e.status]}>{e.status}</Badge> },
                {
                  key: 'send', label: '',
                  render: (e) => e.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={async () => { if (await send.run(e.id)) estimates.reload(); }}
                      className="rounded border border-sky-500/40 px-2 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/10"
                    >
                      Send
                    </button>
                  ) : when(e.sent_at)
                }
              ]}
            />
            {send.error && <div className="mt-3"><Alert tone="error">{send.error.message}</Alert></div>}
          </AsyncState>
        </Card>
      </div>
    </div>
  );
}
