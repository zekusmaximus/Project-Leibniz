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
  // A node has never been visited (visit count is 0).
  | { kind: 'notVisited'; node: string }
  // The SUMMED visit count across several nodes compares against `count`
  // (default: at least once between them). Lets a variant react to how much of
  // the map the reader has wandered, not just one node.
  | { kind: 'visitedCountAcross'; nodes: string[]; op?: ComparisonOp; count?: number }
  // The node was visited within the last `steps` entries of history — recency,
  // as opposed to `visited` which is true forever once a node is seen.
  | { kind: 'withinNSteps'; node: string; steps: number }
  // The visit history ends with this exact consecutive sequence (visit ORDER).
  | { kind: 'historyEndsWith'; sequence: string[] }
  // The visit history *begins* with this exact consecutive sequence — how the
  // run opened, which `historyEndsWith` (the tail) can't express.
  | { kind: 'historyStartsWith'; sequence: string[] }
  // These nodes were visited in this relative order (not necessarily adjacent).
  | { kind: 'orderSeen'; sequence: string[] }
  // `second` was visited in the step immediately after `first`, anywhere in
  // history (adjacency). Unlike `orderSeen` (gaps allowed) or `historyEndsWith`
  // (tail only), this catches a direct hop in the middle of a run.
  | { kind: 'visitedImmediatelyAfter'; first: string; second: string }
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

function startsWith(history: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > history.length) return false;
  return sequence.every((id, i) => history[i] === id);
}

function visitedImmediatelyAfter(history: string[], first: string, second: string): boolean {
  for (let i = 1; i < history.length; i += 1) {
    if (history[i] === second && history[i - 1] === first) return true;
  }
  return false;
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
    case 'notVisited':
      return (state) => (state.visitCounts[spec.node] ?? 0) === 0;
    case 'visitedCountAcross':
      return (state) =>
        compare(
          spec.nodes.reduce((sum, node) => sum + (state.visitCounts[node] ?? 0), 0),
          spec.op ?? '>=',
          spec.count ?? 1
        );
    case 'withinNSteps':
      return (state) =>
        spec.steps > 0 && state.history.slice(-spec.steps).includes(spec.node);
    case 'historyEndsWith':
      return (state) => endsWith(state.history, spec.sequence);
    case 'historyStartsWith':
      return (state) => startsWith(state.history, spec.sequence);
    case 'orderSeen':
      return (state) => seenInOrder(state.history, spec.sequence);
    case 'visitedImmediatelyAfter':
      return (state) => visitedImmediatelyAfter(state.history, spec.first, spec.second);
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
    case 'notVisited':
      return typeof value.node === 'string';
    case 'visitedCountAcross':
      return isStringArray(value.nodes);
    case 'withinNSteps':
      return typeof value.node === 'string' && typeof value.steps === 'number';
    case 'historyEndsWith':
    case 'historyStartsWith':
    case 'orderSeen':
      return isStringArray(value.sequence);
    case 'visitedImmediatelyAfter':
      return typeof value.first === 'string' && typeof value.second === 'string';
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

function describeCount(op: ComparisonOp, count: number): string {
  const times = `${count} time${count === 1 ? '' : 's'}`;
  switch (op) {
    case '>':
      return `more than ${times}`;
    case '>=':
      return `at least ${times}`;
    case '<':
      return `fewer than ${times}`;
    case '<=':
      return `at most ${times}`;
    case '==':
      return `exactly ${times}`;
  }
}

/**
 * Render a ConditionSpec as a short, human-readable explanation — used to tell
 * the reader *why* an adaptive text fragment appeared. `resolveLabel` maps a
 * node id to a display name (defaults to the raw id), so callers with the story
 * state can show "the Echo Chamber" instead of "echoChamber".
 */
export function describeCondition(
  spec: ConditionSpec,
  resolveLabel: (nodeId: string) => string = (id) => id
): string {
  switch (spec.kind) {
    case 'flag':
      return spec.equals === undefined
        ? `the “${spec.key}” state is set`
        : `“${spec.key}” equals ${String(spec.equals)}`;
    case 'visited': {
      const op = spec.op ?? '>=';
      const count = spec.count ?? 1;
      return op === '>=' && count === 1
        ? `you have visited ${resolveLabel(spec.node)}`
        : `you have visited ${resolveLabel(spec.node)} ${describeCount(op, count)}`;
    }
    case 'notVisited':
      return `you have not visited ${resolveLabel(spec.node)}`;
    case 'visitedCountAcross':
      return `you have visited ${spec.nodes.map(resolveLabel).join(', ')} ${describeCount(
        spec.op ?? '>=',
        spec.count ?? 1
      )} in total`;
    case 'withinNSteps':
      return `you visited ${resolveLabel(spec.node)} within the last ${spec.steps} steps`;
    case 'historyEndsWith':
      return `you arrived here via ${spec.sequence.map(resolveLabel).join(' → ')}`;
    case 'historyStartsWith':
      return `you began with ${spec.sequence.map(resolveLabel).join(' → ')}`;
    case 'orderSeen':
      return `you saw ${spec.sequence.map(resolveLabel).join(' → ')} in that order`;
    case 'visitedImmediatelyAfter':
      return `you went straight from ${resolveLabel(spec.first)} to ${resolveLabel(spec.second)}`;
    case 'and':
      return spec.clauses.map((c) => describeCondition(c, resolveLabel)).join(' and ');
    case 'or':
      return spec.clauses.map((c) => describeCondition(c, resolveLabel)).join(' or ');
    case 'not':
      return `not (${describeCondition(spec.clause, resolveLabel)})`;
  }
}
