// client/tests/storyReducer.test.ts
import { describe, it, expect } from 'vitest';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import { makeState, makeNode } from './helpers';
import type { StoryState } from '../src/context/StoryTypes';

// A fresh clone of the bundled graph so mutations in one test never leak.
function freshGraph(): StoryState {
  return {
    ...InitialState,
    nodes: { ...InitialState.nodes },
    links: InitialState.links.map((l) => ({ ...l })),
    visitCounts: { ...InitialState.visitCounts },
    flags: { ...InitialState.flags },
    history: [...InitialState.history],
  };
}

describe('storyReducer › VISIT_NODE', () => {
  it('increments the count, records history, and reveals the node', () => {
    const next = storyReducer(freshGraph(), { type: 'VISIT_NODE', nodeId: 'start' });
    expect(next.visitCounts.start).toBe(1);
    expect(next.history).toEqual(['start']);
    expect(next.currentNodeId).toBe('start');
    expect(next.nodes.start.isRevealed).toBe(true);
    expect(next.nodes.start.visitedCount).toBe(1);
  });

  it('recolours to purple and shrinks on a repeat visit', () => {
    let state = storyReducer(freshGraph(), { type: 'VISIT_NODE', nodeId: 'start' });
    const sizeAfterFirst = state.nodes.start.size ?? 0;
    state = storyReducer(state, { type: 'VISIT_NODE', nodeId: 'start' });
    expect(state.visitCounts.start).toBe(2);
    expect(state.nodes.start.color).toBe('#6a0dad');
    expect(state.nodes.start.size ?? 0).toBeLessThan(sizeAfterFirst);
  });

  it('reveals links from the visited node to its choice targets', () => {
    const next = storyReducer(freshGraph(), { type: 'VISIT_NODE', nodeId: 'start' });
    const startToPathA = next.links.find((l) => l.source === 'start' && l.target === 'pathA');
    expect(startToPathA?.isRevealed).toBe(true);
  });

  it('does not mutate the input state', () => {
    const input = freshGraph();
    storyReducer(input, { type: 'VISIT_NODE', nodeId: 'start' });
    expect(input.visitCounts.start).toBe(0);
    expect(input.history).toEqual([]);
  });
});

describe('storyReducer › SET_FLAG', () => {
  it('sets a flag without disturbing the others', () => {
    const base = makeState({ flags: { existing: true } });
    const next = storyReducer(base, { type: 'SET_FLAG', key: 'unlocked', value: true });
    expect(next.flags).toEqual({ existing: true, unlocked: true });
  });
});

describe('storyReducer › REVEAL_NODE', () => {
  it('reveals an existing node and merges data', () => {
    const base = makeState({ nodes: { a: makeNode({ id: 'a', isRevealed: false, color: 'red' }) } });
    const next = storyReducer(base, {
      type: 'REVEAL_NODE',
      nodeId: 'a',
      nodeData: { color: 'blue' },
    });
    expect(next.nodes.a.isRevealed).toBe(true);
    expect(next.nodes.a.color).toBe('blue');
  });

  it('creates a node that does not exist yet', () => {
    const next = storyReducer(makeState(), {
      type: 'REVEAL_NODE',
      nodeId: 'brandNew',
      nodeData: { label: 'New', text: 'hi' },
    });
    expect(next.nodes.brandNew.isRevealed).toBe(true);
    expect(next.nodes.brandNew.label).toBe('New');
  });
});

describe('storyReducer › REVEAL_LINK', () => {
  it('reveals an existing link and its endpoints', () => {
    const base = makeState({
      nodes: {
        a: makeNode({ id: 'a' }),
        b: makeNode({ id: 'b' }),
      },
      links: [{ source: 'a', target: 'b', isRevealed: false }],
    });
    const next = storyReducer(base, {
      type: 'REVEAL_LINK',
      link: { source: 'a', target: 'b', isRevealed: true },
    });
    expect(next.links[0].isRevealed).toBe(true);
    expect(next.nodes.a.isRevealed).toBe(true);
    expect(next.nodes.b.isRevealed).toBe(true);
  });

  it('is a no-op when an endpoint node is missing', () => {
    const base = makeState({ nodes: { a: makeNode({ id: 'a' }) }, links: [] });
    const next = storyReducer(base, {
      type: 'REVEAL_LINK',
      link: { source: 'a', target: 'missing', isRevealed: true },
    });
    expect(next).toBe(base);
  });
});

describe('storyReducer › RESET_STORY / LOAD_STORY', () => {
  it('RESET_STORY returns the bundled InitialState', () => {
    const dirty = makeState({ history: ['a', 'b'], flags: { x: true } });
    const next = storyReducer(dirty, { type: 'RESET_STORY' });
    expect(next.currentNodeId).toBe(InitialState.currentNodeId);
    expect(next.history).toEqual([]);
  });

  it('LOAD_STORY replaces the whole state', () => {
    const loaded = makeState({ currentNodeId: 'loaded', history: ['loaded'] });
    const next = storyReducer(makeState(), { type: 'LOAD_STORY', state: loaded });
    expect(next).toBe(loaded);
  });
});
