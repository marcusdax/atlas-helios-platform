import React, { useMemo, useState } from 'react';
import RadarMap from '../components/maps/RadarMap';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import { PageHeader, Card, AsyncState, Table, Badge, RiskBadge, Button } from '../components/ui/kit';

const SEVERITY_TONE = { extreme: 'bad', high: 'bad', moderate: 'warn', low: 'neutral' };

/**
 * Atlas: the live storm picture crossed with this company's exposure.
 *
 * The map and the exposure table are the same question asked two ways, so they
 * share one property list: whatever is plotted is what is listed.
 */
export default function StormIntelligence() {
  const [selected, setSelected] = useState(null);

  const storms = useApi((signal) => api.storms.list({ status: 'active', limit: 50 }, signal), []);
  const exposure = useApi((signal) => api.radar.exposure({ actionable: true }, signal), []);

  const exposedProperties = useMemo(() => exposure.data?.data || [], [exposure.data]);

  return (
    <div>
      <PageHeader
        title="Storm Intelligence"
        subtitle="Live NOAA radar and active NWS warning polygons, crossed with your properties. Scrub the last two hours to see where a cell actually tracked."
        actions={<Button tone="ghost" onClick={() => { storms.reload(); exposure.reload(); }}>Refresh</Button>}
      />

      <div className="mb-6">
        <RadarMap
          properties={exposedProperties}
          onPropertyClick={setSelected}
          height={560}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Active storm events">
          <AsyncState
            loading={storms.loading}
            error={storms.error}
            empty={!storms.data?.data?.length}
            emptyMessage="No active storm events are being tracked right now."
          >
            <Table
              keyOf={(s) => s.id}
              rows={storms.data?.data || []}
              columns={[
                { key: 'region_name', label: 'Region' },
                { key: 'storm_type', label: 'Type', render: (s) => s.event_type || s.storm_type || '—' },
                {
                  key: 'severity',
                  label: 'Severity',
                  render: (s) => <Badge tone={SEVERITY_TONE[s.severity] || 'neutral'}>{s.severity}</Badge>
                },
                { key: 'affected_properties', label: 'Exposed', render: (s) => s.affected_properties ?? 0 }
              ]}
            />
          </AsyncState>
        </Card>

        <Card
          title="Properties inside an active warning"
          actions={exposure.data?.meta && (
            <span className="text-xs text-neutral-500">
              {exposure.data.meta.properties_exposed} of {exposure.data.meta.properties_checked}
            </span>
          )}
        >
          <AsyncState
            loading={exposure.loading}
            error={exposure.error}
            empty={exposedProperties.length === 0}
            emptyMessage="None of your properties are inside an active warning polygon."
          >
            <Table
              keyOf={(p) => p.id}
              rows={exposedProperties.slice(0, 50)}
              onRowClick={(p) => setSelected(p.id)}
              columns={[
                { key: 'address', label: 'Address' },
                { key: 'worst_alert', label: 'Alert', render: (p) => p.worst_alert?.event || '—' },
                { key: 'damage_probability', label: 'Risk', render: (p) => <RiskBadge score={p.damage_probability} /> }
              ]}
            />
          </AsyncState>
          {selected && (
            <p className="mt-3 text-xs text-neutral-500">Selected property: <code>{selected}</code></p>
          )}
        </Card>
      </div>
    </div>
  );
}
