// client/src/context/StoryTypes.ts
export interface StoryNode {
  id: string;
  label: string;
  text: string;
  choices?: StoryChoice[];
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
