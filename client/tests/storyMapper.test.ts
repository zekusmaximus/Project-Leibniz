// client/tests/storyMapper.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  mapServerNode,
  buildStoryState,
  applyProgress,
  toProgressPayload,
} from '../src/services/storyMapper';
import type { ServerNode, ServerLink } from '../src/services/storyMapper';
import { makeState } from './helpers';

describe('mapServerNode', () => {
  it('maps fields, compiles choice conditions, and parses text variants', () => {
    const doc: ServerNode = {
      id: 'start',
      label: 'The Anomaly',
      text: 'base text',
      choices: [
        { targetId: 'pathA', text: 'go' },
        { targetId: 'end', text: 'finish', condition: JSON.stringify({ kind: 'flag', key: 'done' }) },
      ],
      textVariants: [
        {
          id: 'ok',
          priority: 5,
          text: 'variant',
          condition: JSON.stringify({ kind: 'visited', node: 'pathA' }),
        },
        { id: 'broken', priority: 1, text: 'dropped', condition: '{not valid json' },
      ],
      visualProperties: { color: 'orange', size: 20 },
      metadata: { isStartNode: true },
    };

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const node = mapServerNode(doc);
    warn.mockRestore();

    expect(node.text).toBe('base text');
    expect(node.color).toBe('orange');
    expect(node.isRevealed).toBe(true); // isStartNode

    // The conditional choice compiles to a runtime predicate; the plain one stays unconditional.
    expect(node.choices).toHaveLength(2);
    expect(typeof node.choices?.[1].condition).toBe('function');
    expect(node.choices?.[0].condition).toBeUndefined();

    // The unparseable variant is dropped; the good one keeps its spec object.
    expect(node.textVariants).toHaveLength(1);
    expect(node.textVariants?.[0].id).toBe('ok');
    expect(node.textVariants?.[0].condition).toEqual({ kind: 'visited', node: 'pathA' });
  });

  it('omits textVariants entirely when none survive', () => {
    const node = mapServerNode({ id: 'x', label: 'X', text: 't' });
    expect(node.textVariants).toBeUndefined();
  });
});

const NODES: ServerNode[] = [
  { id: 'start', label: 'Start', text: 's', metadata: { isStartNode: true } },
  { id: 'pathA', label: 'A', text: 'a' },
];
const LINKS: ServerLink[] = [{ source: 'start', target: 'pathA' }];

describe('buildStoryState', () => {
  it('reveals the start node and seeds its visit count', () => {
    const state = buildStoryState(NODES, LINKS);
    expect(state.currentNodeId).toBe('start');
    expect(state.nodes.start.isRevealed).toBe(true);
    expect(state.nodes.pathA.isRevealed).toBe(false);
    expect(state.visitCounts.start).toBe(0);
  });
});

describe('applyProgress', () => {
  it('reconstructs reveal state from history/visitCounts and reveals spanned links', () => {
    const base = buildStoryState(NODES, LINKS);
    const next = applyProgress(base, {
      currentNodeId: 'pathA',
      visitCounts: { pathA: 2 },
      flags: { foo: true },
      history: ['start', 'pathA'],
    });

    expect(next.currentNodeId).toBe('pathA');
    expect(next.flags.foo).toBe(true);
    expect(next.nodes.pathA.isRevealed).toBe(true);
    expect(next.nodes.pathA.visitedCount).toBe(2);
    // Both endpoints revealed → the link between them is revealed too.
    expect(next.links[0].isRevealed).toBe(true);
  });
});

describe('toProgressPayload', () => {
  it('extracts only the persistable subset', () => {
    const state = makeState({
      currentNodeId: 'n',
      visitCounts: { n: 1 },
      flags: { f: true },
      history: ['n'],
    });
    expect(toProgressPayload(state)).toEqual({
      currentNodeId: 'n',
      visitCounts: { n: 1 },
      flags: { f: true },
      history: ['n'],
    });
  });
});
