/**
 * Dev-server proxy.
 *
 * This deliberately replaces the `"proxy"` field that used to live in
 * package.json. Both forward the same paths to the API, but the package.json
 * form also switches on react-scripts' dev-server host check, which derives its
 * single allowed host from the machine's LAN address. On a host whose only
 * non-loopback address falls outside the private ranges (containers, CI, many
 * cloud VMs) that derivation yields `undefined`, webpack-dev-server rejects the
 * config, and `npm start` dies before it ever listens:
 *
 *     options.allowedHosts[0] should be a non-empty string
 *
 * Configuring the proxy here instead leaves that host check off, so the dev
 * server starts everywhere. Nothing about request forwarding changes.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.REACT_APP_PROXY_TARGET || 'http://localhost:5000';

/**
 * Answer for an API that is not there.
 *
 * The dev server stands between the browser and the API, so when the API is
 * not running it is the dev server that has to say something. The default is a
 * bare 500, which arrives in the UI as "Request failed with status code 500" -
 * indistinguishable from the API having accepted the request and crashed on
 * it. It is not the same thing at all: the request never got that far, nothing
 * was read or written, and retrying is the right move.
 *
 * This is easy to hit in normal development - restart the API and submit a
 * form in the second before it is listening - and the misleading 500 sends you
 * looking for a server-side bug that does not exist. A 503 with a code the
 * client recognises says what actually happened.
 */
const onError = (err, req, res) => {
  // eslint-disable-next-line no-console
  console.warn(`[proxy] ${req.method} ${req.url} -> ${target} failed: ${err.code || err.message}`);

  // Websocket upgrades get a socket, not a response.
  if (!res || typeof res.writeHead !== 'function') {
    if (res && typeof res.destroy === 'function') res.destroy();
    return;
  }
  if (res.headersSent) return;

  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Could not reach the API server.',
    code: 'API_UNREACHABLE'
  }));
};

module.exports = function setupProxy(app) {
  app.use('/api', createProxyMiddleware({ target, changeOrigin: true, onError }));
  app.use('/health', createProxyMiddleware({ target, changeOrigin: true, onError }));
  app.use('/socket.io', createProxyMiddleware({ target, changeOrigin: true, ws: true, onError }));
};
