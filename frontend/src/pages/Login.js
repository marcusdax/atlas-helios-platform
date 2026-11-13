import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messageFor } from '../lib/api';
import { ATTRIBUTION, Alert } from '../components/ui/kit';
import { demoLogin } from '../lib/demoLogin';

/**
 * The sign-in screen.
 *
 * Until this existed there was no way into the application at all: the API had
 * a working auth router, `lib/api.js` had `login`, `me` and `logout`, and
 * nothing rendered a form, so the only way to hold a session was to write a
 * token into `localStorage` by hand.
 *
 * The error handling is the part worth reading. A failed sign-in has three
 * quite different causes and they are not interchangeable: the server was
 * unreachable, the credentials were refused, or the server answered with
 * something unusable. Collapsing them into "login failed" is what makes an
 * outage look like a typo, so each is named.
 */
export default function Login() {
  const { login } = useAuth();
  /*
    The demo account arrives already selected where one is configured, so
    signing in is a single click. It is off in a production build unless
    someone opts in and supplies credentials — see lib/demoLogin.js — and
    whenever it is on, the banner below says so rather than letting a filled
    form pass for the viewer's own saved login.
  */
  const [email, setEmail] = useState(demoLogin.enabled ? demoLogin.email : '');
  const [password, setPassword] = useState(demoLogin.enabled ? demoLogin.password : '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // Nothing to navigate: the gate above swaps this screen for the app as
      // soon as the status changes. Routing here would fight that.
    } catch (err) {
      if (err?.code === 'NETWORK' || err?.code === 'API_UNREACHABLE') {
        setError('Could not reach the server. Check that the API is running, then try again.');
      } else if (err?.status === 401) {
        setError('Those credentials were not accepted.');
      } else if (err?.status === 429) {
        setError('Too many attempts. Wait a moment and try again.');
      } else if (err?.status === 502 || err?.status === 503 || err?.status === 504) {
        // Reached something, but not the API: a proxy or load balancer between
        // here and it answered instead. Reported separately from a refusal
        // because the credentials were never actually checked.
        setError('The server is not responding right now. Try again in a moment.');
      } else if (err?.status >= 500) {
        setError('The server failed to handle the sign-in. Try again, and tell an administrator if it keeps happening.');
      } else {
        setError(messageFor(err));
      }
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4 py-10">
      <div className="w-full max-w-sm">
        {/*
          Sign-in is brand chrome, not a tool surface, so this is the one place
          in the product where the Atlas market accent is allowed to appear
          (01 — Brand architecture §5). Everything past the gate uses the engine
          palette, which is why the button below is brass rather than amber.
        */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold"
            style={{ background: 'var(--brand)', color: 'var(--ink-950)' }}
            aria-hidden="true"
          >
            A
          </div>
          <h1 className="font-display text-2xl font-bold text-neutral-100">Atlas</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Storm intelligence and property assessment
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl"
        >
          <h2 className="mb-5 text-sm font-medium uppercase tracking-wider text-neutral-400">
            Sign in
          </h2>

          {/*
            Stated, not implied. A form that arrives filled in should say whose
            credentials those are — otherwise the obvious reading is "my
            browser saved this", and the next obvious move is to trust it.
          */}
          {demoLogin.enabled && (
            <div className="mb-5 rounded-lg border border-brass-700 bg-brass-500/10 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brass-300">
                {demoLogin.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                Filled in for you — press <strong>Sign in</strong>. This is a shared demo
                account, not a personal login.
              </p>
              <button
                type="button"
                onClick={() => { setEmail(''); setPassword(''); }}
                className="mt-2 text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
              >
                Use a different account
              </button>
            </div>
          )}

          {demoLogin.misconfigured && (
            <div className="mb-5">
              <Alert tone="warn" title="Demo sign-in is enabled but has no account">
                REACT_APP_DEMO_LOGIN is set, but this is a production build and no
                REACT_APP_DEMO_EMAIL / REACT_APP_DEMO_PASSWORD was supplied. Nothing has been
                pre-filled — a production bundle carries no default credentials.
              </Alert>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="login-email" className="mb-1.5 block text-sm text-neutral-300">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="login-password" className="mb-1.5 block text-sm text-neutral-300">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/*
            A live region, so the failure is announced rather than only drawn.
            Someone using a screen reader otherwise gets silence on submit.
          */}
          <div role="alert" aria-live="polite">
            {error && (
              <p className="mb-4 rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            /* Focused when the fields are already filled, so the demo account
               is genuinely one keypress away and a screen reader lands on the
               thing left to do. */
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={demoLogin.enabled}
            disabled={busy || !email || !password}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* The credential hint that used to sit here is redundant now the
            fields arrive filled; the banner inside the form says which account
            it is. */}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-500">
          {ATTRIBUTION}
        </p>
      </div>
    </div>
  );
}
