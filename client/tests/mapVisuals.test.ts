import { describe, it, expect } from 'vitest';
import {
  getVisitOrder,
  getVisitRecency,
  getTrailLinkKeys,
  getNodeRole,
} from '../src/services/mapVisuals';
import type { StoryLink } from '../src/context/StoryTypes';

const link = (source: string, target: string): StoryLink => ({ source, target, isRevealed: true });

describe('getVisitOrder', () => {
  it('numbers nodes by their first visit', () => {
    expect(getVisitOrder(['start', 'pathA', 'whisperSource'])).toEqual({
      start: 1,
      pathA: 2,
      whisperSource: 3,
    });
  });

  it('does not renumber a revisited node', () => {
    // start (1), pathA (2), back to start (still 1), pathB (3)
    expect(getVisitOrder(['start', 'pathA', 'start', 'pathB'])).toEqual({
      start: 1,
      pathA: 2,
      pathB: 3,
    });
  });

  it('is empty for an empty history', () => {
    expect(getVisitOrder([])).toEqual({});
  });
});

describe('getVisitRecency', () => {
  it('weights the most-recent node 1 and the oldest at the floor', () => {
    const r = getVisitRecency(['a', 'b', 'c'], 0.4);
    expect(r.c).toBe(1); // most recent
    expect(r.a).toBeCloseTo(0.4); // oldest → floor
    expect(r.b).toBeCloseTo(0.7); // halfway between
  });

  it('ranks by LAST visit, so a revisit refreshes a node', () => {
    // a is revisited last, so it is the most recent despite being seen first.
    const r = getVisitRecency(['a', 'b', 'a'], 0.4);
    expect(r.a).toBe(1);
    expect(r.b).toBeCloseTo(0.4);
  });

  it('gives a lone visited node full weight', () => {
    expect(getVisitRecency(['a'])).toEqual({ a: 1 });
  });

  it('omits never-visited nodes and is empty for empty history', () => {
    expect(getVisitRecency([])).toEqual({});
    expect(getVisitRecency(['a', 'b'])).not.toHaveProperty('c');
  });
});

describe('getTrailLinkKeys', () => {
  const links = [link('start', 'pathA'), link('pathA', 'whisperSource'), link('start', 'pathB')];

  it('collects consecutive walked pairs that correspond to real links', () => {
    const trail = getTrailLinkKeys(['start', 'pathA', 'whisperSource'], links);
    expect([...trail].sort()).toEqual(['pathA->whisperSource', 'start->pathA']);
  });

  it('drops steps with no matching link (e.g. a minimap jump)', () => {
    // start -> whisperSource is not a real link, so it is not part of the trail.
    const trail = getTrailLinkKeys(['start', 'whisperSource', 'pathA'], links);
    expect([...trail]).toEqual([]);
  });

  it('is direction-sensitive', () => {
    const trail = getTrailLinkKeys(['pathA', 'start'], links);
    expect(trail.has('start->pathA')).toBe(false);
  });

  it('records a revisited edge only once', () => {
    const trail = getTrailLinkKeys(['start', 'pathA', 'start', 'pathA'], [link('start', 'pathA'), link('pathA', 'start')]);
    expect([...trail].sort()).toEqual(['pathA->start', 'start->pathA']);
  });
});

describe('getNodeRole', () => {
  it('ranks the current node above everything else', () => {
    expect(getNodeRole('x', { currentNodeId: 'x', visited: true, isEnding: true })).toBe('current');
  });

  it('marks a non-current ending node as ending', () => {
    expect(getNodeRole('end', { currentNodeId: 'x', visited: true, isEnding: true })).toBe('ending');
  });

  it('distinguishes visited from unvisited otherwise', () => {
    expect(getNodeRole('a', { currentNodeId: 'x', visited: true, isEnding: false })).toBe('visited');
    expect(getNodeRole('b', { currentNodeId: 'x', visited: false, isEnding: false })).toBe('unvisited');
  });
});
