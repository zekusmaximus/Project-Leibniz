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
