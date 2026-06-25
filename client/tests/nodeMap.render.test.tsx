// @vitest-environment jsdom
//
// DOM-level smoke tests for NodeMap. The D3 force simulation and the entrance
// transitions run on timers that don't settle deterministically under jsdom, so
// these assert the SYNCHRONOUS render output (the data-join structure: one group
// per node, labels, visit badges, visit-order badges) rather than animated end
// states or settled positions. The order/appearance maths is covered purely and
// deterministically in mapVisuals.test.ts; this just proves the wiring.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StoryContext } from '../src/context/context';
import type { StoryContextType } from '../src/context/StoryTypes';
import NodeMap, { type NodeData, type LinkData } from '../src/components/NodeMap';

// NodeMap only reads `dispatch` from the story context; everything else it needs
// comes through props. A minimal fake keeps the test off the network (the real
// StoryProvider fetches the graph on mount).
function renderMap(nodesData: NodeData[], linksData: LinkData[] = []) {
  const ctx = { dispatch: vi.fn() } as unknown as StoryContextType;
  return render(
    <StoryContext.Provider value={ctx}>
      <NodeMap nodesData={nodesData} linksData={linksData} width={400} height={300} />
    </StoryContext.Provider>
  );
}

afterEach(cleanup);

describe('NodeMap rendering', () => {
  const nodes: NodeData[] = [
    { id: 'start', label: 'The Anomaly', x: 100, y: 100, size: 20, color: 'orange', visitedCount: 1, visitOrder: 1 },
    { id: 'pathA', label: 'Path of Whispers', x: 200, y: 150, size: 15, color: 'skyblue', visitedCount: 0 },
    { id: 'pathB', label: 'Path of Echoes', x: 150, y: 220, size: 15, color: 'lightgreen', visitedCount: 2, visitOrder: 2 },
  ];
  const links: LinkData[] = [
    { source: 'start', target: 'pathA' },
    { source: 'start', target: 'pathB' },
  ];

  it('renders one node group per node', () => {
    const { container } = renderMap(nodes, links);
    expect(container.querySelectorAll('g.node-group')).toHaveLength(3);
  });

  it('renders each node label', () => {
    const { container } = renderMap(nodes, links);
    const labels = Array.from(container.querySelectorAll('g.node-group text')).map((t) => t.textContent);
    expect(labels).toContain('The Anomaly');
    expect(labels).toContain('Path of Whispers');
    expect(labels).toContain('Path of Echoes');
  });

  it('renders a visit-count badge only for visited nodes', () => {
    const { container } = renderMap(nodes, links);
    const counts = Array.from(container.querySelectorAll('text.visit-count')).map((t) => t.textContent);
    // start visited 1×, pathB visited 2×; pathA unvisited → no badge.
    expect(counts.sort()).toEqual(['1', '2']);
  });

  it('renders an svg and a link line per link', () => {
    const { container } = renderMap(nodes, links);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('g.links line')).toHaveLength(2);
  });

  it('renders a visit-order badge only for nodes with a visitOrder', () => {
    const { container } = renderMap(nodes, links);
    const orders = Array.from(container.querySelectorAll('text.visit-order')).map((t) => t.textContent);
    // start → 1, pathB → 2; pathA has no visitOrder → no badge.
    expect(orders.sort()).toEqual(['1', '2']);
  });

  it('marks walked links as a directed trail', () => {
    const trailLinks: LinkData[] = [
      { source: 'start', target: 'pathA', onTrail: true },
      { source: 'start', target: 'pathB' },
    ];
    const { container } = renderMap(nodes, trailLinks);
    const trail = container.querySelectorAll('g.links line.trail');
    expect(trail).toHaveLength(1);
    expect(trail[0].getAttribute('marker-end')).toBe('url(#trail-arrow)');
  });
});
