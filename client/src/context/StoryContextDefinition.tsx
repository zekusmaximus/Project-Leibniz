// client/src/context/StoryContextDefinition.tsx
import React, { createContext } from 'react';
import { StoryContextValue } from './StoryTypes';

// Create the context and export it
export const StoryContext = createContext<StoryContextValue | undefined>(undefined);

// Create a dummy component to satisfy Fast Refresh requirements
const ContextDefinitionComponent: React.FC = () => {
  return null; // This component doesn't render anything
};

// Export the component as default
export default ContextDefinitionComponent;