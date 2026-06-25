// @vitest-environment jsdom
//
// DOM-level tests for MiniMap. Unlike NodeMap it has no force simulation or
// transitions — renderMap draws synchronously — so these assert the order
// numbers and the gold trail directly.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MiniMap from '../src/components/MiniMap';
import type { NodeData, LinkData } from '../src/components/NodeMap';

const nodes: NodeData[] = [
  { id: 'start', label: 'Start', x: 0, y: 0, size: 20, color: 'orange', visitedCount: 1, visitOrder: 1 },
  { id: 'pathA', label: 'A', x: 50, y: 30, size: 15, color: 'skyblue', visitedCount: 1, visitOrder: 2 },
  { id: 'pathB', label: 'B', x: 30, y: 60, size: 15, color: 'lightgreen', visitedCount: 0 },
];
const links: LinkData[] = [
  { source: 'start', target: 'pathA', onTrail: true },
  { source: 'start', target: 'pathB' },
];

afterEach(cleanup);

describe('MiniMap rendering', () => {
  it('renders visit-order numbers for visited nodes only', () => {
    const { container } = render(
      <MiniMap nodesData={nodes} linksData={links} width={180} height={180} currentNodeId="pathA" />
    );
    const orders = Array.from(container.querySelectorAll('text.mini-order')).map((t) => t.textContent);
    // start → 1, pathA → 2; pathB has no visitOrder → no number.
    expect(orders.sort()).toEqual(['1', '2']);
  });

  it('draws the walked edge as a gold trail', () => {
    const { container } = render(
      <MiniMap nodesData={nodes} linksData={links} width={180} height={180} />
    );
    const lines = Array.from(container.querySelectorAll('line')) as SVGLineElement[];
    expect(lines).toHaveLength(2);
    // jsdom normalises the #ffcc00 trail colour to rgb form.
    const trail = lines.filter((l) => l.style.stroke === 'rgb(255, 204, 0)');
    expect(trail).toHaveLength(1);
  });
});
