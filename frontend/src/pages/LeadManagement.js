import React, { useState } from 'react';
import { api } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import { PageHeader, Card, AsyncState, Table, Button, Badge, RiskBadge, money, Alert } from '../components/ui/kit';

const STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'closed'];
const TONE = { won: 'good', lost: 'bad', closed: 'neutral', new: 'warn' };

/**
 * The pipeline, ordered by score rather than by date.
 *
 * Lead score is computed server-side on every read, so changing the weighting
 * re-ranks the whole book instead of only leads created after the change.
 */
export default function LeadManagement() {
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');

  const leads = useApi(
    (signal) => api.leads.list({ status: status || undefined, min_score: minScore || undefined, limit: 100 }, signal),
    [status, minScore]
  );
  const update = useAction((id, body) => api.leads.update(id, body));
  const exportCsv = useAction(() => api.leads.exportCsv({ status: status || 'new', format: 'csv' }));

  const advance = async (lead, next) => {
    const done = await update.run(lead.id, { status: next });
    if (done) leads.reload();
  };

  return (
    <div>
      <PageHeader
        title="Lead Management"
        subtitle="Storm-generated prospects, ranked by damage, property value and recency. Fresh damage outranks a bigger house."
        actions={<Button tone="ghost" busy={exportCsv.pending} onClick={() => exportCsv.run()}>Export CSV</Button>}
      />

      <Card
        title="Pipeline"
        actions={
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={minScore} onChange={(e) => setMinScore(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200">
              <option value="">Any score</option>
              <option value="50">50+</option>
              <option value="70">70+</option>
              <option value="85">85+</option>
            </select>
          </div>
        }
      >
        {exportCsv.error && <div className="mb-3"><Alert tone="error">{exportCsv.error.message}</Alert></div>}

        <AsyncState
          loading={leads.loading} error={leads.error}
          empty={!leads.data?.data?.length}
          emptyMessage="No leads match this filter."
        >
          <Table
            keyOf={(l) => l.id}
            rows={leads.data?.data || []}
            columns={[
              { key: 'score', label: 'Score', render: (l) => <RiskBadge score={l.score} /> },
              { key: 'address', label: 'Property', render: (l) => `${l.address || '—'}, ${l.city || ''}` },
              { key: 'estimated_value', label: 'Value', render: (l) => money(l.estimated_value) },
              { key: 'source', label: 'Source' },
              { key: 'status', label: 'Status', render: (l) => <Badge tone={TONE[l.status]}>{l.status}</Badge> },
              {
                key: 'actions',
                label: '',
                render: (l) => (
                  <select
                    value={l.status}
                    onChange={(e) => advance(l, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-xs text-neutral-200"
                    aria-label={`Change status for ${l.address}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )
              }
            ]}
          />
        </AsyncState>
      </Card>
    </div>
  );
}
