// client/src/context/index.ts
// Re-export types
export * from './StoryTypes';

// Import from individual files
import StoryProvider from './StoryProvider';
import { useStory, StoryContext } from './context';

// Export what clients need
export { 
  StoryProvider,
  useStory,
  StoryContext
};