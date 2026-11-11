'use strict';

/**
 * @atlas/dashboard-data — the dashboard's data layer.
 *
 * Framework-free on purpose. Everything here is a pure function or a plain
 * observable store, so the same model feeds the React dashboard, the mobile
 * field tool and anything that comes after, and so the whole lifecycle can be
 * tested without a renderer.
 *
 * Fixtures are NOT exported from this barrel. They live at
 * `@atlas/dashboard-data/src/fixtures` and are imported only by stories and
 * tests, which is what stops demo data from reaching a production bundle.
 */

module.exports = {
  ...require('./types'),
  ...require('./states'),
  ...require('./normalize'),
  ...require('./cache'),
  ...require('./store')
};
