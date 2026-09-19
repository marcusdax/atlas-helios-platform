# @alter/render-core

The engine behind the Alter before/after property renderer: provider adapters, prompt
guardrails, idempotency, retry, circuit breaking, caching, and telemetry. No framework,
no DOM, no HTTP server — the same object runs in Express, a Lambda, a worker, or a CLI.

```js
const { AlterRenderEngine, geminiProvider } = require('@alter/render-core');

const engine = new AlterRenderEngine({
  provider: geminiProvider({ apiKey: process.env.ALTER_RENDER_API_KEY }),
  concurrency: 4
});

const result = await engine.render({
  image: 'data:image/jpeg;base64,...',
  description: 'Shingles are curling and there is moss on the north slope',
  industry: 'roofing'
});
// -> { id, before, after, prompt, copy: { headline, body, roi }, meta }
```

In the browser, use `createRenderClient({ endpoint })` instead — same `render()`
signature, but it forwards to your server so the provider key stays there.

Full documentation: [`packages/README.md`](../README.md).
