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

/**
 * A recency weight in [floor, 1] for every visited node, encoding *how long ago*
 * you were last there — the node visited most recently gets 1, the
 * least-recently-visited gets `floor`, and the rest fall linearly between. This
 * is what lets the map fade a cooling trail behind the reader (memory decay),
 * making the ORDER of a run legible as appearance, not just the badges. Distinct
 * from `getVisitOrder`, which numbers FIRST visits and never decays. Nodes that
 * were never visited are absent from the result.
 */
export function getVisitRecency(history: string[], floor = 0.4): Record<string, number> {
  // Last-visit position per distinct node — a later index means more recent.
  const lastSeen: Record<string, number> = {};
  history.forEach((id, i) => {
    lastSeen[id] = i;
  });
  const byRecency = Object.keys(lastSeen).sort((a, b) => lastSeen[b] - lastSeen[a]);
  const denom = Math.max(1, byRecency.length - 1);
  const recency: Record<string, number> = {};
  byRecency.forEach((id, rank) => {
    recency[id] = 1 - (rank / denom) * (1 - floor);
  });
  return recency;
}

/**
 * All the order-legibility annotations for a single point in a playthrough —
 * the run as it stood after its first `step` visits. Truncating history is what
 * lets the map REPLAY a journey: at step k the trail, the visit-order badges and
 * the recency fade all reflect only the first k visits, and `currentId` is the
 * node the reader stood on then. Nodes visited later simply carry no annotation
 * (they stay on the map, un-numbered and off-trail), so the path builds up as
 * the step advances. `step` is clamped to `[0, history.length]`.
 */
export interface JourneyFrame {
  visitOrder: Record<string, number>;
  recency: Record<string, number>;
  trailKeys: Set<string>;
  currentId: string | undefined;
  step: number;
  total: number;
}

export function getJourneyFrame(
  history: string[],
  links: StoryLink[],
  step: number
): JourneyFrame {
  const total = history.length;
  const clamped = Math.max(0, Math.min(step, total));
  const sliced = history.slice(0, clamped);
  return {
    visitOrder: getVisitOrder(sliced),
    recency: getVisitRecency(sliced),
    trailKeys: getTrailLinkKeys(sliced, links),
    currentId: sliced[sliced.length - 1],
    step: clamped,
    total,
  };
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
