// client/src/context/StoryTypes.ts
import type { ConditionSpec } from '../services/conditionDSL';

export interface TextVariant {
  id: string;
  text: string;
  priority: number;
  condition: ConditionSpec;
}

// --- Compositional "morphing" prose (the beats model) ---------------------
//
// A node's prose can be authored as an ordered list of BEATS instead of (or as
// well as) a flat `text` + appended `textVariants`. Each beat resolves to AT
// MOST ONE phrasing — the highest-priority phrasing whose `when` matches, or the
// conditionless default — and the chosen phrasings are woven into continuous
// prose. This lets the SENTENCE itself morph by path/order, rather than only
// appending a fragment. See services/StoryLogicService.renderProse.
//
// Conditions are authored in the canonical storyGraph.json as serialized
// ConditionSpec strings (exactly like textVariants/choices) and parsed back into
// ConditionSpec objects by storyMapper. A node with no `prose` falls back to the
// legacy `text` + `textVariants` rendering, so migration is incremental.

export interface ProsePhrasing {
  // Optional stable id (handy for "why this text?" reasons and integrity checks).
  id?: string;
  // The prose for this phrasing. The highest-priority phrasing whose `when`
  // matches wins; a phrasing with no `when` is the beat's default.
  text: string;
  priority?: number;
  when?: ConditionSpec;
}

export interface ProseBeat {
  id: string;
  // When present and false for the current state, the whole beat is omitted.
  includeWhen?: ConditionSpec;
  phrasings: ProsePhrasing[];
}

export interface StoryNode {
  id: string;
  label: string;
  text: string;
  choices?: StoryChoice[];
  textVariants?: TextVariant[];
  prose?: ProseBeat[];
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  visitedCount: number;
  isRevealed: boolean;
}

export interface StoryChoice {
  targetId: string;
  text: string;
  condition?: (state: StoryState) => boolean;
}

export interface StoryLink {
  source: string;
  target: string;
  color?: string;
  width?: number;
  isRevealed: boolean;
  // Optional connective prose for the TRAVERSAL of this edge — a short bridge
  // between the source and target sections, woven by the same beats model as
  // node prose (so a crossing can morph by state). Used by the novel export (and
  // the narrative page) to read less like discrete blocks. See renderTransition.
  prose?: ProseBeat[];
}

export interface StoryState {
  nodes: Record<string, StoryNode>;
  links: StoryLink[];
  currentNodeId: string;
  visitCounts: Record<string, number>;
  flags: Record<string, boolean | number | string>;
  history: string[];
}

// Renamed from StoryContextValue to StoryContextType to be consistent
export interface StoryContextType {
  state: StoryState;
  visitNode: (nodeId: string) => void;
  revealNode: (nodeId: string, nodeData: Partial<StoryNode>) => void;
  revealLink: (link: StoryLink) => void;
  setFlag: (key: string, value: boolean | number | string) => void;
  resetStory: () => void;
  loadStory: (state: StoryState) => void;
  getCurrentNode: () => StoryNode | undefined;
  getVisibleNodes: () => StoryNode[];
  getVisibleLinks: () => StoryLink[];
  dispatch: React.Dispatch<StoryAction>; // Add dispatch function
  // Backend integration
  isLoading: boolean;                    // true while the initial story graph is being fetched
  saveProgress: () => Promise<boolean>;  // persist current progress to the backend
}

// Define action types
export type StoryAction = 
  | { type: 'VISIT_NODE'; nodeId: string }
  | { type: 'REVEAL_NODE'; nodeId: string; nodeData: Partial<StoryNode> }
  | { type: 'REVEAL_LINK'; link: StoryLink }
  | { type: 'SET_FLAG'; key: string; value: boolean | number | string }
  | { type: 'RESET_STORY' }
  | { type: 'LOAD_STORY'; state: StoryState }
  | { type: 'UPDATE_NODE_POSITIONS'; nodes: { id: string; x: number; y: number }[] };
