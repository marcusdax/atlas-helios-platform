import React from 'react';

/**
 * Shared primitives.
 *
 * The template inlined the same spinner SVG and the same disabled-button class
 * string five times, so a change to either meant five edits and, in practice,
 * five slightly different buttons. These exist so the app has one of each.
 */

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const TONES = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600 text-white',
  accent: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600 text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600 text-white',
  neutral: 'bg-slate-700 hover:bg-slate-800 focus-visible:outline-slate-700 text-white'
};

export function Button({ tone = 'primary', busy = false, busyLabel, children, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      // aria-busy rather than swapping to a spinner-only label: screen reader
      // users keep the button's name while it works.
      aria-busy={busy || undefined}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none
        ${TONES[tone]} ${className}`}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Panel({ title, description, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-5 ${className}`}>
      {title && <h3 className="text-base font-semibold text-slate-800">{title}</h3>}
      {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
      <div className={title || description ? 'mt-4 space-y-4' : 'space-y-4'}>{children}</div>
    </div>
  );
}

export function Section({ id, title, kicker, description, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-5">
      <header>
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">{kicker}</p>
        )}
        <h2 id={`${id}-heading`} className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
      </header>
      {children}
    </section>
  );
}

const CONTROL =
  'w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

export function Field({ label, hint, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextInput({ id, label, hint, ...props }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input id={id} className={CONTROL} {...props} />
    </Field>
  );
}

export function TextArea({ id, label, hint, counter, maxLength, value, ...props }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <textarea id={id} className={CONTROL} maxLength={maxLength} value={value} {...props} />
      {counter && maxLength && (
        <p className="mt-1 text-right text-xs text-slate-400">{value.length}/{maxLength}</p>
      )}
    </Field>
  );
}

export function Select({ id, label, hint, options, ...props }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <select id={id} className={CONTROL} {...props}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

const ALERT_TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900'
};

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${ALERT_TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

/**
 * Standard slot under an async control: the error if it failed, nothing if not.
 * aria-live so the outcome is announced without stealing focus.
 */
export function ActionStatus({ action, children }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {action.errorMessage && <Alert tone="error">{action.errorMessage}</Alert>}
      {!action.errorMessage && children}
    </div>
  );
}
