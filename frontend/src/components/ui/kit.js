import React from 'react';
import { messageFor } from '../../lib/api';

/**
 * Shared presentation primitives.
 *
 * Six pages that each invent their own table, empty state and error banner
 * drift apart within a release. These are deliberately plain: they carry the
 * dark Atlas palette and nothing else, so a page can be read in one screen.
 */

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-neutral-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ tone = 'primary', busy, children, className = '', ...props }) {
  const tones = {
    primary: 'bg-sky-500 text-neutral-950 hover:bg-sky-400',
    ghost: 'border border-neutral-700 text-neutral-300 hover:bg-neutral-800',
    danger: 'bg-red-500 text-neutral-950 hover:bg-red-400'
  };
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500
        disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 ${tones[tone]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export const Field = ({ label, hint, id, children }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-300">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
  </div>
);

export const control =
  'w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-sm text-neutral-100 ' +
  'placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25';

export const Input = ({ label, hint, id, ...props }) => (
  <Field id={id} label={label} hint={hint}><input id={id} className={control} {...props} /></Field>
);

export const Select = ({ label, hint, id, options, ...props }) => (
  <Field id={id} label={label} hint={hint}>
    <select id={id} className={control} {...props}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

export const TextArea = ({ label, hint, id, ...props }) => (
  <Field id={id} label={label} hint={hint}><textarea id={id} className={control} {...props} /></Field>
);

const TONES = {
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
};

export const Alert = ({ tone = 'info', title, children }) => (
  <div className={`rounded-lg border p-3 text-sm ${TONES[tone]}`}>
    {title && <p className="font-semibold">{title}</p>}
    {children}
  </div>
);

/**
 * The three states every remote list has. Rendering them from one place means
 * "loading" never silently looks like "empty", which is the failure mode that
 * makes a user reload a page that was working.
 */
export function AsyncState({ loading, error, empty, emptyMessage = 'Nothing here yet.', children }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 text-sm text-neutral-400">
        <Spinner /> Loading…
      </div>
    );
  }
  if (error) return <Alert tone="error">{messageFor(error)}</Alert>;
  if (empty) return <p className="py-8 text-sm text-neutral-500">{emptyMessage}</p>;
  return children;
}

/** Wide tables scroll inside their own container, never the page body. */
export function Table({ columns, rows, keyOf, onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            {columns.map((c) => <th key={c.key} scope="col" className="px-3 py-2 font-semibold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-neutral-800/50' : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 align-top text-neutral-300">
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RISK_TONE = (score) =>
  score >= 80 ? 'bg-red-500/15 text-red-300'
    : score >= 60 ? 'bg-orange-500/15 text-orange-300'
      : score >= 40 ? 'bg-amber-500/15 text-amber-200'
        : 'bg-sky-500/15 text-sky-300';

export const RiskBadge = ({ score = 0 }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_TONE(Number(score) || 0)}`}>
    {Math.round(Number(score) || 0)}
  </span>
);

export const Badge = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    good: 'bg-emerald-500/15 text-emerald-300',
    warn: 'bg-amber-500/15 text-amber-200',
    bad: 'bg-red-500/15 text-red-300'
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
};

export const money = (value) =>
  value == null ? '—' : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const when = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
