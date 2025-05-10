// client/src/context/StoryContext.tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Define types for our story nodes, links, and state
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

// Define action types
type ActionType = 
  | { type: 'VISIT_NODE'; nodeId: string }
  | { type: 'REVEAL_NODE'; nodeId: string; nodeData: Partial<StoryNode> }
  | { type: 'REVEAL_LINK'; link: StoryLink }
  | { type: 'SET_FLAG'; key: string; value: boolean | number | string }
  | { type: 'RESET_STORY' }
  | { type: 'LOAD_STORY'; state: StoryState };

// Initial state
const initialStoryContent: StoryNode[] = [
  {
    id: 'start',
    label: 'The Anomaly',
    text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
    choices: [
      { targetId: 'pathA', text: 'Follow the Path of Whispers' },
      { targetId: 'pathB', text: 'Follow the Path of Echoes' }
    ],
    color: 'orange',
    size: 20,
    visitedCount: 0,
    isRevealed: true
  },
  {
    id: 'pathA',
    label: 'Path of Whispers',
    text: "The Path of Whispers leads you down a corridor of shifting sounds. Voices speak in languages you almost understand.",
    choices: [
      { targetId: 'whisperSource', text: 'Investigate the source of whispers' },
      { targetId: 'start', text: 'Return to the anomaly' }
    ],
    color: 'skyblue',
    size: 15,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'pathB',
    label: 'Path of Echoes',
    text: "The Path of Echoes resonates with faint, echoing sounds of events that may or may not have happened.",
    choices: [
      { targetId: 'echoChamber', text: 'Follow the loudest echoes' },
      { targetId: 'start', text: 'Return to the anomaly' }
    ],
    color: 'lightgreen',
    size: 15,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'whisperSource',
    label: 'Source of Whispers',
    text: "You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.",
    choices: [
      { targetId: 'pathA', text: 'Go back to the corridor' }
    ],
    color: '#ADD8E6',
    size: 12,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'echoChamber',
    label: 'Echo Chamber',
    text: "The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.",
    choices: [
      { targetId: 'pathB', text: 'Retreat from the chamber' }
    ],
    color: '#90EE90',
    size: 12,
    visitedCount: 0,
    isRevealed: false
  }
];

const initialStoryLinks: StoryLink[] = [
  { source: 'start', target: 'pathA', color: '#777', isRevealed: false },
  { source: 'start', target: 'pathB', color: '#777', isRevealed: false },
  { source: 'pathA', target: 'whisperSource', color: 'skyblue', isRevealed: false },
  { source: 'pathB', target: 'echoChamber', color: 'lightgreen', isRevealed: false },
  { source: 'whisperSource', target: 'pathA', color: 'skyblue', isRevealed: false },
  { source: 'echoChamber', target: 'pathB', color: 'lightgreen', isRevealed: false },
  { source: 'pathA', target: 'start', color: '#777', isRevealed: false },
  { source: 'pathB', target: 'start', color: '#777', isRevealed: false }
];

// Create initial state with nodes as a record for easier access
const initialNodes: Record<string, StoryNode> = {};
initialStoryContent.forEach(node => {
  initialNodes[node.id] = node;
});

const initialState: StoryState = {
  nodes: initialNodes,
  links: initialStoryLinks,
  currentNodeId: 'start',
  visitCounts: { start: 0 },
  flags: { storyBegan: false },
  history: []
};

// Create the reducer function
const storyReducer = (state: StoryState, action: ActionType): StoryState => {
  switch (action.type) {
    case 'VISIT_NODE': {
      const nodeId = action.nodeId;
      const newVisitCount = (state.visitCounts[nodeId] || 0) + 1;
      
      // Update the node's visitedCount
      const updatedNodes = { ...state.nodes };
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          visitedCount: newVisitCount,
          // Change color after first visit (if needed)
          color: newVisitCount > 1 ? '#6a0dad' : updatedNodes[nodeId].color,
          // Optionally adjust size
          size: Math.max((updatedNodes[nodeId].size || 15) * 0.95, 10)
        };
      }
      
      return {
        ...state,
        nodes: updatedNodes,
        currentNodeId: nodeId,
        visitCounts: {
          ...state.visitCounts,
          [nodeId]: newVisitCount
        },
        history: [...state.history, nodeId]
      };
    }

    case 'REVEAL_NODE': {
      const { nodeId, nodeData } = action;
      const updatedNodes = { ...state.nodes };
      
      if (updatedNodes[nodeId]) {
        // Update existing node
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          ...nodeData,
          isRevealed: true
        };
      } else {
        // Create new node
        updatedNodes[nodeId] = {
          id: nodeId,
          label: nodeData.label || nodeId,
          text: nodeData.text || "",
          choices: nodeData.choices || [],
          color: nodeData.color || 'gray',
          size: nodeData.size || 15,
          visitedCount: 0,
          isRevealed: true
        };
      }
      
      return {
        ...state,
        nodes: updatedNodes
      };
    }

    case 'REVEAL_LINK': {
      const newLink = action.link;
      const linkExists = state.links.some(
        link => link.source === newLink.source && link.target === newLink.target
      );
      
      if (linkExists) {
        // Update existing link
        const updatedLinks = state.links.map(link => {
          if (link.source === newLink.source && link.target === newLink.target) {
            return { ...link, isRevealed: true };
          }
          return link;
        });
        
        return {
          ...state,
          links: updatedLinks
        };
      } else {
        // Add new link
        return {
          ...state,
          links: [...state.links, { ...newLink, isRevealed: true }]
        };
      }
    }

    case 'SET_FLAG': {
      return {
        ...state,
        flags: {
          ...state.flags,
          [action.key]: action.value
        }
      };
    }

    case 'RESET_STORY': {
      return initialState;
    }

    case 'LOAD_STORY': {
      return action.state;
    }

    default:
      return state;
  }
};

// Create context
type StoryContextType = {
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
};

const StoryContext = createContext<StoryContextType | undefined>(undefined);

// Create context provider
export const StoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(storyReducer, initialState);

  const visitNode = (nodeId: string) => {
    dispatch({ type: 'VISIT_NODE', nodeId });
  };

  const revealNode = (nodeId: string, nodeData: Partial<StoryNode>) => {
    dispatch({ type: 'REVEAL_NODE', nodeId, nodeData });
  };

  const revealLink = (link: StoryLink) => {
    dispatch({ type: 'REVEAL_LINK', link });
  };

  const setFlag = (key: string, value: boolean | number | string) => {
    dispatch({ type: 'SET_FLAG', key, value });
  };

  const resetStory = () => {
    dispatch({ type: 'RESET_STORY' });
  };

  const loadStory = (newState: StoryState) => {
    dispatch({ type: 'LOAD_STORY', state: newState });
  };

  const getCurrentNode = () => {
    return state.nodes[state.currentNodeId];
  };

  const getVisibleNodes = () => {
    return Object.values(state.nodes).filter(node => node.isRevealed);
  };

  const getVisibleLinks = () => {
    return state.links.filter(link => 
      link.isRevealed && 
      state.nodes[link.source]?.isRevealed && 
      state.nodes[link.target]?.isRevealed
    );
  };

  const value = {
    state,
    visitNode,
    revealNode,
    revealLink,
    setFlag,
    resetStory,
    loadStory,
    getCurrentNode,
    getVisibleNodes,
    getVisibleLinks
  };

  return (
    <StoryContext.Provider value={value}>
      {children}
    </StoryContext.Provider>
  );
};

// Create a custom hook for using the story context
export const useStory = () => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
};