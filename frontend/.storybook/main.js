/**
 * Storybook configuration.
 *
 * The point of Storybook here is the five-state gallery: every panel on the
 * dashboard renders differently for LIVE / SYNCING / STALE / DEGRADED /
 * OFFLINE, and the only way to know those five stay distinguishable from each
 * other is to see them side by side. The fixtures behind the stories are the
 * same ones the component tests use, and the data layer's own suite checks
 * each one derives the state it claims - so a story cannot drift into showing
 * something the app would call something else.
 */
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    /*
      The CRA preset, which has to come first.

      Storybook notices `react-scripts` is installed and switches its own babel
      handling off, so without this the webpack chain carries no babel-loader at
      all and the build dies on the first line of JSX in every story. This
      preset hands Storybook Create React App's own webpack and babel config
      instead - which is better than a second config anyway, because a story
      then compiles exactly the way the component does, Tailwind and PostCSS
      included.
    */
    '@storybook/preset-create-react-app',
    '@storybook/addon-essentials',
    // The data states are distinguished by more than colour, and that claim is
    // worth checking rather than asserting.
    '@storybook/addon-a11y'
  ],

  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },

  webpackFinal: async (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      // The workspace packages are symlinks; webpack has to follow them rather
      // than treat them as externals.
      symlinks: false
    }
  }),

  // react-docgen parses components to build the autodocs tables. Its default
  // parser does not read JSX in a `.js` file, which is how this whole app is
  // written, so point it at the babel-backed one.
  typescript: { reactDocgen: 'react-docgen' },

  docs: { autodocs: true }
};
