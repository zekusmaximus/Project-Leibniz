// client/src/context/StoryContextDefinition.tsx
import { createContext } from 'react';
import { StoryContextType } from './StoryTypes';

// Create the context and export it
export const StoryContext = createContext<StoryContextType | undefined>(undefined);

// Create a dummy component to satisfy Fast Refresh requirements
const ContextDefinitionComponent: React.FC = () => {
  return null; // This component doesn't render anything
};

// Export the component as default
export default ContextDefinitionComponent;