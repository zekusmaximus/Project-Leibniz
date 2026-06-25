// client/tests/conditionDSL.test.ts
import { describe, it, expect } from 'vitest';
import {
  compileCondition,
  describeCondition,
  isConditionSpec,
  parseConditionSpec,
  compileConditionFromString,
} from '../src/services/conditionDSL';
import { makeState } from './helpers';

describe('compileCondition', () => {
  describe('flag', () => {
    it('matches a truthy flag', () => {
      const pred = compileCondition({ kind: 'flag', key: 'foo' });
      expect(pred(makeState({ flags: { foo: true } }))).toBe(true);
      expect(pred(makeState({ flags: { foo: false } }))).toBe(false);
      expect(pred(makeState())).toBe(false);
    });

    it('matches an exact value when `equals` is given', () => {
      const pred = compileCondition({ kind: 'flag', key: 'count', equals: 3 });
      expect(pred(makeState({ flags: { count: 3 } }))).toBe(true);
      expect(pred(makeState({ flags: { count: 2 } }))).toBe(false);
    });
  });

  describe('visited', () => {
    it('defaults to "visited at least once"', () => {
      const pred = compileCondition({ kind: 'visited', node: 'x' });
      expect(pred(makeState({ visitCounts: { x: 1 } }))).toBe(true);
      expect(pred(makeState({ visitCounts: { x: 0 } }))).toBe(false);
      expect(pred(makeState())).toBe(false);
    });

    it('honours the comparison operator and count', () => {
      const atLeastTwo = compileCondition({ kind: 'visited', node: 'x', op: '>=', count: 2 });
      expect(atLeastTwo(makeState({ visitCounts: { x: 1 } }))).toBe(false);
      expect(atLeastTwo(makeState({ visitCounts: { x: 2 } }))).toBe(true);

      const exactlyOne = compileCondition({ kind: 'visited', node: 'x', op: '==', count: 1 });
      expect(exactlyOne(makeState({ visitCounts: { x: 1 } }))).toBe(true);
      expect(exactlyOne(makeState({ visitCounts: { x: 2 } }))).toBe(false);
    });
  });

  describe('notVisited', () => {
    const pred = compileCondition({ kind: 'notVisited', node: 'x' });
    it('is true only when the node has never been visited', () => {
      expect(pred(makeState())).toBe(true);
      expect(pred(makeState({ visitCounts: { x: 0 } }))).toBe(true);
      expect(pred(makeState({ visitCounts: { x: 1 } }))).toBe(false);
    });
  });

  describe('visitedCountAcross', () => {
    it('sums visit counts across the given nodes (default: at least once)', () => {
      const pred = compileCondition({ kind: 'visitedCountAcross', nodes: ['a', 'b'] });
      expect(pred(makeState())).toBe(false);
      expect(pred(makeState({ visitCounts: { a: 1 } }))).toBe(true);
      expect(pred(makeState({ visitCounts: { b: 3 } }))).toBe(true);
    });

    it('honours the comparison operator and count over the sum', () => {
      const pred = compileCondition({
        kind: 'visitedCountAcross',
        nodes: ['a', 'b', 'c'],
        op: '>=',
        count: 4,
      });
      expect(pred(makeState({ visitCounts: { a: 1, b: 2 } }))).toBe(false);
      expect(pred(makeState({ visitCounts: { a: 1, b: 2, c: 1 } }))).toBe(true);
    });
  });

  describe('withinNSteps', () => {
    const pred = compileCondition({ kind: 'withinNSteps', node: 'x', steps: 2 });
    it('matches only when the node is within the last N history entries', () => {
      expect(pred(makeState({ history: ['x', 'a', 'b'] }))).toBe(false);
      expect(pred(makeState({ history: ['a', 'x', 'b'] }))).toBe(true);
      expect(pred(makeState({ history: ['a', 'b', 'x'] }))).toBe(true);
    });
    it('is false for a non-positive step window (never matches the whole history)', () => {
      const zero = compileCondition({ kind: 'withinNSteps', node: 'x', steps: 0 });
      expect(zero(makeState({ history: ['x'] }))).toBe(false);
    });
  });

  describe('historyEndsWith', () => {
    const pred = compileCondition({ kind: 'historyEndsWith', sequence: ['b', 'c'] });
    it('matches only the exact consecutive tail', () => {
      expect(pred(makeState({ history: ['a', 'b', 'c'] }))).toBe(true);
      expect(pred(makeState({ history: ['a', 'c', 'b'] }))).toBe(false);
      expect(pred(makeState({ history: ['b', 'c', 'a'] }))).toBe(false);
    });
    it('is false when the sequence is longer than the history', () => {
      expect(pred(makeState({ history: ['c'] }))).toBe(false);
    });
  });

  describe('orderSeen', () => {
    const pred = compileCondition({ kind: 'orderSeen', sequence: ['a', 'b'] });
    it('matches when the nodes appear in order, even non-adjacently', () => {
      expect(pred(makeState({ history: ['a', 'x', 'b'] }))).toBe(true);
      expect(pred(makeState({ history: ['a', 'b'] }))).toBe(true);
    });
    it('does not match the reverse order', () => {
      expect(pred(makeState({ history: ['b', 'a'] }))).toBe(false);
    });
  });

  describe('boolean combinators', () => {
    it('and requires every clause', () => {
      const pred = compileCondition({
        kind: 'and',
        clauses: [
          { kind: 'flag', key: 'a' },
          { kind: 'visited', node: 'x' },
        ],
      });
      expect(pred(makeState({ flags: { a: true }, visitCounts: { x: 1 } }))).toBe(true);
      expect(pred(makeState({ flags: { a: true } }))).toBe(false);
    });

    it('or requires at least one clause', () => {
      const pred = compileCondition({
        kind: 'or',
        clauses: [
          { kind: 'flag', key: 'a' },
          { kind: 'flag', key: 'b' },
        ],
      });
      expect(pred(makeState({ flags: { b: true } }))).toBe(true);
      expect(pred(makeState())).toBe(false);
    });

    it('not negates its clause', () => {
      const pred = compileCondition({ kind: 'not', clause: { kind: 'flag', key: 'a' } });
      expect(pred(makeState())).toBe(true);
      expect(pred(makeState({ flags: { a: true } }))).toBe(false);
    });

    it('nests combinators (and / not / orderSeen)', () => {
      // visited whisperSource AND NOT (whisperSource before echoChamber)
      const pred = compileCondition({
        kind: 'and',
        clauses: [
          { kind: 'visited', node: 'whisperSource' },
          { kind: 'not', clause: { kind: 'orderSeen', sequence: ['whisperSource', 'echoChamber'] } },
        ],
      });
      // echo first, then whisper → visited, but NOT in [whisper, echo] order
      expect(
        pred(makeState({ visitCounts: { whisperSource: 1 }, history: ['echoChamber', 'whisperSource'] }))
      ).toBe(true);
      // whisper first → the orderSeen holds, so the `not` fails
      expect(
        pred(makeState({ visitCounts: { whisperSource: 1 }, history: ['whisperSource', 'echoChamber'] }))
      ).toBe(false);
    });
  });
});

describe('isConditionSpec', () => {
  it('accepts well-formed specs', () => {
    expect(isConditionSpec({ kind: 'flag', key: 'a' })).toBe(true);
    expect(isConditionSpec({ kind: 'visited', node: 'x' })).toBe(true);
    expect(isConditionSpec({ kind: 'and', clauses: [{ kind: 'flag', key: 'a' }] })).toBe(true);
  });

  it('accepts the visit-count and recency kinds', () => {
    expect(isConditionSpec({ kind: 'notVisited', node: 'x' })).toBe(true);
    expect(isConditionSpec({ kind: 'visitedCountAcross', nodes: ['a', 'b'] })).toBe(true);
    expect(isConditionSpec({ kind: 'withinNSteps', node: 'x', steps: 2 })).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isConditionSpec(null)).toBe(false);
    expect(isConditionSpec({ kind: 'bogus' })).toBe(false);
    expect(isConditionSpec({ kind: 'flag' })).toBe(false);
    expect(isConditionSpec({ kind: 'and', clauses: [{ kind: 'nope' }] })).toBe(false);
    expect(isConditionSpec({ kind: 'notVisited' })).toBe(false);
    expect(isConditionSpec({ kind: 'visitedCountAcross', nodes: [1, 2] })).toBe(false);
    expect(isConditionSpec({ kind: 'withinNSteps', node: 'x' })).toBe(false);
  });
});

describe('describeCondition', () => {
  it('renders each kind as a readable explanation', () => {
    expect(describeCondition({ kind: 'flag', key: 'convergenceUnlocked' })).toContain(
      'convergenceUnlocked'
    );
    expect(describeCondition({ kind: 'visited', node: 'echoChamber' })).toBe(
      'you have visited echoChamber'
    );
    expect(
      describeCondition({ kind: 'visited', node: 'echoChamber', op: '>=', count: 2 })
    ).toBe('you have visited echoChamber at least 2 times');
    expect(describeCondition({ kind: 'notVisited', node: 'silenceSource' })).toBe(
      'you have not visited silenceSource'
    );
    expect(describeCondition({ kind: 'withinNSteps', node: 'whisperSource', steps: 3 })).toBe(
      'you visited whisperSource within the last 3 steps'
    );
    expect(
      describeCondition({ kind: 'historyEndsWith', sequence: ['a', 'b'] })
    ).toBe('you arrived here via a → b');
    expect(
      describeCondition({ kind: 'orderSeen', sequence: ['a', 'b'] })
    ).toBe('you saw a → b in that order');
  });

  it('resolves node labels and composes boolean clauses', () => {
    const label = (id: string) => (id === 'echoChamber' ? 'the Echo Chamber' : id);
    expect(
      describeCondition(
        {
          kind: 'and',
          clauses: [
            { kind: 'visited', node: 'echoChamber' },
            { kind: 'not', clause: { kind: 'flag', key: 'done' } },
          ],
        },
        label
      )
    ).toBe('you have visited the Echo Chamber and not (the “done” state is set)');
  });
});

describe('parseConditionSpec / compileConditionFromString', () => {
  it('parses a valid serialized spec', () => {
    const spec = parseConditionSpec(JSON.stringify({ kind: 'flag', key: 'a' }));
    expect(spec).toEqual({ kind: 'flag', key: 'a' });
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseConditionSpec('{not json')).toBeUndefined();
  });

  it('returns undefined for valid JSON that is not a spec', () => {
    expect(parseConditionSpec(JSON.stringify({ kind: 'unknown' }))).toBeUndefined();
  });

  it('compiles directly from a string, or yields undefined', () => {
    const pred = compileConditionFromString(JSON.stringify({ kind: 'flag', key: 'a' }));
    expect(pred?.(makeState({ flags: { a: true } }))).toBe(true);
    expect(compileConditionFromString('{not json')).toBeUndefined();
  });
});
