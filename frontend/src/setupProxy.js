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

module.exports = function setupProxy(app) {
  app.use('/api', createProxyMiddleware({ target, changeOrigin: true }));
  app.use('/health', createProxyMiddleware({ target, changeOrigin: true }));
  app.use('/socket.io', createProxyMiddleware({ target, changeOrigin: true, ws: true }));
};
