import '../src/index.css';
import '../src/App.css';

/**
 * The Atlas canvas is dark and the panels are translucent, so a story on a
 * white background does not show what the component actually looks like.
 */
export const parameters = {
  backgrounds: {
    default: 'atlas',
    values: [
      { name: 'atlas', value: '#0a0a0a' },
      { name: 'panel', value: '#171717' }
    ]
  },
  controls: { expanded: true },
  a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } }
};

export const decorators = [
  (Story) => (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <Story />
    </div>
  )
];
