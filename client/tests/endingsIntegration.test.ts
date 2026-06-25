import { describe, it, expect, beforeEach } from 'vitest';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import storyLogicService from '../src/services/StoryLogicService';
import type { StoryState } from '../src/context/StoryTypes';

// Drive a playthrough the way StoryProvider does: VISIT_NODE, then run the rule
// engine and apply any flags, after every step.
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

describe('order-based endings fire through the real engine', () => {
  beforeEach(() => storyLogicService.reset());

  it('chorus unlocks once all three sources are seen (any order)', () => {
    const s = play(['pathB', 'echoChamber', 'pathA', 'whisperSource', 'pathC', 'silenceSource']);
    expect(s.flags.chorusUnlocked).toBe(true);
  });

  it('descent fires for whisper → echo → silence ending the history', () => {
    // Visit all three first (so the resonance choices exist), then walk them in order.
    const s = play([
      'pathA', 'whisperSource', 'pathB', 'echoChamber', 'pathC', 'silenceSource',
      'whisperSource', 'echoChamber', 'silenceSource',
    ]);
    expect(s.flags.descentDiscovered).toBe(true);
    expect(s.flags.emergenceDiscovered).toBeFalsy();
  });

  it('emergence fires for silence → echo → whisper ending the history', () => {
    const s = play([
      'pathA', 'whisperSource', 'pathB', 'echoChamber', 'pathC', 'silenceSource',
      'silenceSource', 'echoChamber', 'whisperSource',
    ]);
    expect(s.flags.emergenceDiscovered).toBe(true);
    expect(s.flags.descentDiscovered).toBeFalsy();
  });

  it('persistence fires for whisper → silence → echo ending the history', () => {
    const s = play([
      'pathA', 'whisperSource', 'pathB', 'echoChamber', 'pathC', 'silenceSource',
      'whisperSource', 'silenceSource', 'echoChamber',
    ]);
    expect(s.flags.persistenceDiscovered).toBe(true);
    expect(s.flags.descentDiscovered).toBeFalsy();
    expect(s.flags.emergenceDiscovered).toBeFalsy();
  });

  it('seeing only two sources does NOT unlock chorus', () => {
    const s = play(['pathA', 'whisperSource', 'pathB', 'echoChamber']);
    expect(s.flags.chorusUnlocked).toBeFalsy();
  });
});
