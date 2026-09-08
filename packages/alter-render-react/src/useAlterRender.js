import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * useAlterRender - headless state for a before/after render.
 *
 * Headless on purpose. Every host has its own design system, and a component
 * that owns both the state machine and the markup forces them to fork it to
 * restyle it. This hook owns the state machine only; bring your own markup, or
 * pass its output to <AlterCompare>.
 *
 * `renderer` is anything with a `render()` method - an AlterRenderEngine
 * (server-side, tests, offline demos) or a client from `createRenderClient()`
 * (browser talking to your API). The hook cannot tell them apart, which is what
 * lets an app develop against the mock and ship against the real thing without
 * a component change.
 *
 *   const { status, result, error, render, reset } = useAlterRender({ renderer });
 *
 * status: 'idle' | 'rendering' | 'done' | 'error'
 */
export function useAlterRender({ renderer, onSuccess, onError } = {}) {
  const [state, setState] = useState({ status: 'idle', result: null, error: null });

  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  // Keep callbacks in a ref so an inline arrow in the caller does not change
  // the identity of `render` on every parent re-render.
  const handlersRef = useRef({ onSuccess, onError });
  handlersRef.current = { onSuccess, onError };

  useEffect(() => () => {
    mountedRef.current = false;
    // Unmounting mid-render must cancel the in-flight request. Otherwise the
    // user navigates away, the request runs to completion, and the app pays for
    // an image nobody will ever see.
    controllerRef.current?.abort();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    if (mountedRef.current) setState({ status: 'idle', result: null, error: null });
  }, [cancel]);

  const render = useCallback(async (input) => {
    if (!renderer) {
      const error = new Error('useAlterRender requires a renderer');
      setState({ status: 'error', result: null, error });
      return { ok: false, error };
    }

    // A new request supersedes the one in flight rather than racing it.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ status: 'rendering', result: prev.result, error: null }));

    try {
      const result = await renderer.render({ ...input, signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return { ok: false, aborted: true };
      setState({ status: 'done', result, error: null });
      handlersRef.current.onSuccess?.(result);
      return { ok: true, result };
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted || error?.code === 'ABORTED') {
        return { ok: false, aborted: true };
      }
      setState({ status: 'error', result: null, error });
      handlersRef.current.onError?.(error);
      return { ok: false, error };
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [renderer]);

  return useMemo(() => ({
    ...state,
    isRendering: state.status === 'rendering',
    // Surface the stable error code, not the message: UI copy should branch on
    // `code`, so it stays correct when a message is reworded upstream.
    errorCode: state.error?.code || null,
    render,
    reset,
    cancel
  }), [state, render, reset, cancel]);
}

/**
 * Loads the industry presets from whichever renderer is configured, falling
 * back to an empty list so a picker can render before the fetch resolves.
 */
export function useAlterIndustries(renderer) {
  const [industries, setIndustries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    Promise.resolve(renderer?.listIndustries?.({ signal: controller.signal }) ?? [])
      .then((list) => { if (!cancelled) setIndustries(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setIndustries([]); });

    return () => { cancelled = true; controller.abort(); };
  }, [renderer]);

  return industries;
}

export default useAlterRender;
