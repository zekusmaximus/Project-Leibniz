// client/src/context/StoryContextDefinition.ts
import { createContext } from 'react';
import { StoryContextType } from './StoryTypes';

// Create the context but don't populate it yet
export const StoryContext = createContext<StoryContextType | undefined>(undefined);