import React, { useCallback, useState } from 'react';
import { AlterCompare, useAlterRender } from '@alter/render-react';
import { renderer, api, messageFor } from '../lib/api';
import { prepareImage } from '../lib/image';
import { useAsyncAction } from '../lib/useAsyncAction';
import { Alert, Button, Panel, Section, Select, TextArea } from './ui';

/**
 * The render studio - the part of the template whose engine was replaced.
 *
 * What changed underneath: the component no longer knows what a model vendor
 * is. It calls `renderer.render()`, which is an @alter/render-core HTTP client
 * pointed at this app's own API. The key, the prompt guardrails, the retries,
 * the idempotency cache and the circuit breaker all live server-side now.
 *
 * What that buys, visible right here: `meta.cached` means a repeated render
 * cost nothing, `meta.degraded` means the copy fell back but the image is real,
 * and an unmounted or superseded render is aborted rather than paid for.
 */
export default function RenderStudio({ industries, industry, onIndustryChange }) {
  const [image, setImage] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Dallas, TX');

  const { result, isRendering, error, render, reset } = useAlterRender({ renderer });
  const market = useAsyncAction((body, signal) => api.market(body, signal));

  const onFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      setImage(await prepareImage(file));
      reset();
      market.reset();
    } catch (err) {
      setFileError(err.message);
      setImage(null);
    }
  }, [reset, market]);

  const canRender = Boolean(image) && description.trim().length > 0 && !isRendering;

  const roi = result?.copy?.roi || '';
  const industryLabel = industries.find((i) => i.id === industry)?.label || industry;

  return (
    <Section
      id="render"
      kicker="Alter rendering engine"
      title="Property improvement visualization"
      description="The improvement is rendered onto the property's own photograph. Camera angle, lighting, shadow direction and everything outside the work area are held fixed, so the homeowner is looking at their house rather than a showroom."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- inputs ---- */}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            render({ image, description, industry });
          }}
        >
          <Panel title="1. The property">
            <div>
              <label htmlFor="photo" className="mb-1.5 block text-sm font-medium text-slate-700">
                Property photo
              </label>
              <input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFile}
                className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Large photos are downscaled to 1600px in the browser, which also strips EXIF location data.
              </p>
              {fileError && <div className="mt-2"><Alert tone="error">{fileError}</Alert></div>}
            </div>

            <Select
              id="industry"
              label="Trade"
              value={industry}
              onChange={(event) => onIndustryChange(event.target.value)}
              options={industries}
              hint="Each trade constrains which surfaces the render is allowed to change."
            />

            <TextArea
              id="description"
              label="What needs to change"
              rows={4}
              maxLength={600}
              counter
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Hail bruising across the south slope, several tabs missing near the ridge"
            />

            <Button type="submit" disabled={!canRender} busy={isRendering} busyLabel="Rendering…">
              Render the improvement
            </Button>

            <div aria-live="polite" className="empty:hidden">
              {error && <Alert tone="error">{messageFor(error)}</Alert>}
            </div>
          </Panel>
        </form>

        {/* ---- output ---- */}
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <h3 className="text-base font-semibold text-slate-800">Before / after</h3>
            {result && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                {result.meta.cached ? 'Cached' : 'Render complete'}
              </span>
            )}
          </div>

          <AlterCompare
            before={image}
            after={result?.after}
            loading={isRendering}
            labelAfter="Alter render"
            className="w-full"
            style={{
              '--alter-accent': '#4f46e5',
              // Indigo-600 is dark, so the render label needs light text on it;
              // the element's default suits its own lighter default accent.
              '--alter-label-accent-fg': '#ffffff',
              '--alter-surface': '#0f172a',
              '--alter-radius': '12px'
            }}
          />
          <p className="text-xs text-slate-500">
            Drag the seam, or focus it and use the arrow keys. Double-click to recentre.
          </p>

          {result?.meta?.degraded && (
            <Alert tone="warn" title="Copy generator unavailable">
              The image is a real render; the text below fell back to a template.
            </Alert>
          )}

          {result?.copy && (
            <Panel title="Personalized marketing copy">
              <p className="font-medium text-slate-900">{result.copy.headline}</p>
              <p className="text-sm leading-relaxed text-slate-600">{result.copy.body}</p>
            </Panel>
          )}

          <Panel
            title="Return framing & market context"
            description="Industry cost-vs-value benchmarks, then how this specific market would support or temper them."
          >
            {roi
              ? <p className="text-sm font-medium leading-relaxed text-emerald-700">{roi}</p>
              : <p className="text-sm text-slate-500">Render an improvement to generate return framing.</p>}

            <div className="space-y-3">
              <label htmlFor="market-location" className="block text-sm font-medium text-slate-700">
                Market for context
              </label>
              <input
                id="market-location"
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="e.g. Dallas, TX"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <Button
                tone="violet"
                busy={market.isPending}
                busyLabel="Analyzing…"
                disabled={!location.trim()}
                onClick={() => market.run({ industry, location, roi })}
              >
                Analyze this market
              </Button>
            </div>

            <div aria-live="polite" className="empty:hidden">
              {market.errorMessage && <Alert tone="error">{market.errorMessage}</Alert>}
              {!market.errorMessage && market.data && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-800">
                  <p className="whitespace-pre-wrap leading-relaxed">{market.data.analysis}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500">
              General market context for {industryLabel.toLowerCase()} — not an appraisal, and not a quote for this property.
            </p>
          </Panel>

          {result && (
            <p className="text-xs text-slate-400">
              {result.meta.provider} · {(result.meta.durationMs / 1000).toFixed(1)}s
              {result.meta.cached ? ' · served from cache, no provider call' : ''}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
