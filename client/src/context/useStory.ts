// client/src/context/useStory.tsx
import React from 'react';
import { useContext } from 'react';
import { StoryContextType } from './StoryTypes';

// Import the Context from a separate file since this file can't be the one to define it
import { StoryContext } from './StoryContextDefinition';

// Create a component wrapper that gives access to the hook
// This is a workaround to satisfy Fast Refresh's requirements
const StoryHookProvider: React.FC = () => {
  return null; // This component doesn't render anything
};

// Export the component as default
export default StoryHookProvider;

// Export the useStory function for use in index.ts
export function useStory() {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
}