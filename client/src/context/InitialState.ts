// client/src/context/InitialState.ts
//
// The bundled offline fallback story graph. Rather than hand-maintaining a second
// copy of the graph here (in ConditionSpec/predicate form) alongside the server's
// serialized copy, we keep ONE canonical source — client/src/data/storyGraph.json,
// in the same server-DTO shape the backend serves (conditions as JSON strings) —
// and run it through the exact same `storyMapper.buildStoryState` the live API
// path uses. So the offline fallback and the backend path are the identical
// transformation, and there is no drift to guard against.
//
// To change the story graph, edit client/src/data/storyGraph.json ONLY. The
// server seed (server/storyGraph.js) reads the same file.
import type { StoryState } from './StoryTypes';
import { buildStoryState } from '../services/storyMapper';
import type { ServerNode, ServerLink } from '../services/storyMapper';
import storyGraph from '../data/storyGraph.json';

export const InitialState: StoryState = buildStoryState(
  storyGraph.nodes as ServerNode[],
  storyGraph.links as ServerLink[]
);
