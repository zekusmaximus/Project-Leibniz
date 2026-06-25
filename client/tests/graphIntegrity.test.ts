// client/tests/graphIntegrity.test.ts
//
// Structural integrity of the canonical story graph (client/src/data/storyGraph.json).
// With a single source of truth there's no client/server drift to guard against,
// so instead we guard the things that actually break a graph as it grows: dangling
// choice targets, missing links, unparseable conditions, duplicate ids, and
// unreachable nodes. Edit the JSON and these tests tell you if you broke the graph.
import { describe, it, expect } from 'vitest';
import storyGraphData from '../src/data/storyGraph.json';
import { parseConditionSpec } from '../src/services/conditionDSL';
import { InitialState } from '../src/context/InitialState';

interface RawChoice {
  targetId: string;
  text: string;
  condition?: string;
}
interface RawVariant {
  id: string;
  priority: number;
  text: string;
  condition: string;
}
interface RawNode {
  id: string;
  label: string;
  text: string;
  choices?: RawChoice[];
  textVariants?: RawVariant[];
  visualProperties?: { color?: string; size?: number };
  metadata?: { isStartNode?: boolean };
}
interface RawLink {
  source: string;
  target: string;
  visualProperties?: { color?: string };
}

const graph = storyGraphData as { nodes: RawNode[]; links: RawLink[] };
const nodeIds = new Set(graph.nodes.map((n) => n.id));
const linkSet = new Set(graph.links.map((l) => `${l.source}->${l.target}`));

describe('story graph integrity', () => {
  it('has unique node ids', () => {
    expect(nodeIds.size).toBe(graph.nodes.length);
  });

  it('has exactly one start node', () => {
    const starts = graph.nodes.filter((n) => n.metadata?.isStartNode);
    expect(starts).toHaveLength(1);
  });

  it('every node has a non-empty label and base text', () => {
    for (const node of graph.nodes) {
      expect(node.label, `node ${node.id} label`).toBeTruthy();
      expect(node.text, `node ${node.id} text`).toBeTruthy();
    }
  });

  it('every choice points at a real node and has a matching link', () => {
    for (const node of graph.nodes) {
      for (const choice of node.choices ?? []) {
        expect(nodeIds.has(choice.targetId), `${node.id} → ${choice.targetId} (unknown node)`).toBe(true);
        expect(linkSet.has(`${node.id}->${choice.targetId}`), `${node.id} → ${choice.targetId} (no link)`).toBe(true);
      }
    }
  });

  it('every link connects two real nodes', () => {
    for (const link of graph.links) {
      expect(nodeIds.has(link.source), `link source ${link.source}`).toBe(true);
      expect(nodeIds.has(link.target), `link target ${link.target}`).toBe(true);
    }
  });

  it('every choice/variant condition parses to a valid ConditionSpec', () => {
    for (const node of graph.nodes) {
      for (const choice of node.choices ?? []) {
        if (choice.condition !== undefined) {
          expect(parseConditionSpec(choice.condition), `${node.id} choice → ${choice.targetId}`).toBeDefined();
        }
      }
      for (const variant of node.textVariants ?? []) {
        expect(parseConditionSpec(variant.condition), `${node.id} variant ${variant.id}`).toBeDefined();
      }
    }
  });

  it('text variant ids are unique within each node and well-formed', () => {
    for (const node of graph.nodes) {
      const ids = (node.textVariants ?? []).map((v) => v.id);
      expect(new Set(ids).size, `node ${node.id} has duplicate variant ids`).toBe(ids.length);
      for (const variant of node.textVariants ?? []) {
        expect(variant.id, `node ${node.id} variant id`).toBeTruthy();
        expect(variant.text, `node ${node.id} variant ${variant.id} text`).toBeTruthy();
        expect(typeof variant.priority, `node ${node.id} variant ${variant.id} priority`).toBe('number');
      }
    }
  });

  it('every node is reachable from the start node via links', () => {
    const start = graph.nodes.find((n) => n.metadata?.isStartNode);
    expect(start).toBeDefined();
    const adjacency = new Map<string, string[]>();
    for (const link of graph.links) {
      adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link.target]);
    }
    const seen = new Set<string>([start!.id]);
    const queue = [start!.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const next of adjacency.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const unreachable = graph.nodes.map((n) => n.id).filter((id) => !seen.has(id));
    expect(unreachable, `unreachable nodes: ${unreachable.join(', ')}`).toEqual([]);
  });
});

describe('InitialState derives cleanly from the canonical graph', () => {
  it('reveals the start node and only the start node', () => {
    const start = graph.nodes.find((n) => n.metadata?.isStartNode)!;
    expect(InitialState.currentNodeId).toBe(start.id);
    expect(InitialState.nodes[start.id].isRevealed).toBe(true);
    const revealedOthers = Object.values(InitialState.nodes).filter(
      (n) => n.id !== start.id && n.isRevealed
    );
    expect(revealedOthers).toEqual([]);
  });

  it('seeds the start node visit count at zero and empty history', () => {
    const start = graph.nodes.find((n) => n.metadata?.isStartNode)!;
    expect(InitialState.visitCounts[start.id]).toBe(0);
    expect(InitialState.history).toEqual([]);
  });
});
