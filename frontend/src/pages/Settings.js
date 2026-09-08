import React, { useState } from 'react';
import { api } from '../lib/api';
import { useApi, useAction } from '../lib/useApi';
import { PageHeader, Card, AsyncState, Table, Button, Input, Alert, Badge } from '../components/ui/kit';

/**
 * Account, monitoring regions and the platform's own operational state.
 *
 * The health panel is here rather than hidden in an ops runbook because the
 * person who notices the radar has stopped updating is the dispatcher, not
 * whoever is on call.
 */
export default function Settings() {
  const [region, setRegion] = useState({ name: '', lat: '', lng: '', radius: 50 });

  const me = useApi((signal) => api.auth.me(signal), []);
  const regions = useApi((signal) => api.storms.regions(signal), []);
  const radarConfig = useApi((signal) => api.radar.config(signal), []);
  const track = useAction((body) => api.storms.track(body));

  const addRegion = async (event) => {
    event.preventDefault();
    const created = await track.run({
      name: region.name,
      center: { lat: Number(region.lat), lng: Number(region.lng) },
      radius: Number(region.radius)
    });
    if (created) { setRegion({ name: '', lat: '', lng: '', radius: 50 }); regions.reload(); }
  };

  const user = me.data?.data || me.data?.user || me.data;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account, storm monitoring regions, and the data sources behind the map." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <AsyncState loading={me.loading} error={me.error} empty={!user}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {[['Name', user?.name], ['Email', user?.email], ['Role', user?.role], ['Company', user?.company_id]]
                .map(([label, value]) => (
                  <React.Fragment key={label}>
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="text-neutral-200">{value || '—'}</dd>
                  </React.Fragment>
                ))}
            </dl>
          </AsyncState>
        </Card>

        <Card title="Map & data sources">
          <AsyncState loading={radarConfig.loading} error={radarConfig.error} empty={!radarConfig.data}>
            <ul className="space-y-2 text-sm text-neutral-300">
              {(radarConfig.data?.data?.providers || []).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded border border-neutral-800 p-2">
                  <span>{p.label}</span>
                  <Badge tone={p.animated ? 'good' : 'neutral'}>{p.animated ? 'animated' : 'latest only'}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              Radar and warning data are public NOAA/NWS feeds, proxied and cached by this server. No key required.
            </p>
          </AsyncState>
        </Card>

        <Card title="Monitoring regions" className="lg:col-span-2">
          <form onSubmit={addRegion} className="mb-5 grid gap-3 sm:grid-cols-[1fr_120px_120px_100px_auto] sm:items-end">
            <Input id="rname" label="Name" value={region.name}
              onChange={(e) => setRegion({ ...region, name: e.target.value })} placeholder="Dallas Metro" />
            <Input id="rlat" label="Latitude" value={region.lat}
              onChange={(e) => setRegion({ ...region, lat: e.target.value })} placeholder="32.7767" />
            <Input id="rlng" label="Longitude" value={region.lng}
              onChange={(e) => setRegion({ ...region, lng: e.target.value })} placeholder="-96.797" />
            <Input id="rrad" label="Radius (mi)" type="number" value={region.radius}
              onChange={(e) => setRegion({ ...region, radius: e.target.value })} />
            <Button type="submit" busy={track.pending} disabled={!region.name || !region.lat || !region.lng}>
              Add
            </Button>
          </form>
          {track.error && <div className="mb-4"><Alert tone="error">{track.error.message}</Alert></div>}

          <AsyncState
            loading={regions.loading} error={regions.error}
            empty={!regions.data?.data?.length}
            emptyMessage="No monitoring regions yet — Atlas polls weather only where you tell it to."
          >
            <Table
              keyOf={(r) => r.id}
              rows={regions.data?.data || []}
              columns={[
                { key: 'name', label: 'Region' },
                { key: 'radius', label: 'Radius', render: (r) => `${r.radius} mi` },
                { key: 'active', label: 'Status', render: (r) => <Badge tone={r.active ? 'good' : 'neutral'}>{r.active ? 'active' : 'paused'}</Badge> }
              ]}
            />
          </AsyncState>
        </Card>
      </div>
    </div>
  );
}
