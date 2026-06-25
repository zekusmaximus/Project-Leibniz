// client/tests/proseMorph.test.ts
//
// The compositional "morphing" prose engine: beats select one phrasing each
// (highest matching priority, else default), omit beats whose includeWhen fails,
// and weave the rest into continuous prose. First, the selection rules in
// isolation; then the real whisperSource node morphing through the live engine.
import { describe, it, expect, beforeEach } from 'vitest';
import storyLogicService from '../src/services/StoryLogicService';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import { makeState, makeNode } from './helpers';
import type { StoryState, ProseBeat } from '../src/context/StoryTypes';

function play(sequence: string[]): StoryState {
  storyLogicService.reset();
  let state: StoryState = InitialState;
  for (const nodeId of sequence) {
    state = storyReducer(state, { type: 'VISIT_NODE', nodeId });
    const changes = storyLogicService.evaluateState(state);
    for (const [key, value] of Object.entries(changes.flags ?? {})) {
      state = storyReducer(state, { type: 'SET_FLAG', key, value });
    }
  }
  return state;
}

beforeEach(() => storyLogicService.reset());

describe('renderProse — beat selection', () => {
  const beats: ProseBeat[] = [
    {
      id: 'arrival',
      phrasings: [
        { id: 'hi', priority: 50, when: { kind: 'flag', key: 'big' }, text: 'HIGH' },
        { id: 'lo', priority: 10, when: { kind: 'flag', key: 'big' }, text: 'LOW' },
        { id: 'def', text: 'DEFAULT' },
      ],
    },
    {
      id: 'maybe',
      includeWhen: { kind: 'flag', key: 'show' },
      phrasings: [{ id: 'only', text: 'EXTRA' }],
    },
  ];
  const node = (flags: Record<string, boolean> = {}) =>
    makeState({ nodes: { n: makeNode({ id: 'n', text: 'base', prose: beats }) }, flags });

  it('picks the highest-priority matching phrasing per beat', () => {
    const r = storyLogicService.renderProse('n', node({ big: true }));
    expect(r.chosen.map((c) => c.phrasingId)).toEqual(['hi']); // 'maybe' omitted (show false)
    expect(r.text).toBe('HIGH');
  });

  it('falls back to the default phrasing when no condition matches', () => {
    expect(storyLogicService.renderProse('n', node({})).text).toBe('DEFAULT');
  });

  it('omits a beat whose includeWhen fails and weaves the included beats in order', () => {
    const r = storyLogicService.renderProse('n', node({ big: true, show: true }));
    expect(r.text).toBe('HIGH EXTRA');
    expect(r.chosen.map((c) => c.beatId)).toEqual(['arrival', 'maybe']);
  });

  it('getNodeText routes through prose when a node has beats', () => {
    expect(storyLogicService.getNodeText('n', node({ show: true }))).toBe('DEFAULT EXTRA');
  });

  it('getActiveAdaptations surfaces only conditionally-chosen phrasings (defaults omitted)', () => {
    const active = storyLogicService.getActiveAdaptations('n', node({ big: true, show: true }));
    // 'hi' fired on a condition; 'only' (EXTRA) is a default → no path-specific reason.
    expect(active.map((a) => a.id)).toEqual(['hi']);
  });
});

describe('whisperSource morphs through the real engine', () => {
  it('reads fresh on a first solo arrival', () => {
    const text = storyLogicService.getNodeText('whisperSource', play(['start', 'whisperSource']));
    expect(text).toContain('a voice that has never had to answer another');
    expect(text).not.toContain('echoes you heard in the other chamber');
  });

  it('morphs the arrival sentence when crossed straight from the echoes', () => {
    const text = storyLogicService.getNodeText(
      'whisperSource',
      play(['start', 'pathB', 'echoChamber', 'whisperSource'])
    );
    expect(text).toContain('still warm with echoes');
  });

  it('adds the silence-mark beat after the Null and reads its recency', () => {
    // Straight from the Null → the recency phrasing.
    const recent = storyLogicService.getNodeText(
      'whisperSource',
      play(['start', 'pathC', 'silenceSource', 'whisperSource'])
    );
    expect(recent).toContain('Null is still cold on you');

    // Silence seen, but several steps ago → the steady "after the Null" phrasing.
    const distant = storyLogicService.getNodeText(
      'whisperSource',
      play(['start', 'pathC', 'silenceSource', 'pathC', 'start', 'whisperSource'])
    );
    expect(distant).toContain('After the Null, the crystal');
    expect(distant).not.toContain('still cold on you');
  });

  it('drops the first-arrival prose on a revisit and deepens instead', () => {
    const text = storyLogicService.getNodeText(
      'whisperSource',
      play(['start', 'whisperSource', 'whisperSource'])
    );
    expect(text).toContain('It already knows you');
    expect(text).not.toContain('You find the source of the whispers');
  });
});
