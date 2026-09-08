import 'dotenv/config';
import { createApp } from './app.js';

const PORT = Number.parseInt(process.env.PORT, 10) || 5175;

const app = createApp(process.env);

const server = app.listen(PORT, () => {
  const { engine, textProvider } = app.locals;
  console.log(`[propertyinsight] api listening on http://127.0.0.1:${PORT}`);
  console.log(
    `[propertyinsight] render provider: ${engine.provider.name}` +
    (textProvider.offline ? ' · assist: offline stub' : ' · assist: live')
  );
  if (engine.provider.name === 'mock') {
    console.log('[propertyinsight] set ALTER_RENDER_API_KEY for real renders');
  }
});

// Stop accepting connections, let in-flight renders finish, then exit. A render
// can be 20s of paid work; killing it mid-flight bills for nothing.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[propertyinsight] ${signal} received, draining`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 20000).unref();
  });
}

export { app, server };
