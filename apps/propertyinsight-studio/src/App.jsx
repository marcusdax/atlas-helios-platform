import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAlterIndustries } from '@alter/render-react';
import { renderer, api } from './lib/api';
import RenderStudio from './components/RenderStudio';
import SuggestionsSection from './components/SuggestionsSection';
import TargetingSection from './components/TargetingSection';
import CampaignSection from './components/CampaignSection';
import InfoModal from './components/InfoModal';
import { Alert } from './components/ui';

const NAV = [
  ['render', 'Render'],
  ['suggestions', 'Discovery'],
  ['targeting', 'Targeting'],
  ['campaign', 'Campaign']
];

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [industry, setIndustry] = useState('roofing');
  const [offline, setOffline] = useState(false);

  // Presets come from the server so a trade registered there with
  // defineIndustry() appears here without a client change.
  const industries = useAlterIndustries(renderer);
  const renderStudioRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    api.status(controller.signal)
      .then((status) => setOffline(Boolean(status?.offline)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // A suggestion is only useful if it lands where the render happens, so
  // selecting one scrolls the studio into view and fills the description.
  const useSuggestion = useCallback((suggestion) => {
    const textarea = document.getElementById('description');
    if (textarea) {
      // Set through the native setter so React's onChange still fires.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, suggestion.slice(0, 600));
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    renderStudioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    textarea?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100">
      <a
        href="#render"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to the render studio
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white">
              PI
            </span>
            <div>
              <p className="text-base font-bold leading-tight text-slate-900">PropertyInsight Studio</p>
              <p className="text-xs leading-tight text-slate-500">Alter rendering engine</p>
            </div>
          </div>

          <nav aria-label="Sections" className="order-last w-full sm:order-none sm:ml-6 sm:w-auto">
            <ul className="flex gap-1 overflow-x-auto">
              {NAV.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How it works
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
        {offline && (
          <Alert tone="warn" title="Offline mode">
            No provider key is configured, so renders are synthetic placeholders and assist text is a
            deterministic stub. The full pipeline — validation, idempotency, retries, rate limits — is
            live and exercised. Set <code className="rounded bg-amber-100 px-1">ALTER_RENDER_API_KEY</code> for
            real output.
          </Alert>
        )}

        <div ref={renderStudioRef} className="scroll-mt-24">
          <RenderStudio
            industries={industries}
            industry={industry}
            onIndustryChange={setIndustry}
          />
        </div>

        <div className="scroll-mt-24"><SuggestionsSection industry={industry} onUseSuggestion={useSuggestion} /></div>
        <div className="scroll-mt-24"><TargetingSection industry={industry} /></div>
        <div className="scroll-mt-24"><CampaignSection industry={industry} /></div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-slate-500 sm:px-6">
          <p>
            Renders are a visualization of proposed work — not a survey, an appraisal, or a quote.
            Return figures are published industry benchmarks, not projections for a specific property.
          </p>
          <p className="mt-2">
            Map data © OpenStreetMap contributors. Built on{' '}
            <code className="rounded bg-slate-100 px-1">@alter/render-core</code>.
          </p>
        </div>
      </footer>

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}
