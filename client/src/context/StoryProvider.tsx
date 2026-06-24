// client/src/context/StoryProvider.tsx
import React, { useReducer, useEffect, useState, ReactNode } from 'react';
import { StoryContext } from './context';
import {
  StoryNode,
  StoryLink,
  StoryState,
  StoryContextType, // Note: using StoryContextType, not StoryContextValue
} from './StoryTypes';
import { storyReducer } from './StoryReducer';
import { InitialState } from './InitialState';
import apiService, { getStoredUserId, setStoredUserId } from '../services/ApiService';
import { buildStoryState, applyProgress, toProgressPayload } from '../services/storyMapper';

// Create context provider
const StoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(storyReducer, InitialState);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to load the story graph (and any saved progress) from the
  // backend. If the backend is unreachable or empty, fall back to the bundled
  // InitialState the reducer already holds, so the app still works offline.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [nodes, links] = await Promise.all([
          apiService.fetchAllNodes(),
          apiService.fetchAllLinks(),
        ]);

        if (!nodes.length) {
          throw new Error('Backend returned no story nodes; using bundled content');
        }

        let nextState = buildStoryState(nodes, links);

        // Restore saved progress for the returning anonymous user, if any.
        const userId = getStoredUserId();
        if (userId) {
          try {
            const progress = await apiService.loadUserProgress(userId);
            if (progress) {
              nextState = applyProgress(nextState, progress);
            }
          } catch {
            // 404 / no saved progress yet — just start fresh from the graph.
          }
        }

        if (!cancelled) {
          dispatch({ type: 'LOAD_STORY', state: nextState });
        }
      } catch (err) {
        console.warn('StoryProvider: falling back to bundled story content.', err);
        // InitialState is already loaded in the reducer — nothing to do.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Persist the current progress to the backend. Stores the anonymous user id
  // the server hands back so subsequent saves update the same record.
  const saveProgress = async (): Promise<boolean> => {
    try {
      const { userId } = await apiService.saveUserProgress(
        getStoredUserId(),
        toProgressPayload(state)
      );
      if (userId) {
        setStoredUserId(userId);
      }
      return true;
    } catch (err) {
      console.error('StoryProvider: failed to save progress to backend.', err);
      return false;
    }
  };

  const getCurrentNode = () => {
    return state.nodes[state.currentNodeId];
  };

  const getVisibleNodes = () => {
    return Object.values(state.nodes).filter((node) => node.isRevealed);
  };

  const getVisibleLinks = () => {
    return state.links.filter(
      (link) =>
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
    getVisibleLinks,
    dispatch,
    isLoading,
    saveProgress,
  };

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
};

export default StoryProvider;
