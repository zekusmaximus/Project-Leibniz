// client/src/context/StoryProvider.tsx
import React, { useReducer, ReactNode } from 'react';
import { StoryContext } from './context';
import { 
  StoryNode, 
  StoryLink, 
  StoryState,
  StoryContextType,  // Note: using StoryContextType, not StoryContextValue
  StoryAction
} from './StoryTypes';
import { storyReducer } from './StoryReducer';
import { InitialState } from './InitialState';

// Create context provider
const StoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  const value: StoryContextType = {
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

export default StoryProvider;