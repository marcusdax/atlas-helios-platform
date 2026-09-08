# Alter Render

A portable before/after property rendering engine, extracted from the Atlas & Helios
prototype so it can be dropped into other platforms without dragging this one along.

Give it a photo, a sentence about what's wrong, and a trade. It returns the same
photograph with the improvement rendered onto it, plus marketing copy and return
framing — and a comparison slider to show it with.

---

## The four packages

| Package | Runs in | What it is |
|---|---|---|
| `@alter/render-core` | anywhere | The engine. Providers, prompt guardrails, idempotency, retry, circuit breaker, cache, telemetry. No framework, no DOM, no HTTP server. |
| `@alter/render-server` | Node | A mountable Express router. The only place the provider API key exists. |
| `@alter/render-elements` | browser | `<alter-compare>` — the before/after slider as a custom element. Works in React, Vue, Svelte, Angular, Rails, WordPress, or a plain HTML file. |
| `@alter/render-react` | browser | React bindings: the `useAlterRender` hook and an `<AlterCompare>` wrapper. |

Take only what you need. The slider is useful with no engine at all; the engine is
useful with no UI at all.

---

## Why it is shaped like this

**The API key never reaches the browser.** The prototype this replaces called the model
vendor directly from a React component with the key in the query string. That publishes
the key to every visitor and puts unmetered image spend behind a button anyone can hold
down. Here, `AlterRenderEngine` runs on your server and `createRenderClient()` runs in the
browser — and they expose the *same* `render()` signature, so UI code never learns which
one it holds.

```js
const renderer = OFFLINE
  ? new AlterRenderEngine({ provider: mockProvider() })  // no key, no network
  : createRenderClient({ endpoint: '/api/renders' });    // key stays server-side
```

**The prompt is the product.** An unconstrained "make it nicer" prompt returns a
*different house*, which reads as a lie to a homeowner. Every transform prompt is fenced
with invariants — same camera, same light, same shadows, same footprint, change only the
target surface — and each trade declares what it may touch and what it must not. That
constraint layer is in `prompts/`, exported, and auditable.

**Money is a first-class concern.** Image generation is the most expensive call in the
product, so the engine has: content-derived idempotency keys (a retried request after a
dropped connection hits cache instead of billing twice), in-flight de-duplication
(concurrent identical requests share one upstream call), a concurrency gate (spend rate is
a configured number, not an emergent one), and a circuit breaker (a provider outage fails
fast instead of queueing 30-second timeouts).

**Degrading beats failing.** If the copy generator dies but the image model is fine, you
get the render with template copy and `meta.degraded: true` — because the image is the
product and the copy is an accessory.

---

## Quickstart

### Server

```js
const express = require('express');
const { createAlterRenderRouter, createEngineFromEnv } = require('@alter/render-server');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use('/api/renders', createAlterRenderRouter({
  engine: createEngineFromEnv(process.env),
  authorize: async (req) => requireUser(req)   // runs before any spend
}));
```

With no `ALTER_RENDER_API_KEY` set this boots on the mock provider and warns — the whole
feature is demoable before procurement finishes.

### React

```jsx
import { AlterCompare, useAlterRender } from '@alter/render-react';
import { createRenderClient } from '@alter/render-core';

const renderer = createRenderClient({ endpoint: '/api/renders' });

function Panel() {
  const { result, isRendering, render, errorCode } = useAlterRender({ renderer });

  return (
    <>
      <button onClick={() => render({ image, description, industry: 'roofing' })}>
        Render
      </button>
      <AlterCompare before={image} after={result?.after} loading={isRendering} />
    </>
  );
}
```

### Anything else

```html
<script type="module">import '@alter/render-elements';</script>

<alter-compare before="..." after="..." label-after="Alter render"></alter-compare>
```

See [`examples/vanilla.html`](../examples/vanilla.html) for a complete no-build page.

---

## The comparison slider

`<alter-compare>` is a custom element in shadow DOM, which is what makes "drop it into
another platform" survive contact with someone else's CSS reset.

| | |
|---|---|
| Attributes | `before` `after` `position` `label-before` `label-after` `orientation` `fit` `loading` `disabled` |
| Events | `input` (during drag), `change` (on release / keypress) — both `composed`, both carry `detail.position` |
| Theming | `--alter-radius` `--alter-aspect` `--alter-surface` `--alter-accent` `--alter-handle-size` `--alter-seam-width` `--alter-label-bg` `--alter-label-fg` `--alter-label-accent-fg` |
| Parts | `::part(before-layer)` `after-layer` `seam` `handle` `label` `state` |

It is a real `role="slider"`: focusable, arrow keys nudge by 1, Shift+arrow and Page keys
by 10, Home/End jump to the ends, double-click recentres. Pointer capture means a drag
that leaves the element keeps tracking. The two images are laid out identically and the
top one is *clipped*, never resized, so the seam stays pixel-aligned at every position.
The empty and loading states drop the slider role entirely, so assistive tech is never
offered a control that does nothing.

---

## Adding a trade

The seven built-in presets (roofing, garage doors, windows, exterior paint, landscaping,
storm restoration, listing prep) are a starting set, not a limit:

```js
const { defineIndustry } = require('@alter/render-core');

defineIndustry({
  id: 'solar',
  label: 'Solar Installation',
  target: 'the roof-mounted solar array',
  preserve: ['roof geometry', 'landscaping', 'neighboring structures'],
  cues: ['flush-mounted black-frame panels in even rows following the roof planes'],
  roiBasis: 'residential solar typically recovers cost through generation over 7-12 years'
});
```

## Adding a provider

```js
const myProvider = {
  name: 'stability',
  capabilities: { plan: false, transform: true },
  async transform({ image, prompt, signal }) {
    // image: { mimeType, data }  — data is base64 with no data: prefix
    return { mimeType: 'image/png', data: base64Result };
  }
};
```

Throw `AlterRenderError` with `retryable: true` for transient upstream faults; anything
else is treated as terminal. Mix vendors with `composeProvider({ planner, renderer })` —
a cheap text model writes the copy, a specialist image model does the edit.

---

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `ALTER_RENDER_PROVIDER` | `gemini` if a key exists, else `mock` | |
| `ALTER_RENDER_API_KEY` | — | falls back to `GEMINI_API_KEY` |
| `ALTER_RENDER_PLAN_MODEL` | `gemini-2.5-flash` | |
| `ALTER_RENDER_IMAGE_MODEL` | `gemini-2.5-flash-image` | |
| `ALTER_RENDER_CONCURRENCY` | `4` | simultaneous provider calls |
| `ALTER_RENDER_CACHE_SIZE` | `100` | renders held in memory |
| `ALTER_RENDER_CACHE_TTL_MS` | `86400000` | |
| `ALTER_RENDER_MAX_BYTES` | `12582912` | largest accepted source image |
| `ALTER_RENDER_TIMEOUT_MS` | `90000` | per provider call |
| `ALTER_RENDER_ATTEMPTS` | `3` | attempts per provider call |

---

## Operating it

Wire `telemetry` into whatever you already run. Events carry shapes, sizes and outcomes —
never image bytes or raw prompts — so they are safe to ship to a third-party sink.

```
render.started  render.cached  render.planned  render.plan_degraded
render.transformed  render.succeeded  render.failed
provider.retry  provider.breaker_open
```

Worth alerting on: a rising `render.plan_degraded` rate (copy quality is silently
dropping), any `provider.breaker_open` (the vendor is down), and `render.cached` falling
toward zero (something upstream is defeating idempotency, and the bill is about to show
it).

Two defaults to revisit before real traffic: the in-memory cache and job store are
per-process, so behind more than one instance you want Redis or Postgres behind the same
two interfaces — `{ get, set }` for the cache, `{ create, get, update, findByKey }` for
jobs. Neither the engine nor the router assumes either is local.

---

## Tests

```
npm test --workspace=@alter/render-core     # 21 tests, no network, no deps
npm test --workspace=@alter/render-server   # 9 tests, real Express + supertest
```

The core suite asserts the behaviours this README claims: cache hits avoid provider calls,
concurrent identical renders collapse to one, oversized images are rejected before spend,
the breaker ignores caller-fault errors, telemetry carries no image bytes, and an aborted
render actually aborts.

The slider is verified separately in a real browser (Playwright/Chromium) across drag,
keyboard, ARIA state transitions, both orientations, disabled handling, and shadow-DOM
style isolation against a hostile host stylesheet.
