import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFor } from './api';

/**
 * One async call with its loading state, error message, and result.
 *
 * The template repeated this five times as three useState calls apiece, which
 * is where its bugs lived: one `isLoading` flag was shared between the render
 * button and the parameter button, so starting either disabled both. Giving
 * each action its own instance makes that class of bug unrepresentable.
 *
 * It also aborts on unmount and supersedes an in-flight call, so a double click
 * cannot land two responses out of order.
 */
export function useAsyncAction(fn) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => () => {
    mountedRef.current = false;
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(async (...args) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ status: 'pending', data: prev.data, error: null }));

    try {
      const data = await fnRef.current(...args, controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return undefined;
      setState({ status: 'done', data, error: null });
      return data;
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted || error?.code === 'ABORTED') return undefined;
      setState({ status: 'error', data: null, error });
      return undefined;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    if (mountedRef.current) setState({ status: 'idle', data: null, error: null });
  }, []);

  return {
    ...state,
    isPending: state.status === 'pending',
    errorMessage: state.error ? messageFor(state.error) : null,
    run,
    reset
  };
}
