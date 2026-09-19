import React, { useCallback, useState } from 'react';
import { AlterCompare, useAlterRender, useAlterIndustries } from '@alter/render-react';
import { renderer, prepareImage, isOfflineRenderer } from '../../lib/renderer';

/**
 * Alter Rendering Engine panel.
 *
 * This is a *composition* of the packages, not part of them. The engine, the
 * client, the hook and the slider are all reusable; the arrangement below,
 * with Atlas & Helios styling and Atlas & Helios copy, is not - and pretending
 * otherwise is how shared components end up with a dozen theme props nobody
 * can keep straight. Another platform imports the same four pieces and writes
 * its own hundred lines of layout.
 */

const ERROR_COPY = {
  INVALID_INPUT: 'That request could not be processed. Check the photo and description, then try again.',
  RATE_LIMITED: 'Render quota reached for now. Try again in a few minutes.',
  CIRCUIT_OPEN: 'The render provider is temporarily unavailable. We stopped sending requests so it can recover.',
  TIMEOUT: 'The render took too long. Try again, or use a smaller photo.',
  NOT_FOUND: 'That render is no longer available.'
};

export default function AlterRenderPanel({ defaultIndustry = 'roofing' }) {
  const [image, setImage] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState(defaultIndustry);

  const industries = useAlterIndustries(renderer);
  const { status, result, error, errorCode, isRendering, render, reset } = useAlterRender({ renderer });

  const onFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      setImage(await prepareImage(file));
      reset();
    } catch (err) {
      setFileError(err.message);
    }
  }, [reset]);

  const onSubmit = useCallback((event) => {
    event.preventDefault();
    render({ image, description, industry });
  }, [render, image, description, industry]);

  const canSubmit = Boolean(image) && description.trim().length > 0 && !isRendering;

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-5">
        <header>
          <h2 className="text-xl font-semibold text-neutral-100">Alter Rendering Engine</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Renders the improvement onto the property&apos;s own photograph. Camera angle, lighting
            and everything outside the work area are held fixed, so the homeowner is looking at
            their house rather than a showroom.
          </p>
          {isOfflineRenderer && (
            <p className="mt-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Offline mode: renders are synthetic placeholders, not model output.
            </p>
          )}
        </header>

        <div>
          <label htmlFor="alter-photo" className="mb-2 block text-sm font-medium text-neutral-300">
            Property photo
          </label>
          <input
            id="alter-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFile}
            className="w-full text-sm text-neutral-400 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-500/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-300 hover:file:bg-sky-500/25"
          />
          {fileError && <p className="mt-2 text-sm text-red-400">{fileError}</p>}
        </div>

        <div>
          <label htmlFor="alter-industry" className="mb-2 block text-sm font-medium text-neutral-300">
            Trade
          </label>
          <select
            id="alter-industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 focus:border-sky-500 focus:outline-none"
          >
            {industries.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="alter-description" className="mb-2 block text-sm font-medium text-neutral-300">
            What needs to change
          </label>
          <textarea
            id="alter-description"
            rows={4}
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hail bruising across the south slope, several tabs missing near the ridge"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-xs text-neutral-600">{description.length}/600</p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-sky-500 px-6 py-3 font-semibold text-neutral-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {isRendering ? 'Rendering…' : 'Render the improvement'}
        </button>

        {/* aria-live so the outcome reaches a screen reader without a focus move. */}
        <div aria-live="polite" className="min-h-[1.25rem]">
          {status === 'error' && (
            <p className="text-sm text-red-400">
              {ERROR_COPY[errorCode] || error?.message || 'The render failed. Please try again.'}
            </p>
          )}
          {result?.meta?.degraded && (
            <p className="text-sm text-amber-400">
              Rendered, but the copy generator was unavailable, so the text below is a template.
            </p>
          )}
        </div>
      </form>

      <div className="space-y-4">
        <AlterCompare
          before={image}
          after={result?.after}
          loading={isRendering}
          labelAfter="Alter render"
          className="w-full"
          style={{ '--alter-accent': '#38bdf8', '--alter-surface': '#0a0a0a' }}
        />

        {result?.copy && (
          <>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Marketing copy</h3>
              <p className="mt-2 font-medium text-neutral-100">{result.copy.headline}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{result.copy.body}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Return framing</h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-300">{result.copy.roi}</p>
              <p className="mt-3 text-xs text-neutral-600">
                Industry benchmark, not an appraisal or a quote for this property.
              </p>
            </div>
          </>
        )}

        {result && (
          <p className="text-xs text-neutral-600">
            {result.meta.provider} · {Math.round(result.meta.durationMs / 100) / 10}s
            {result.meta.cached ? ' · served from cache' : ''}
          </p>
        )}
      </div>
    </section>
  );
}
