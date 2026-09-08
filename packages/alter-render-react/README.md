# @alter/render-react

React bindings for the Alter render engine.

```jsx
const { result, isRendering, render, errorCode } = useAlterRender({ renderer });

<AlterCompare before={image} after={result?.after} loading={isRendering} />
```

`useAlterRender` is headless — it owns the state machine and nothing else, so your design
system owns the markup. It aborts the in-flight request on unmount and supersedes it on a
new call, so navigating away does not leave you paying for an image nobody will see.

`AlterCompare` wraps the `<alter-compare>` custom element, handling the two things React's
DOM layer does not: property (rather than attribute) binding, and custom event listeners.
Written with `createElement` rather than JSX so the published package needs no build step
in the host.

Full documentation: [`packages/README.md`](../README.md).
