# @alter/render-server

A mountable Express router for the Alter render engine, and the only place the provider
API key exists.

```js
app.use('/api/renders', createAlterRenderRouter({
  engine: createEngineFromEnv(process.env),
  authorize: async (req) => requireUser(req)
}));
```

| Route | Purpose |
|---|---|
| `POST /` | Render. Synchronous by default; `?mode=async` returns `202` + a job id. Honours `Idempotency-Key`. |
| `GET /:id` | Poll an async job, or re-read a completed one. |
| `GET /industries` | The trade presets, for populating a picker. |

A router factory rather than a server, because your app already has one — with its own
auth, logging, CORS and rate limiting. This adds three routes and borrows the rest.

Full documentation: [`packages/README.md`](../README.md).
