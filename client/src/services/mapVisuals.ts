// client/src/services/mapVisuals.ts
//
// Pure derivations that make the *order* of a playthrough legible on the map.
// Kept free of React and D3 so they can be unit-tested in the node environment
// and reused by the pages to annotate the D3 node/link data handed to NodeMap.
// All shape-knowledge of how a path is drawn (badges, trail, role emphasis)
// starts here as plain data; NodeMap is just the renderer.
import type { StoryLink } from '../context/StoryTypes';

/**
 * First-visit order for each visited node: the node visited earliest in history
 * gets 1, the next distinct node 2, and so on. Revisits do NOT renumber a node —
 * the badge answers "when did you first arrive here", which is the order the
 * narrative actually adapts to.
 */
export function getVisitOrder(history: string[]): Record<string, number> {
  const order: Record<string, number> = {};
  let n = 0;
  for (const id of history) {
    if (order[id] === undefined) {
      n += 1;
      order[id] = n;
    }
  }
  return order;
}

/**
 * The directed `source->target` keys the reader actually walked, restricted to
 * pairs that correspond to a real link — the "trail" to highlight on the map. A
 * revisited edge appears once. Returned as a Set for O(1) lookup while styling
 * links. Steps that don't correspond to a real link (e.g. a minimap jump) are
 * dropped, so the trail only ever traces edges that exist on the graph.
 */
export function getTrailLinkKeys(history: string[], links: StoryLink[]): Set<string> {
  const linkKeys = new Set(links.map((l) => `${l.source}->${l.target}`));
  const trail = new Set<string>();
  for (let i = 1; i < history.length; i += 1) {
    const key = `${history[i - 1]}->${history[i]}`;
    if (linkKeys.has(key)) trail.add(key);
  }
  return trail;
}

export type NodeRole = 'current' | 'ending' | 'visited' | 'unvisited';

/**
 * The semantic role that drives a node's emphasis on the map — richer than the
 * raw visit count alone: the node you're on now, a terminal ending, somewhere
 * you have been, or somewhere merely revealed. Precedence is current > ending >
 * visited > unvisited. `isEnding` is supplied by the caller (the ending set
 * lives in StoryLogicService) so this module stays dependency-free.
 */
export function getNodeRole(
  nodeId: string,
  opts: { currentNodeId: string; visited: boolean; isEnding: boolean }
): NodeRole {
  if (nodeId === opts.currentNodeId) return 'current';
  if (opts.isEnding) return 'ending';
  return opts.visited ? 'visited' : 'unvisited';
}
