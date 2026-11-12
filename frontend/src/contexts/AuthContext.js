import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState
} from 'react';
import { api, getToken, setToken } from '../lib/api';

/**
 * Who is signed in, and the two operations that change it.
 *
 * This deliberately sits *above* the data providers rather than beside them.
 * `WebSocketProvider`, `DashboardDataProvider`, `StormProvider` and
 * `PropertyProvider` all fetch on mount, so mounting them for a signed-out
 * visitor produces four simultaneous 401s before anything is on screen. An
 * earlier version of this app did exactly that, and because a 401 interceptor
 * then redirected to a route that did not exist, the result was a redirect
 * loop that exhausted the rate limiter. Gating at this level means a signed-out
 * visitor issues exactly one request - the token check below - and only when
 * there is a stored token worth checking.
 *
 * Three states, because "do we have a token" and "is that token any good" are
 * different questions:
 *
 * - `anonymous`    - no token, or one the API refused. Show the form.
 * - `checking`     - a stored token exists and is being validated.
 * - `authenticated`- the API answered for it.
 */
const AuthContext = createContext(null);

/** @returns {{status: string, user: object|null, login: Function, logout: Function}} */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider.');
  return value;
}

export function AuthProvider({ children }) {
  // Read the token once, at construction: a token that appears later only does
  // so because this provider put it there, and that path sets state directly.
  const [status, setStatus] = useState(() => (getToken() ? 'checking' : 'anonymous'));
  const [user, setUser] = useState(null);

  /*
   * Validate a stored token before trusting it.
   *
   * Tokens outlive page loads and expire in between, so a stored token is a
   * claim, not a session. Mounting the app on an expired one puts every panel
   * into an error state that looks like an outage. One request settles it.
   */
  useEffect(() => {
    if (status !== 'checking') return undefined;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const payload = await api.auth.me(controller.signal);
        if (cancelled) return;
        setUser(payload?.data?.user ?? payload?.user ?? null);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled || error?.code === 'ABORTED') return;
        // Clearing it matters: a token the API will not accept is worse than
        // none, because every consumer below would mount and fail on it.
        setToken(null);
        setUser(null);
        setStatus('anonymous');
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [status]);

  const login = useCallback(async (email, password) => {
    const payload = await api.auth.login(email, password);
    const token = payload?.data?.tokens?.accessToken;
    if (!token) {
      // Treated as a failure rather than a success with no session: the
      // alternative is an app that believes it is signed in and 401s on
      // everything it then asks for.
      throw new Error('Signed in, but the server did not return a session token.');
    }
    setToken(token);
    setUser(payload?.data?.user ?? null);
    setStatus('authenticated');
    return payload;
  }, []);

  const logout = useCallback(async () => {
    // The local session ends whether or not the server acknowledges it;
    // failing to clear it locally would strand the user signed in.
    try { await api.auth.logout(); } catch { /* intentionally ignored */ }
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout }),
    [status, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
