// client/tests/seedSync.test.ts
//
// Drift guard: the server's starter graph (server/storyGraph.js) and the client's
// bundled offline fallback (InitialState.ts) must describe the SAME story. They're
// maintained by hand in two places (server stores conditions as JSON strings,
// the client as ConditionSpec objects), so this test fails loudly the moment they
// diverge.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { InitialState } from '../src/context/InitialState';

interface ServerChoice {
  targetId: string;
  text: string;
  condition?: string;
}
interface ServerVariant {
  id: string;
  priority: number;
  text: string;
  condition: string;
}
interface ServerNodeData {
  id: string;
  label: string;
  text: string;
  choices: ServerChoice[];
  textVariants: ServerVariant[];
  visualProperties: { color?: string; size?: number };
  metadata: { isStartNode?: boolean };
}
interface ServerLinkData {
  source: string;
  target: string;
  visualProperties: { color?: string };
}
interface ServerGraph {
  nodes: ServerNodeData[];
  links: ServerLinkData[];
}

// Load the CommonJS data module directly through Node (not Vite), so this works
// without mongoose or a database. `requireCjs` is renamed to avoid the
// no-require-imports lint rule, which only matches a bare `require(...)` call.
const requireCjs = createRequire(import.meta.url);
const serverGraph = requireCjs('../../server/storyGraph.js') as ServerGraph;

const linkKey = (l: { source: string; target: string }) => `${l.source}->${l.target}`;

describe('seed ↔ InitialState drift guard', () => {
  const serverById = new Map(serverGraph.nodes.map((n) => [n.id, n]));
  const initialNodes = Object.values(InitialState.nodes);

  it('has the same set of node ids', () => {
    expect(new Set(initialNodes.map((n) => n.id))).toEqual(
      new Set(serverGraph.nodes.map((n) => n.id))
    );
  });

  it.each(initialNodes.map((n) => [n.id, n] as const))(
    'node "%s" matches the server data',
    (id, node) => {
      const server = serverById.get(id);
      expect(server, `server graph is missing node ${id}`).toBeDefined();
      if (!server) return;

      expect(node.label).toBe(server.label);
      expect(node.text).toBe(server.text);
      expect(node.color).toBe(server.visualProperties.color);
      expect(node.size).toBe(server.visualProperties.size);

      // Choices: same targets/labels, same conditional-ness. The client compiles
      // conditions into opaque functions, so presence is comparable, content is not.
      const clientChoices = node.choices ?? [];
      expect(clientChoices.length).toBe(server.choices.length);
      clientChoices.forEach((choice, i) => {
        expect(choice.targetId).toBe(server.choices[i].targetId);
        expect(choice.text).toBe(server.choices[i].text);
        expect(Boolean(choice.condition)).toBe(Boolean(server.choices[i].condition));
      });

      // Text variants keep their ConditionSpec on the client, so we CAN compare the
      // condition: the server's JSON string must parse to the client's spec object.
      const clientVariants = node.textVariants ?? [];
      const serverVariantById = new Map(server.textVariants.map((v) => [v.id, v]));
      expect(new Set(clientVariants.map((v) => v.id))).toEqual(
        new Set(server.textVariants.map((v) => v.id))
      );
      clientVariants.forEach((variant) => {
        const sv = serverVariantById.get(variant.id);
        expect(sv, `server is missing variant ${id}/${variant.id}`).toBeDefined();
        if (!sv) return;
        expect(variant.priority).toBe(sv.priority);
        expect(variant.text).toBe(sv.text);
        expect(variant.condition).toEqual(JSON.parse(sv.condition));
      });
    }
  );

  it('has the same links with matching colors', () => {
    const serverByKey = new Map(serverGraph.links.map((l) => [linkKey(l), l]));
    expect(new Set(InitialState.links.map(linkKey))).toEqual(
      new Set(serverGraph.links.map(linkKey))
    );
    InitialState.links.forEach((l) => {
      expect(serverByKey.get(linkKey(l))?.visualProperties.color).toBe(l.color);
    });
  });
});
