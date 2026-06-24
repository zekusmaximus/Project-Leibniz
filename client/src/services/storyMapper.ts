// client/src/services/storyMapper.ts
//
// Translates backend documents (the Mongoose StoryNode / StoryLink / UserProgress
// shapes) into the flat client-side StoryState the reducer works with, and back.
//
// The server nests presentation under `visualProperties` and authoring metadata
// under `metadata`; the client keeps a flatter, render-friendly shape. Keep all
// of that shape-knowledge here so the rest of the app never sees the raw API DTOs.
import { StoryNode, StoryLink, StoryState } from '../context/StoryTypes';

/** Node document as returned by `GET /api/nodes`. */
export interface ServerNode {
  id: string;
  label: string;
  text: string;
  choices?: { targetId: string; text: string; condition?: string }[];
  visualProperties?: { x?: number; y?: number; color?: string; size?: number };
  metadata?: { isStartNode?: boolean; tags?: string[] };
}

/** Link document as returned by `GET /api/links`. */
export interface ServerLink {
  source: string;
  target: string;
  visualProperties?: { color?: string; width?: number };
  metadata?: { isHidden?: boolean };
}

/**
 * Persisted progress (the `storyState` sub-document of UserProgress). Only the
 * fields the server actually stores — node/link reveal state is reconstructed
 * from the visited history, see {@link applyProgress}.
 */
export interface ProgressState {
  currentNodeId?: string;
  visitCounts?: Record<string, number>;
  flags?: Record<string, boolean | number | string>;
  history?: string[];
}

export function mapServerNode(doc: ServerNode): StoryNode {
  return {
    id: doc.id,
    label: doc.label ?? doc.id,
    text: doc.text ?? '',
    // Server stores `condition` as a string; the client expects a predicate
    // function. We can't safely eval arbitrary strings, so conditions are
    // dropped here (all choices treated as unconditional) until a proper
    // condition compiler exists.
    choices: (doc.choices ?? []).map((c) => ({ targetId: c.targetId, text: c.text })),
    x: doc.visualProperties?.x,
    y: doc.visualProperties?.y,
    color: doc.visualProperties?.color,
    size: doc.visualProperties?.size,
    visitedCount: 0,
    isRevealed: Boolean(doc.metadata?.isStartNode),
  };
}

export function mapServerLink(doc: ServerLink): StoryLink {
  return {
    source: doc.source,
    target: doc.target,
    color: doc.visualProperties?.color,
    width: doc.visualProperties?.width,
    isRevealed: false,
  };
}

/** Build a fresh StoryState (start node revealed) from the story graph. */
export function buildStoryState(nodes: ServerNode[], links: ServerLink[]): StoryState {
  const nodeRecord: Record<string, StoryNode> = {};
  nodes.forEach((n) => {
    nodeRecord[n.id] = mapServerNode(n);
  });

  const startNode = nodes.find((n) => n.metadata?.isStartNode) ?? nodes[0];
  const currentNodeId = startNode?.id ?? '';
  if (currentNodeId && nodeRecord[currentNodeId]) {
    nodeRecord[currentNodeId] = { ...nodeRecord[currentNodeId], isRevealed: true };
  }

  return {
    nodes: nodeRecord,
    links: links.map(mapServerLink),
    currentNodeId,
    visitCounts: currentNodeId ? { [currentNodeId]: 0 } : {},
    flags: { storyBegan: false },
    history: [],
  };
}

/**
 * Overlay saved progress on top of a freshly-built story graph. Reveal state is
 * reconstructed: any node that was visited (or appears in history) is revealed,
 * and links are revealed when both endpoints are.
 */
export function applyProgress(base: StoryState, progress: ProgressState): StoryState {
  const visitCounts = { ...base.visitCounts, ...(progress.visitCounts ?? {}) };
  const flags = { ...base.flags, ...(progress.flags ?? {}) };
  const history = progress.history ?? base.history;
  const currentNodeId = progress.currentNodeId ?? base.currentNodeId;

  const revealIds = new Set<string>(history);
  Object.entries(visitCounts).forEach(([id, count]) => {
    if (count > 0) revealIds.add(id);
  });
  if (currentNodeId) revealIds.add(currentNodeId);

  const nodes: Record<string, StoryNode> = { ...base.nodes };
  revealIds.forEach((id) => {
    if (nodes[id]) {
      nodes[id] = {
        ...nodes[id],
        isRevealed: true,
        visitedCount: visitCounts[id] ?? nodes[id].visitedCount,
      };
    }
  });

  const links = base.links.map((link) =>
    nodes[link.source]?.isRevealed && nodes[link.target]?.isRevealed
      ? { ...link, isRevealed: true }
      : link
  );

  return { nodes, links, currentNodeId, visitCounts, flags, history };
}

/** Extract the persistable progress subset from a full client StoryState. */
export function toProgressPayload(state: StoryState): Required<ProgressState> {
  return {
    currentNodeId: state.currentNodeId,
    visitCounts: state.visitCounts,
    flags: state.flags,
    history: state.history,
  };
}
