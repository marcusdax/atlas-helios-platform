/**
 * Storybook configuration.
 *
 * Storybook is not in `package.json`: adding ~400MB of unpinned devDependencies
 * to a workspace whose Docker build runs `npm ci` is a change that deserves its
 * own review, and the thing this task actually needed - a way to render every
 * data state without a network - is the mock provider, which works in plain
 * component tests too. The install command is one line in frontend/README.md.
 *
 * The stories and this config are here so that install is the only step left.
 */
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    '@storybook/addon-essentials',
    // The data states are distinguished by more than colour, and that claim is
    // worth checking rather than asserting.
    '@storybook/addon-a11y'
  ],

  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },

  // CRA aliases nothing unusual, but the workspace packages are symlinks and
  // webpack needs to follow them rather than treat them as externals.
  webpackFinal: async (config) => ({
    ...config,
    resolve: { ...config.resolve, symlinks: false }
  }),

  docs: { autodocs: 'tag' }
};
