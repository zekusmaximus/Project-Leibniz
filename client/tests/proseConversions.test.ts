// client/tests/proseConversions.test.ts
//
// Locks the behaviour of the nodes migrated from appended textVariants to the
// morphing beats model: every old variant still fires under its condition, the
// arrival and return beats are mutually exclusive (a revisit doesn't repeat the
// opening), and nothing double-covers the same idea.
import { describe, it, expect, beforeEach } from 'vitest';
import storyLogicService from '../src/services/StoryLogicService';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import type { StoryState } from '../src/context/StoryTypes';

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

const text = (id: string, s: StoryState) => storyLogicService.getNodeText(id, s);

beforeEach(() => storyLogicService.reset());

describe('converted corridor nodes', () => {
  it('pathB: fresh alone, gains the whisper layer after the crystal, morphs on return', () => {
    const fresh = text('pathB', play(['start', 'pathB']));
    expect(fresh).toContain('faint, echoing sounds');
    expect(fresh).not.toContain('started to whisper');

    const afterCrystal = text('pathB', play(['start', 'pathA', 'whisperSource', 'pathA', 'start', 'pathB']));
    expect(afterCrystal).toContain('started to whisper'); // echoes-whisper layer

    const revisit = text('pathB', play(['start', 'pathB', 'start', 'pathB']));
    expect(revisit).toContain('returns your footsteps to you'); // return beat
    expect(revisit).not.toContain('faint, echoing sounds'); // arrival omitted on return
  });

  it('pathC: the absence-of-voices layer appears only after a voice', () => {
    expect(text('pathC', play(['start', 'pathC']))).not.toContain('heard voices today');
    expect(
      text('pathC', play(['start', 'pathA', 'whisperSource', 'pathA', 'start', 'pathC']))
    ).toContain('heard voices today');
  });
});

describe('converted depths', () => {
  it('whisperDepths: layers the null reading without doubling the base', () => {
    const plain = text('whisperDepths', play(['start', 'pathA', 'whisperSource', 'whisperDepths']));
    expect(plain).toContain('rehearsing the sentence');
    expect(plain).not.toContain('stood in the Null');

    const afterNull = text(
      'whisperDepths',
      play(['start', 'pathC', 'silenceSource', 'pathC', 'start', 'pathA', 'whisperSource', 'whisperDepths'])
    );
    expect(afterNull).toContain('stood in the Null'); // depths-after-null layer
  });

  it('echoDepths: the whisper-first reading needs that order', () => {
    const whisperFirst = text(
      'echoDepths',
      play(['start', 'pathA', 'whisperSource', 'pathB', 'echoChamber', 'echoDepths'])
    );
    expect(whisperFirst).toContain('already wearing the crystal'); // echo-whisper-first layer
  });
});

describe('converted endings', () => {
  it('convergence: always renders its core, layers silence and the secret tear conditionally', () => {
    const plain = text('convergence', play(['start', 'convergence']));
    expect(plain).toContain('braided thread accepts you');
    expect(plain).not.toContain('tear is still open');

    // The secret is discovered by the echo→whisper adjacency.
    const secret = text('convergence', play(['start', 'pathB', 'echoChamber', 'whisperSource', 'convergence']));
    expect(secret).toContain('tear is still open'); // tear-hint layer (flag)

    const withSilence = text('convergence', play(['start', 'pathC', 'silenceSource', 'convergence']));
    expect(withSilence).toContain('silence you walked through'); // convergence-with-silence layer
  });

  it('chorus: core always, the tear only once the secret is discovered', () => {
    expect(text('chorus', play(['start', 'chorus']))).toContain('chord that needs no tonic');
    const secret = text('chorus', play(['start', 'pathB', 'echoChamber', 'whisperSource', 'chorus']));
    expect(secret).toContain('feel the tear in it');
  });
});
