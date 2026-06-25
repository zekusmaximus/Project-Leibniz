// @vitest-environment jsdom
//
// DOM-level tests for NodeMap. The D3 force simulation and the entrance
// transitions run on timers that don't settle deterministically under jsdom, so
// these assert the SYNCHRONOUS render output (the data-join structure: one group
// per node, labels, visit badges, visit-order badges, trail) and DOM identity
// across re-renders (proving the enter/update/exit join reuses elements rather
// than tearing the graph down). The order/appearance maths is covered purely and
// deterministically in mapVisuals.test.ts.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StoryContext } from '../src/context/context';
import type { StoryContextType } from '../src/context/StoryTypes';
import NodeMap, { type NodeData, type LinkData } from '../src/components/NodeMap';

// NodeMap only reads `dispatch` from the story context; everything else it needs
// comes through props. A minimal fake keeps the test off the network (the real
// StoryProvider fetches the graph on mount).
const ctx = { dispatch: vi.fn() } as unknown as StoryContextType;
const ui = (nodesData: NodeData[], linksData: LinkData[] = []) => (
  <StoryContext.Provider value={ctx}>
    <NodeMap nodesData={nodesData} linksData={linksData} width={400} height={300} />
  </StoryContext.Provider>
);

function groupForLabel(container: HTMLElement, label: string): Element | null {
  const texts = Array.from(container.querySelectorAll('g.node-group text.node-label'));
  return texts.find((t) => t.textContent === label)?.closest('g.node-group') ?? null;
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
    const { container } = render(ui(nodes, links));
    expect(container.querySelectorAll('g.node-group')).toHaveLength(3);
  });

  it('renders each node label', () => {
    const { container } = render(ui(nodes, links));
    const labels = Array.from(container.querySelectorAll('g.node-group text.node-label')).map((t) => t.textContent);
    expect(labels).toContain('The Anomaly');
    expect(labels).toContain('Path of Whispers');
    expect(labels).toContain('Path of Echoes');
  });

  it('renders a visit-count badge only for visited nodes', () => {
    const { container } = render(ui(nodes, links));
    const counts = Array.from(container.querySelectorAll('text.visit-count')).map((t) => t.textContent);
    // start visited 1×, pathB visited 2×; pathA unvisited → no badge.
    expect(counts.sort()).toEqual(['1', '2']);
  });

  it('renders an svg and a link line per link', () => {
    const { container } = render(ui(nodes, links));
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('g.links line')).toHaveLength(2);
  });

  it('renders a visit-order badge only for nodes with a visitOrder', () => {
    const { container } = render(ui(nodes, links));
    const orders = Array.from(container.querySelectorAll('text.visit-order')).map((t) => t.textContent);
    // start → 1, pathB → 2; pathA has no visitOrder → no badge.
    expect(orders.sort()).toEqual(['1', '2']);
  });

  it('marks walked links as a directed trail', () => {
    const trailLinks: LinkData[] = [
      { source: 'start', target: 'pathA', onTrail: true },
      { source: 'start', target: 'pathB' },
    ];
    const { container } = render(ui(nodes, trailLinks));
    const trail = container.querySelectorAll('g.links line.trail');
    expect(trail).toHaveLength(1);
    expect(trail[0].getAttribute('marker-end')).toBe('url(#trail-arrow)');
  });

  it('reuses DOM across data changes (enter/update, not teardown)', () => {
    const { container, rerender } = render(ui(nodes, links));
    expect(container.querySelectorAll('g.node-group')).toHaveLength(3);
    const startGroup = groupForLabel(container, 'The Anomaly');
    expect(startGroup).not.toBeNull();

    // Reveal a 4th node and promote pathA to visited+ordered.
    const next: NodeData[] = [
      nodes[0],
      { id: 'pathA', label: 'Path of Whispers', x: 200, y: 150, size: 15, color: 'skyblue', visitedCount: 1, visitOrder: 3 },
      nodes[2],
      { id: 'whisperSource', label: 'Source of Whispers', x: 260, y: 170, size: 12, color: '#ADD8E6', visitedCount: 0 },
    ];
    rerender(ui(next, [...links, { source: 'pathA', target: 'whisperSource', onTrail: true }]));

    // Enter: the revealed node appears; total is 4.
    expect(container.querySelectorAll('g.node-group')).toHaveLength(4);
    // Update (not teardown): the start node's <g> is the SAME DOM element.
    expect(groupForLabel(container, 'The Anomaly')).toBe(startGroup);
    // Update: pathA now carries a visit-order badge (3), joining start (1)/pathB (2).
    const orders = Array.from(container.querySelectorAll('text.visit-order')).map((t) => t.textContent);
    expect(orders.sort()).toEqual(['1', '2', '3']);
    // The new edge is part of the trail.
    expect(container.querySelectorAll('g.links line.trail')).toHaveLength(1);
  });
});
