import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A remote read with its loading and error state.
 *
 * Aborts on unmount and supersedes an in-flight request, so navigating between
 * pages mid-fetch cannot land an old response on a new screen.
 */
export function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.resolve(loaderRef.current(controller.signal))
      .then((data) => { if (live) setState({ data, loading: false, error: null }); })
      .catch((error) => {
        if (!live || controller.signal.aborted || error?.code === 'ABORTED') return;
        setState({ data: null, loading: false, error });
      });

    return () => { live = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
}

/** A write with its own pending/error state, kept separate from reads. */
export function useAction(fn) {
  const [state, setState] = useState({ pending: false, error: null, data: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    setState({ pending: true, error: null, data: null });
    try {
      const data = await fnRef.current(...args);
      setState({ pending: false, error: null, data });
      return data;
    } catch (error) {
      setState({ pending: false, error, data: null });
      return undefined;
    }
  }, []);

  return { ...state, run };
}
