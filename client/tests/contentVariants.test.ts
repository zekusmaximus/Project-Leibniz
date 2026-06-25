// client/tests/contentVariants.test.ts
//
// Drives real playthroughs through the reducer + rule engine and asserts that
// the order-sensitive text variants authored in storyGraph.json actually surface
// for the right visit ORDER (and stay hidden for the wrong one). graphIntegrity
// proves the conditions parse; this proves they FIRE. Covers the variants that
// lean on the newer condition kinds — historyStartsWith (the opening move) and
// visitedImmediatelyAfter (a direct hop) — plus a deep-revisit reincorporation.
import { describe, it, expect, beforeEach } from 'vitest';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import storyLogicService from '../src/services/StoryLogicService';
import type { StoryState } from '../src/context/StoryTypes';

// Same harness as endingsIntegration: VISIT_NODE, then run the rule engine and
// apply any flag changes, after every step.
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

const variantIds = (nodeId: string, state: StoryState): string[] =>
  storyLogicService.getMatchingVariants(nodeId, state).map((v) => v.id);

// For nodes authored in the compositional `prose` (beats) model, the unit that
// fires is a chosen phrasing, not a textVariant. This returns the phrasing/beat
// id chosen for each beat (defaults included, unlike getActiveAdaptations).
const chosenIds = (nodeId: string, state: StoryState): string[] =>
  storyLogicService.renderProse(nodeId, state).chosen.map((c) => c.phrasingId ?? c.beatId);

describe('order-sensitive content variants fire through the real engine', () => {
  beforeEach(() => storyLogicService.reset());

  describe('historyStartsWith — the opening move', () => {
    it('reflects the silence opening on the anomaly, not the others', () => {
      const ids = variantIds('start', play(['start', 'pathC', 'silenceSource']));
      expect(ids).toContain('opened-with-silence');
      expect(ids).not.toContain('opened-with-whispers');
      expect(ids).not.toContain('opened-with-echoes');
    });

    it('reflects the whisper opening on the anomaly', () => {
      const ids = variantIds('start', play(['start', 'pathA', 'whisperSource']));
      expect(ids).toContain('opened-with-whispers');
      expect(ids).not.toContain('opened-with-silence');
    });

    it('marks the Null as the first descent only when silence opened the run', () => {
      const silenceFirst = variantIds('silenceSource', play(['start', 'pathC', 'silenceSource']));
      expect(silenceFirst).toContain('silence-first');
      // Same node reached, but the run opened with whispers → no "first descent".
      const whisperFirst = variantIds(
        'silenceSource',
        play(['start', 'pathA', 'whisperSource', 'pathC', 'silenceSource'])
      );
      expect(whisperFirst).not.toContain('silence-first');
    });
  });

  describe('visitedImmediatelyAfter — a direct hop', () => {
    // whisperSource is authored in the prose/beats model: the arrival beat MORPHS
    // its sentence by route — a direct echo→whisper hop vs. a detour vs. fresh.
    it('morphs the crystal arrival to the straight crossing only when adjacent', () => {
      const adjacent = chosenIds(
        'whisperSource',
        play(['start', 'pathB', 'echoChamber', 'whisperSource'])
      );
      expect(adjacent).toContain('crossed-from-echoes');

      // Echoes seen, then a detour, THEN the crystal → not a direct hop. The
      // arrival morphs to the weaker "heard-echoes" phrasing, not the adjacency one.
      const detoured = chosenIds(
        'whisperSource',
        play(['start', 'pathB', 'echoChamber', 'pathA', 'whisperSource'])
      );
      expect(detoured).not.toContain('crossed-from-echoes');
      expect(detoured).toContain('heard-echoes');
    });

    it('fires the straight crossing into the chamber', () => {
      const ids = variantIds(
        'echoChamber',
        play(['start', 'pathA', 'whisperSource', 'echoChamber'])
      );
      expect(ids).toContain('crossed-from-whispers');
    });

    it('fires carrying a voice straight into the Null (either source)', () => {
      const fromWhisper = variantIds(
        'silenceSource',
        play(['start', 'pathA', 'whisperSource', 'silenceSource'])
      );
      expect(fromWhisper).toContain('voice-carried-straight');

      const fromEcho = variantIds(
        'silenceSource',
        play(['start', 'pathB', 'echoChamber', 'silenceSource'])
      );
      expect(fromEcho).toContain('voice-carried-straight');
    });
  });

  describe('deep-revisit reincorporation', () => {
    it('wears the crystal to glass only after the third visit (prose beats)', () => {
      const twice = chosenIds('whisperSource', play(['start', 'whisperSource', 'whisperSource']));
      expect(twice).toContain('revisit-crystal'); // return-depth beat, >= 2
      expect(twice).not.toContain('crystal-worn'); // needs >= 3

      const thrice = chosenIds(
        'whisperSource',
        play(['start', 'whisperSource', 'whisperSource', 'whisperSource'])
      );
      expect(thrice).toContain('crystal-worn');
    });
  });
});
