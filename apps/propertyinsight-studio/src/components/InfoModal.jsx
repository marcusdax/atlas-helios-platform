import React, { useCallback, useEffect, useRef } from 'react';

const STEPS = [
  ['Upload the property photo', 'A clear, straight-on shot of the elevation you want to change. It is downscaled in the browser before upload, which also strips EXIF location data.'],
  ['Pick the trade', 'The trade decides which surfaces the render may change and which must stay untouched — roofing may not move a window, landscaping may not alter the house.'],
  ['Describe what needs to change', 'Plain language. "Shingles are curling and there is moss on the north slope" is enough; specificity about the defect beats specificity about the fix.'],
  ['Render', 'You get the same photograph with the improvement applied, plus marketing copy and return framing you can take to the door.']
];

/**
 * Modal dialog.
 *
 * The template rendered this as a bare div: no focus management, no Escape, and
 * defined inside the parent component so React remounted it on every keystroke
 * anywhere in the app. This one traps focus, restores it on close, and lives at
 * module scope where it belongs.
 */
export default function InfoModal({ open, onClose }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    // Focus trap: keep Tab cycling inside the dialog while it is open.
    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    dialogRef.current?.querySelector('button')?.focus();

    // The page behind a modal must not scroll under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 id="info-title" className="text-xl font-bold text-slate-900">How PropertyInsight Studio works</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Show a homeowner the improvement on their own house before they buy it, then build the
          campaign around the render.
        </p>

        <ol className="mt-5 space-y-4">
          {STEPS.map(([title, detail], index) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          Renders are a visualization of proposed work, not a survey, an appraisal, or a quote.
          Return figures are published industry benchmarks, not a projection for a specific property.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
