// client/tests/storyLogicService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import storyLogicService from '../src/services/StoryLogicService';
import { makeState, makeNode } from './helpers';
import type { TextVariant } from '../src/context/StoryTypes';

// The service is a module singleton with a mutable variant cache and mutable
// once-rule state. Re-arm it before every test.
beforeEach(() => {
  storyLogicService.reset();
});

const variants: TextVariant[] = [
  { id: 'low', priority: 10, text: 'low prio', condition: { kind: 'flag', key: 'always' } },
  { id: 'high', priority: 90, text: 'high prio', condition: { kind: 'flag', key: 'always' } },
  { id: 'off', priority: 50, text: 'never', condition: { kind: 'flag', key: 'nope' } },
];

function nodeWithVariants() {
  return makeState({
    nodes: { n: makeNode({ id: 'n', text: 'base', textVariants: variants }) },
    flags: { always: true },
  });
}

describe('getMatchingVariants', () => {
  it('returns only matching variants, highest priority first', () => {
    const matched = storyLogicService.getMatchingVariants('n', nodeWithVariants());
    expect(matched.map((v) => v.id)).toEqual(['high', 'low']);
  });

  it('returns an empty array when the node has no variants', () => {
    const state = makeState({ nodes: { n: makeNode({ id: 'n' }) } });
    expect(storyLogicService.getMatchingVariants('n', state)).toEqual([]);
  });
});

describe('getNodeText', () => {
  it('appends matching variants to the base text, in priority order', () => {
    expect(storyLogicService.getNodeText('n', nodeWithVariants())).toBe('base\n\nhigh prio\n\nlow prio');
  });

  it('returns just the base text when nothing matches', () => {
    const state = makeState({
      nodes: { n: makeNode({ id: 'n', text: 'base', textVariants: [variants[2]] }) },
    });
    expect(storyLogicService.getNodeText('n', state)).toBe('base');
  });

  it('returns an empty string for an unknown node', () => {
    expect(storyLogicService.getNodeText('ghost', makeState())).toBe('');
  });
});

describe('getAdaptationLedger', () => {
  const v = (id: string, key: string): TextVariant => ({
    id,
    priority: 50,
    text: `${id} text`,
    condition: { kind: 'flag', key },
  });

  function ledgerState() {
    return makeState({
      nodes: {
        a: makeNode({ id: 'a', label: 'Alpha', textVariants: [v('a1', 'on')] }),
        b: makeNode({ id: 'b', label: 'Beta', textVariants: [v('b1', 'off')] }),
        c: makeNode({ id: 'c', label: 'Gamma', textVariants: [v('c1', 'on'), v('c2', 'on')] }),
      },
      flags: { on: true, off: false },
      // First-visit order: c (1), a (2); b never visited.
      history: ['c', 'a', 'c'],
    });
  }

  it('lists visited nodes with active variants, in first-visit order', () => {
    const ledger = storyLogicService.getAdaptationLedger(ledgerState());
    expect(ledger.map((e) => e.nodeId)).toEqual(['c', 'a']);
    expect(ledger.map((e) => e.visitOrder)).toEqual([1, 2]);
    expect(ledger[0].label).toBe('Gamma');
    expect(ledger[0].variants.map((x) => x.id)).toEqual(['c1', 'c2']);
  });

  it('omits visited nodes whose variants do not currently match', () => {
    // b is never visited; even if it were, its only variant is off.
    const ledger = storyLogicService.getAdaptationLedger(ledgerState());
    expect(ledger.find((e) => e.nodeId === 'b')).toBeUndefined();
  });

  it('is empty when nothing has adapted', () => {
    expect(storyLogicService.getAdaptationLedger(makeState())).toEqual([]);
  });
});

describe('evaluateState (rule engine)', () => {
  it('flags both-paths and source reveals once each branch is entered', () => {
    const changes = storyLogicService.evaluateState(
      makeState({ visitCounts: { pathA: 1, pathB: 1 } })
    );
    expect(changes.flags?.bothPathsVisited).toBe(true);
    expect(changes.flags?.whisperSourceRevealed).toBe(true);
    expect(changes.flags?.echoChamberRevealed).toBe(true);
  });

  it('unlocks convergence once both sources have been seen', () => {
    const changes = storyLogicService.evaluateState(
      makeState({ visitCounts: { whisperSource: 1, echoChamber: 1 } })
    );
    expect(changes.flags?.convergenceUnlocked).toBe(true);
  });

  it('discovers the secret path on the echo→whisper crossing', () => {
    const changes = storyLogicService.evaluateState(
      makeState({
        visitCounts: { echoChamber: 1, whisperSource: 1 },
        history: ['pathB', 'echoChamber', 'whisperSource'],
      })
    );
    expect(changes.flags?.secretPathDiscovered).toBe(true);
  });

  it('does not discover the secret path without the exact adjacency', () => {
    const changes = storyLogicService.evaluateState(
      makeState({
        visitCounts: { echoChamber: 1, whisperSource: 1 },
        history: ['echoChamber', 'pathB', 'whisperSource'],
      })
    );
    expect(changes.flags?.secretPathDiscovered).toBeUndefined();
  });
});

describe('isEnding', () => {
  it('recognises the terminal nodes', () => {
    expect(storyLogicService.isEnding('convergence')).toBe(true);
    expect(storyLogicService.isEnding('singularity')).toBe(true);
    expect(storyLogicService.isEnding('start')).toBe(false);
  });
});
