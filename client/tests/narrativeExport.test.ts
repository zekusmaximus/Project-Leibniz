// client/tests/narrativeExport.test.ts
//
// The downloadable "novel": buildTranscript replays a run's history and captures
// the prose as experienced at each step (repeats kept), and toMarkdown serializes
// it with front matter. The crucial property is faithfulness — a section reads as
// it did THEN, not as the final state would render it.
import { describe, it, expect } from 'vitest';
import { storyReducer } from '../src/context/StoryReducer';
import { InitialState } from '../src/context/InitialState';
import storyLogicService from '../src/services/StoryLogicService';
import { buildTranscript, toMarkdown, novelFilename } from '../src/services/narrativeExport';
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

const REACH_CONVERGENCE = [
  'start', 'pathA', 'whisperSource', 'pathB', 'echoChamber', 'start', 'convergence',
];

describe('buildTranscript', () => {
  it('produces one section per visit, in order, with repeats kept', () => {
    const t = buildTranscript(play(['start', 'whisperSource', 'whisperSource']));
    expect(t.sections.map((s) => s.nodeId)).toEqual(['start', 'whisperSource', 'whisperSource']);
    expect(t.sections.map((s) => s.visitNumber)).toEqual([1, 1, 2]);
    expect(t.stepCount).toBe(3);
    expect(t.openingNodeId).toBe('start');
  });

  it('captures each section as it read THEN, not the final state', () => {
    const [, first, second] = buildTranscript(
      play(['start', 'whisperSource', 'whisperSource'])
    ).sections;
    // The first arrival is fresh discovery; the return drops it and deepens —
    // proof the prose is snapshotted per step, not rendered once at the end.
    expect(first.text).toContain('You find the source of the whispers');
    expect(second.text).toContain('It already knows you');
    expect(second.text).not.toContain('You find the source of the whispers');
  });

  it('marks the ending on the transcript', () => {
    const t = buildTranscript(play(REACH_CONVERGENCE));
    expect(t.endingId).toBe('convergence');
    expect(t.sections[t.sections.length - 1].isEnding).toBe(true);
  });
});

describe('toMarkdown', () => {
  it('renders front matter, a colophon, and a chapter per section', () => {
    const md = toMarkdown(buildTranscript(play(['start', 'whisperSource'])), {
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(md).toContain('# Eternal Return of the Digital Self');
    expect(md).toContain('**Opened with:** The Anomaly');
    expect(md).toContain('## 1. The Anomaly');
    expect(md).toContain('## 2. Source of Whispers');
    expect(md).toContain('2026-01-01T00:00:00.000Z');
  });

  it('labels a revisited section as a return', () => {
    const md = toMarkdown(buildTranscript(play(['start', 'whisperSource', 'whisperSource'])));
    expect(md).toContain('(return 2)');
  });

  it('is deterministic for a given path', () => {
    const a = toMarkdown(buildTranscript(play(['start', 'pathA', 'whisperSource'])), { generatedAt: 'x' });
    const b = toMarkdown(buildTranscript(play(['start', 'pathA', 'whisperSource'])), { generatedAt: 'x' });
    expect(a).toBe(b);
  });
});

describe('novelFilename', () => {
  it('names the file by the ending when one is reached', () => {
    expect(novelFilename(buildTranscript(play(REACH_CONVERGENCE)))).toBe('eternal-return-convergence.md');
  });
});
