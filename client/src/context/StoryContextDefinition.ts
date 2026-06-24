// client/src/context/StoryContextDefinition.ts
import { createContext } from 'react';
import { StoryContextType } from './StoryTypes';

// The context lives in its own module (no component export) so that React Fast
// Refresh is happy and consumers can import it without pulling in a provider.
export const StoryContext = createContext<StoryContextType | undefined>(undefined);
