/**
 * Build the app and fail only on warnings that come from our own source.
 *
 * `CI=true react-scripts build` promotes every webpack warning to an error,
 * including ones emitted from inside a dependency's own bundle - today,
 * maplibre-gl v6's `.mjs` contains a dynamic require that webpack flags as
 * "Critical dependency: the request of a dependency is an expression". That one
 * warning made the strict build unusable, which meant nobody ran it, which
 * meant real lint errors in our code went unnoticed until they reached a
 * reviewer.
 *
 * This runs the same production build and prints every warning with the module
 * that emitted it, then exits non-zero only if any came from `src/` or from one
 * of this repo's own workspace packages. CRA hides the module path; webpack's
 * stats do not, so this drives the config directly.
 *
 *   npm run build:check --workspace=atlas-helios-frontend
 */
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';

import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();

const webpack = require(path.join(root, '../node_modules/webpack'));
const configFactory = require(path.join(root, '../node_modules/react-scripts/config/webpack.config.js'));

/**
 * Ours: the app's source tree, one of our workspace packages, or any lint
 * finding.
 *
 * The eslint check matters most and is the easiest to miss: its warnings arrive
 * with no `moduleName` at all, so a module-path test alone silently passed
 * every unused variable and every a11y finding in our own code. They are
 * recognised by the `[eslint]` banner instead.
 */
const isOurs = (warning) => {
  const message = warning.message || '';
  if (/\[eslint\]/.test(message)) return true;

  const where = warning.moduleName || warning.moduleIdentifier || '';
  const inOurTree = (p) =>
    /(^|[/\\])src[/\\]/.test(p) && !/node_modules[/\\](?!@atlas[/\\]|@alter[/\\])/.test(p);

  return inOurTree(where) || inOurTree(message);
};

webpack(configFactory('production')).run((err, stats) => {
  if (err) {
    console.error('build failed to start:', err);
    process.exit(1);
  }

  const { warnings = [], errors = [] } = stats.toJson({ all: false, warnings: true, errors: true });

  for (const e of errors) {
    console.error(`ERROR  ${e.moduleName || '(unknown module)'}\n       ${(e.message || '').split('\n')[0]}`);
  }

  const ours = [];
  for (const w of warnings) {
    const where = w.moduleName || w.moduleIdentifier || '(lint / no module)';
    const mine = isOurs(w);
    if (mine) ours.push(w);
    // Lint warnings carry their detail past the first line, and that detail is
    // the whole point of reading them.
    const body = mine
      ? (w.message || '').trim()
      : (w.message || '').split('\n')[0];
    console.log(`${mine ? 'WARN*  ' : 'warn   '}${where}\n       ${body.replace(/\n/g, '\n       ')}`);
  }

  console.log(
    `\n${errors.length} error(s), ${warnings.length} warning(s), ` +
    `${ours.length} of them from our own code (marked WARN*).`
  );

  if (errors.length > 0 || ours.length > 0) process.exit(1);
  console.log('Build is clean as far as this repo is concerned.');
});
