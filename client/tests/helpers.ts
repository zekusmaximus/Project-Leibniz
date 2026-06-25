// client/tests/helpers.ts
// Small builders so tests can construct StoryState / StoryNode fixtures without
// repeating every required field.
import type { StoryState, StoryNode } from '../src/context/StoryTypes';

export function makeState(partial: Partial<StoryState> = {}): StoryState {
  return {
    nodes: {},
    links: [],
    currentNodeId: '',
    visitCounts: {},
    flags: {},
    history: [],
    ...partial,
  };
}

export function makeNode(partial: Partial<StoryNode> & { id: string }): StoryNode {
  return {
    label: partial.id,
    text: '',
    visitedCount: 0,
    isRevealed: false,
    ...partial,
  };
}
