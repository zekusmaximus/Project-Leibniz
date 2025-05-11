// client/src/context/context.ts
import { createContext, useContext } from 'react';
import { StoryContextType } from './StoryTypes';  // Note: using StoryContextType

// Create context
export const StoryContext = createContext<StoryContextType | undefined>(undefined);

// Create a custom hook for using the story context
export const useStory = () => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
};