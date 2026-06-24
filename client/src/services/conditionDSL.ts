// client/src/services/conditionDSL.ts
//
// A tiny *serializable* condition language for StoryChoice.condition.
//
// The problem this solves: StoryChoice.condition is a `(state) => boolean`
// predicate. Functions can't be shipped over JSON, so conditions authored only
// as functions in InitialState.ts work in the offline-fallback path but VANISH
// when the backend serves the graph (storyMapper used to drop them, and the
// server stores `condition` as a string).
//
// Instead we author conditions as plain-data `ConditionSpec` objects and compile
// them to predicates with `compileCondition`. The SAME compiler is used in both
// places, so behaviour is identical regardless of where the graph came from:
//   - InitialState.ts compiles specs inline (offline fallback).
//   - storyMapper.ts parses the spec from the server's `condition` *string*
//     (`compileConditionFromString`) and compiles it.
// server/seed.js stores each condition as `JSON.stringify(spec)` so the two
// paths stay in sync.
import { StoryState } from '../context/StoryTypes';

type ComparisonOp = '>' | '>=' | '<' | '<=' | '==';

/**
 * A declarative, JSON-serializable condition. Compile it with
 * {@link compileCondition} to get a `(state) => boolean` predicate.
 */
export type ConditionSpec =
  // A flag is set (truthy), or equals a specific value when `equals` is given.
  | { kind: 'flag'; key: string; equals?: boolean | number | string }
  // A node's visit count compares against `count` (default: visited at least once).
  | { kind: 'visited'; node: string; op?: ComparisonOp; count?: number }
  // The visit history ends with this exact consecutive sequence (visit ORDER).
  | { kind: 'historyEndsWith'; sequence: string[] }
  // These nodes were visited in this relative order (not necessarily adjacent).
  | { kind: 'orderSeen'; sequence: string[] }
  | { kind: 'and'; clauses: ConditionSpec[] }
  | { kind: 'or'; clauses: ConditionSpec[] }
  | { kind: 'not'; clause: ConditionSpec };

type Predicate = (state: StoryState) => boolean;

function compare(actual: number, op: ComparisonOp, expected: number): boolean {
  switch (op) {
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '==':
      return actual === expected;
  }
}

function endsWith(history: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > history.length) return false;
  const tail = history.slice(-sequence.length);
  return sequence.every((id, i) => tail[i] === id);
}

function seenInOrder(history: string[], sequence: string[]): boolean {
  let cursor = 0;
  for (const id of history) {
    if (id === sequence[cursor]) cursor += 1;
    if (cursor === sequence.length) return true;
  }
  return sequence.length === 0;
}

/** Compile a spec into a predicate over StoryState. */
export function compileCondition(spec: ConditionSpec): Predicate {
  switch (spec.kind) {
    case 'flag':
      return (state) =>
        spec.equals === undefined
          ? Boolean(state.flags[spec.key])
          : state.flags[spec.key] === spec.equals;
    case 'visited':
      return (state) =>
        compare(state.visitCounts[spec.node] ?? 0, spec.op ?? '>=', spec.count ?? 1);
    case 'historyEndsWith':
      return (state) => endsWith(state.history, spec.sequence);
    case 'orderSeen':
      return (state) => seenInOrder(state.history, spec.sequence);
    case 'and': {
      const compiled = spec.clauses.map(compileCondition);
      return (state) => compiled.every((p) => p(state));
    }
    case 'or': {
      const compiled = spec.clauses.map(compileCondition);
      return (state) => compiled.some((p) => p(state));
    }
    case 'not': {
      const compiled = compileCondition(spec.clause);
      return (state) => !compiled(state);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Structural validation so we never `eval` or trust arbitrary server data. */
export function isConditionSpec(value: unknown): value is ConditionSpec {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  switch (value.kind) {
    case 'flag':
      return typeof value.key === 'string';
    case 'visited':
      return typeof value.node === 'string';
    case 'historyEndsWith':
    case 'orderSeen':
      return isStringArray(value.sequence);
    case 'and':
    case 'or':
      return Array.isArray(value.clauses) && value.clauses.every(isConditionSpec);
    case 'not':
      return isConditionSpec(value.clause);
    default:
      return false;
  }
}

/** Parse + validate a serialized spec (returns undefined if malformed). */
export function parseConditionSpec(raw: string): ConditionSpec | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  return isConditionSpec(parsed) ? parsed : undefined;
}

/**
 * Parse a serialized spec string (as stored on the server) and compile it.
 * Returns undefined when the string is missing or malformed, so the caller can
 * treat the choice as unconditional.
 */
export function compileConditionFromString(raw: string): Predicate | undefined {
  const spec = parseConditionSpec(raw);
  return spec ? compileCondition(spec) : undefined;
}
