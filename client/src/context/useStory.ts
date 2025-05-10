// client/src/context/useStory.ts
import { useContext } from 'react';
import { StoryContext } from './StoryContextDefinition';

// Create a custom hook for using the story context
export const useStory = () => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
};

export default useStory;