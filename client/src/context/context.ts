// client/src/context/context.ts
import { useContext } from 'react';
import { StoryContext } from './StoryContextDefinition';
import { StoryContextType } from './StoryTypes';  // Note: using StoryContextType

// Create context
export { StoryContext };

// Create a custom hook for using the story context
export const useStory = (): StoryContextType => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
};