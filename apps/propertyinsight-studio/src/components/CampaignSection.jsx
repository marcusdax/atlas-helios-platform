import React, { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';
import { Alert, Button, Panel, Section, TextArea, TextInput } from './ui';

const MAX_ADDRESSES = 50;

/**
 * Per-address campaign collateral.
 *
 * One change worth flagging against the template: there, the model was asked to
 * invent the one-pager URLs, which yields links that look plausible and resolve
 * to nothing — the kind of thing that only surfaces after it is printed on a
 * door hanger. Here the server derives each slug deterministically from the
 * address, so the same address always produces the same link and every link is
 * one this app can actually serve.
 */
export default function CampaignSection({ industry }) {
  const [neighborhood, setNeighborhood] = useState('Lakewood Heights');
  const [bounds, setBounds] = useState('Bounded by Abrams Rd, Gaston Ave and La Vista Dr');
  const [addressList, setAddressList] = useState('123 Main St\n456 Oak Ave\n789 Pine Ln');

  const campaign = useAsyncAction((body, signal) => api.campaign(body, signal));

  const addresses = useMemo(
    () => addressList.split('\n').map((line) => line.trim()).filter(Boolean),
    [addressList]
  );

  const overLimit = addresses.length > MAX_ADDRESSES;

  return (
    <Section
      id="campaign"
      kicker="Campaign"
      title="Neighbourhood one-pagers"
      description="Define the target area, then generate a personalized one-pager per address. Links are derived from the address itself, so a re-run never invalidates collateral already in the field."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="1. Define the area">
          <TextInput
            id="neighborhood"
            label="Neighbourhood name"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="e.g. Springfield Heights"
          />
          <TextArea
            id="bounds"
            label="Boundary description"
            rows={2}
            maxLength={300}
            value={bounds}
            onChange={(event) => setBounds(event.target.value)}
            placeholder="e.g. Bounded by Elm St, Oak Ave and Maple Ln"
            hint="Free text. It gives the copy local specificity; it is not a geofence."
          />
        </Panel>

        <Panel title="2. Addresses">
          <TextArea
            id="addresses"
            label="One address per line"
            rows={6}
            value={addressList}
            onChange={(event) => setAddressList(event.target.value)}
            placeholder={'123 Main St\n456 Oak Ave\n789 Pine Ln'}
            hint={`${addresses.length} address${addresses.length === 1 ? '' : 'es'} · limit ${MAX_ADDRESSES} per run`}
          />

          {overLimit && (
            <Alert tone="warn">
              Only the first {MAX_ADDRESSES} addresses will be processed. Split larger lists into separate runs.
            </Alert>
          )}

          <Button
            busy={campaign.isPending}
            busyLabel="Generating…"
            disabled={addresses.length === 0 || !neighborhood.trim()}
            onClick={() => campaign.run({ industry, neighborhood, bounds, addresses })}
          >
            Generate one-pagers
          </Button>

          <div aria-live="polite" className="empty:hidden">
            {campaign.errorMessage && <Alert tone="error">{campaign.errorMessage}</Alert>}
          </div>
        </Panel>
      </div>

      {campaign.data?.onePagers?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {/* Wide content scrolls inside its own container so the page body
              never scrolls horizontally on a phone. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                Generated one-pagers for {campaign.data.neighborhood}
              </caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Address</th>
                  <th scope="col" className="px-4 py-3 font-semibold">One-pager</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Content summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaign.data.onePagers.map((pager) => (
                  <tr key={pager.slug} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{pager.address}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                        {pager.url || `/c/${pager.slug}`}
                      </code>
                    </td>
                    <td className="px-4 py-3 leading-relaxed text-slate-600">{pager.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
