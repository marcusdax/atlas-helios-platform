import { createElement, useEffect, useRef } from 'react';
import '@alter/render-elements/alter-compare.js';

/**
 * React wrapper for the <alter-compare> custom element.
 *
 * Written with createElement rather than JSX so the published package needs no
 * build step and no transpile config in the host - JSX inside node_modules is
 * the classic reason a shared component "doesn't work in our app".
 *
 * The wrapper exists because React's DOM layer (before v19) writes unknown
 * props as string attributes and does not listen for custom events. Both are
 * handled here so callers get an ordinary React component:
 *
 *   <AlterCompare before={r.before} after={r.after} loading={busy}
 *                 onPositionChange={(pos) => track('compare_drag', { pos })} />
 */
export function AlterCompare({
  before,
  after,
  position,
  labelBefore = 'Before',
  labelAfter = 'After',
  orientation = 'horizontal',
  fit = 'cover',
  loading = false,
  disabled = false,
  onPositionChange,
  onPositionInput,
  className,
  style,
  ...rest
}) {
  const ref = useRef(null);

  // Event listeners: custom events do not travel through React's synthetic
  // system, so they are attached to the node directly.
  const handlersRef = useRef({ onPositionChange, onPositionInput });
  handlersRef.current = { onPositionChange, onPositionInput };

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const onInput = (event) => handlersRef.current.onPositionInput?.(event.detail.position, event);
    const onChange = (event) => handlersRef.current.onPositionChange?.(event.detail.position, event);

    node.addEventListener('input', onInput);
    node.addEventListener('change', onChange);
    return () => {
      node.removeEventListener('input', onInput);
      node.removeEventListener('change', onChange);
    };
  }, []);

  // Controlled position, applied as a property so a data: URL or a float is not
  // stringified through the attribute path on every keystroke.
  useEffect(() => {
    const node = ref.current;
    if (node && typeof position === 'number' && node.position !== position) {
      node.position = position;
    }
  }, [position]);

  return createElement('alter-compare', {
    ref,
    class: className,
    style,
    before: before || undefined,
    after: after || undefined,
    'label-before': labelBefore,
    'label-after': labelAfter,
    orientation,
    fit,
    // Custom-element booleans are presence-based: `false` must remove the
    // attribute, and React only does that for `undefined`/`null`.
    loading: loading ? '' : undefined,
    disabled: disabled ? '' : undefined,
    ...rest
  });
}

export default AlterCompare;
