// client/tests/conditionDSL.test.ts
import { describe, it, expect } from 'vitest';
import {
  compileCondition,
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

  it('rejects malformed values', () => {
    expect(isConditionSpec(null)).toBe(false);
    expect(isConditionSpec({ kind: 'bogus' })).toBe(false);
    expect(isConditionSpec({ kind: 'flag' })).toBe(false);
    expect(isConditionSpec({ kind: 'and', clauses: [{ kind: 'nope' }] })).toBe(false);
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
