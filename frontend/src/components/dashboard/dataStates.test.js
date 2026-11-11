import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { dashboardFixtures } from '@atlas/dashboard-data/src/fixtures';

import QuickStats from '../ui/QuickStats';
import DataStateBadge from '../ui/DataStateBadge';
import ActivityFeed from './ActivityFeed';
import PriorityQueue from './PriorityQueue';

/**
 * The acceptance criterion these tests exist for: *UI components render
 * distinct visuals for each data state*. "Distinct" is easy to claim and easy
 * to lose - a refactor that collapses two states onto the same treatment looks
 * fine in review and is invisible in a screenshot nobody takes.
 *
 * So rather than asserting one state at a time, most of these render all five
 * and assert that what comes out differs. The fixtures are the same ones the
 * Storybook gallery uses, and the data layer's own suite proves each derives
 * the state it claims.
 */

const fixtures = dashboardFixtures();
const STATES = Object.values(DATA_STATES);

/* ----------------------------------------------------------------- badge -- */

describe('DataStateBadge', () => {
  test('each state renders its own label', () => {
    const labels = STATES.map((state) => {
      const { container, unmount } = render(<DataStateBadge state={state} />);
      const label = container.textContent;
      unmount();
      return label;
    });
    expect(new Set(labels).size).toBe(STATES.length);
  });

  test('the state is announced to assistive technology, once', () => {
    render(<DataStateBadge state={DATA_STATES.DEGRADED} failedSources={['alerts']} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('DEGRADED');
    // The hint names the lane, so "something is wrong" becomes actionable.
    expect(status).toHaveTextContent(/Unavailable: alerts/);
  });

  test('each state is distinguishable without colour', () => {
    // Colour alone fails a sunlit tablet and a colour vision deficiency, so
    // every state also differs in text and in dot geometry.
    const shapes = STATES.map((state) => {
      const { container, unmount } = render(<DataStateBadge state={state} />);
      const markup = container.innerHTML
        .replace(/text-[a-z]+-\d+/g, '')
        .replace(/bg-[a-z]+-\d+(\/\d+)?/g, '')
        .replace(/border-[a-z]+-\d+(\/\d+)?/g, '');
      unmount();
      return markup;
    });
    expect(new Set(shapes).size).toBe(STATES.length);
  });

  test('a retry is offered only where retrying could help', () => {
    for (const state of STATES) {
      const { unmount } = render(<DataStateBadge state={state} onRetry={() => {}} />);
      expect(screen.getByLabelText('Refresh dashboard data')).toBeInTheDocument();
      unmount();
    }
    // With no handler there is no button to focus or announce.
    render(<DataStateBadge state={DATA_STATES.LIVE} />);
    expect(screen.queryByLabelText('Refresh dashboard data')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------ quickstats -- */

describe('QuickStats', () => {
  test('SYNCING shows placeholders, never a confident zero', () => {
    const view = fixtures[DATA_STATES.SYNCING];
    const { container } = render(
      <QuickStats data={view.summary} state={view.state} failedSources={view.failedSources} />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    // A row of zeroes under a spinner reads as data. It is not.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('LIVE shows the figures and a caption about each one', () => {
    const view = fixtures[DATA_STATES.LIVE];
    render(<QuickStats data={view.summary} state={view.state} />);
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('On file for this company')).toBeInTheDocument();
  });

  test('no tile claims a trend, because nothing measures one', () => {
    // The old tiles carried "+2.5%" and "-12%" as string literals.
    const view = fixtures[DATA_STATES.LIVE];
    const { container } = render(<QuickStats data={view.summary} state={view.state} />);
    expect(container.textContent).not.toMatch(/[+-]\d+(\.\d+)?%/);
  });

  test('DEGRADED marks only the tiles whose own lane failed', () => {
    const view = fixtures[DATA_STATES.DEGRADED];
    render(<QuickStats data={view.summary} state={view.state} failedSources={view.failedSources} />);

    // One failed lane (alerts) feeds exactly one tile.
    expect(screen.getAllByText('Last known — feed unavailable')).toHaveLength(1);
    // And the lanes that answered still say something true about themselves.
    expect(screen.getByText('On file for this company')).toBeInTheDocument();
  });

  test('OFFLINE says where the numbers came from', () => {
    const view = fixtures[DATA_STATES.OFFLINE];
    render(<QuickStats data={view.summary} state={view.state} failedSources={[]} />);
    expect(screen.getAllByText('Cached on this device').length).toBeGreaterThan(0);
    expect(screen.getByText('1,284')).toBeInTheDocument();
  });

  test('the five states produce five different renders', () => {
    const renders = STATES.map((state) => {
      const view = fixtures[state];
      const { container, unmount } = render(
        <QuickStats data={view.summary} state={view.state} failedSources={view.failedSources} />
      );
      const html = container.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(renders).size).toBe(STATES.length);
  });
});

/* ---------------------------------------------------------- activity feed -- */

describe('ActivityFeed', () => {
  test('a first read shows placeholder rows, not an empty state', () => {
    const { container } = render(<ActivityFeed activity={[]} state={DATA_STATES.SYNCING} fetchedAt={null} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nothing has happened/)).not.toBeInTheDocument();
  });

  test('a refresh over existing rows does not blank them', () => {
    // The flicker this guards is how a dashboard teaches its operator to
    // distrust it: the numbers vanish every time it polls.
    const view = fixtures[DATA_STATES.LIVE];
    render(<ActivityFeed activity={view.activity} state={DATA_STATES.SYNCING} fetchedAt={Date.now()} />);
    expect(screen.getByText(view.activity[0].message)).toBeInTheDocument();
  });

  test('"nothing happened" and "we cannot see" are different sentences', () => {
    const { unmount } = render(<ActivityFeed activity={[]} state={DATA_STATES.LIVE} fetchedAt={Date.now()} />);
    expect(screen.getByText('Nothing has happened in the last 24 hours.')).toBeInTheDocument();
    unmount();

    render(<ActivityFeed activity={[]} state={DATA_STATES.OFFLINE} fetchedAt={null} />);
    expect(screen.getByText('No activity was cached on this device.')).toBeInTheDocument();
  });

  test('a degraded feed explains itself and offers a retry', () => {
    const view = fixtures[DATA_STATES.DEGRADED];
    const retry = jest.fn();
    render(
      <ActivityFeed
        activity={view.activity}
        state={view.state}
        failedSources={view.failedSources}
        fetchedAt={view.fetchedAt}
        onRetry={retry}
      />
    );
    expect(screen.getByText(/Some feeds are unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable: alerts/)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(retry).toHaveBeenCalled();
  });

  test('LIVE and SYNCING carry no explanatory note', () => {
    // A note that shows in every state is a note nobody reads.
    const view = fixtures[DATA_STATES.LIVE];
    render(<ActivityFeed activity={view.activity} state={view.state} fetchedAt={view.fetchedAt} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  test('rows render the message composed by the data layer, verbatim', () => {
    const view = fixtures[DATA_STATES.LIVE];
    const feed = render(<ActivityFeed activity={view.activity} state={view.state} fetchedAt={view.fetchedAt} />);
    for (const event of view.activity) {
      expect(within(feed.container).getByText(event.message)).toBeInTheDocument();
    }
  });
});

/* --------------------------------------------------------- priority queue -- */

describe('PriorityQueue', () => {
  test('LIVE lists the properties worst first', () => {
    const view = fixtures[DATA_STATES.LIVE];
    render(<PriorityQueue properties={view.priorityProperties} state={view.state} fetchedAt={view.fetchedAt} />);
    expect(screen.getByText('1247 Oak Ridge Dr')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
  });

  test('an empty queue distinguishes "none above threshold" from "nothing cached"', () => {
    const { unmount } = render(<PriorityQueue properties={[]} state={DATA_STATES.LIVE} fetchedAt={Date.now()} />);
    expect(screen.getByText(/above the 70% dispatch threshold/)).toBeInTheDocument();
    unmount();

    render(<PriorityQueue properties={[]} state={DATA_STATES.OFFLINE} fetchedAt={null} />);
    expect(screen.getByText('No priority queue was cached on this device.')).toBeInTheDocument();
  });

  test('a property nobody has assessed does not claim to have been assessed just now', () => {
    render(
      <PriorityQueue
        state={DATA_STATES.LIVE}
        fetchedAt={Date.now()}
        properties={[{ id: 'p9', address: '77 Unassessed Way', score: 82, risk: 'high', timestamp: null }]}
      />
    );
    expect(screen.getByText('not yet assessed')).toBeInTheDocument();
    expect(screen.queryByText('0 min ago')).not.toBeInTheDocument();
  });

  test('the five states produce five different renders', () => {
    const renders = STATES.map((state) => {
      const view = fixtures[state];
      const { container, unmount } = render(
        <PriorityQueue
          properties={view.priorityProperties}
          state={view.state}
          failedSources={view.failedSources}
          fetchedAt={view.fetchedAt}
        />
      );
      const html = container.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(renders).size).toBe(STATES.length);
  });
});
