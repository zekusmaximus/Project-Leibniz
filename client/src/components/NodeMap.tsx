// src/components/NodeMap.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { select, type Selection } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from 'd3-zoom';
import { drag, type D3DragEvent } from 'd3-drag';
import { useStory } from '../context/context'; // Import useStory
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY,
  type Simulation, type SimulationLinkDatum, type ForceLink, type ForceCenter, type ForceX, type ForceY,
} from 'd3-force';
import 'd3-transition';
import { easeBounce, easeQuadOut } from 'd3-ease';

export interface NodeData {
  iconUrl?: string;
  id: string;
  label?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  visitedCount?: number;
  // Order-legibility annotations, derived in the pages via `mapVisuals`:
  visitOrder?: number; // 1-based position of this node's first visit, if visited
  isCurrent?: boolean; // the node the reader is on now
  isEnding?: boolean; // a terminal ending node
  fx?: number | null;
  fy?: number | null;
  index?: number;
  vx?: number;
  vy?: number;
}

export interface LinkData {
  source: string | NodeData;
  target: string | NodeData;
  color?: string;
  width?: number;
  onTrail?: boolean; // this edge was walked, in this direction — highlight it
}

interface CustomSimulationLink extends SimulationLinkDatum<NodeData> {
  color?: string;
  width?: number;
  onTrail?: boolean;
}

interface NodeMapProps {
  nodesData: NodeData[];
  linksData: LinkData[];
  onNodeClick?: (nodeId: string, data: NodeData) => void;
  width?: number;
  height?: number;
  highlightedNodeId?: string;
  zoomToNode?: string;
  enableZoomAnimation?: boolean;
  onZoomToFitRef?: React.MutableRefObject<(() => void) | null>;
}

type D3NodeSelection = Selection<SVGGElement, NodeData, SVGGElement, unknown>;
type D3LinkSelection = Selection<SVGLineElement, CustomSimulationLink, SVGGElement, unknown>;

const idOf = (endpoint: string | NodeData): string =>
  typeof endpoint === 'string' ? endpoint : endpoint.id;

// Reconcile the persistent simulation nodes with the incoming data, preserving
// the position/velocity of nodes that already exist so the layout stays put
// across reveals (this is what makes the map stop "jumping"). New nodes are
// seeded at a connected, already-placed neighbour — so a reveal grows out from
// where the reader came from — or the centre as a fallback.
function syncSimulationNodes(
  store: Map<string, NodeData>,
  incoming: NodeData[],
  links: LinkData[],
  width: number,
  height: number
): NodeData[] {
  const incomingIds = new Set(incoming.map((n) => n.id));
  for (const id of [...store.keys()]) {
    if (!incomingIds.has(id)) store.delete(id);
  }

  const neighbourPos = (id: string): { x: number; y: number } | null => {
    for (const link of links) {
      const s = idOf(link.source);
      const t = idOf(link.target);
      const other = s === id ? t : t === id ? s : null;
      if (other) {
        const node = store.get(other);
        if (node && node.x !== undefined && node.y !== undefined) return { x: node.x, y: node.y };
      }
    }
    return null;
  };

  return incoming.map((incomingNode) => {
    const existing = store.get(incomingNode.id);
    if (existing) {
      // Copy the presentation fields; leave x/y/vx/vy untouched.
      existing.label = incomingNode.label;
      existing.color = incomingNode.color;
      existing.size = incomingNode.size;
      existing.visitedCount = incomingNode.visitedCount;
      existing.visitOrder = incomingNode.visitOrder;
      existing.isCurrent = incomingNode.isCurrent;
      existing.isEnding = incomingNode.isEnding;
      existing.iconUrl = incomingNode.iconUrl;
      return existing;
    }
    const fresh: NodeData = { ...incomingNode };
    if (fresh.x === undefined || fresh.y === undefined) {
      const seed = neighbourPos(fresh.id) ?? { x: width / 2, y: height / 2 };
      fresh.x = seed.x + (Math.random() - 0.5) * 30;
      fresh.y = seed.y + (Math.random() - 0.5) * 30;
    }
    store.set(fresh.id, fresh);
    return fresh;
  });
}

const NodeMap: React.FC<NodeMapProps> = ({
  nodesData = [],
  linksData = [],
  onNodeClick,
  width = 800,
  height = 600,
  highlightedNodeId,
  zoomToNode,
  enableZoomAnimation = false,
  onZoomToFitRef,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<NodeData, CustomSimulationLink> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Persistent scaffold: built once, then incrementally joined against on each
  // data change instead of being torn down and rebuilt.
  const gRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodeGroupRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const linkGroupRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const linkForceRef = useRef<ForceLink<NodeData, CustomSimulationLink> | null>(null);
  const nodeElementsRef = useRef<D3NodeSelection | null>(null);
  const linkElementsRef = useRef<D3LinkSelection | null>(null);
  // The simulation's own node objects, kept stable across renders so positions
  // survive. Keyed by node id.
  const nodesStoreRef = useRef<Map<string, NodeData>>(new Map());
  // Signature of the last-rendered structure (ids + edges). We reheat the
  // simulation only when this changes (a reveal) — never on a pure position or
  // presentation update — which both keeps the map stable and prevents the
  // settle → UPDATE_NODE_POSITIONS → re-render → reheat feedback loop.
  const structureSigRef = useRef<string>('');
  // Latest prop values read by handlers attached once (in the enter selection),
  // so those handlers never go stale across renders.
  const onNodeClickRef = useRef<typeof onNodeClick>(onNodeClick);
  const highlightRef = useRef<string | undefined>(highlightedNodeId);
  const zoomToFitRef = useRef<(() => void) | null>(null);

  const { dispatch } = useStory();

  onNodeClickRef.current = onNodeClick;
  highlightRef.current = highlightedNodeId;

  // Per-node visual derivations that read the *latest* highlighted id via ref,
  // so they're correct whether called from a fresh render or a once-attached
  // hover handler.
  const nodeFill = useCallback((d: NodeData): string => {
    if (d.id === highlightRef.current) return '#ffcc00';
    if (d.visitedCount && d.visitedCount > 1) return '#6a0dad';
    return d.color || 'steelblue';
  }, []);
  const nodeGlow = useCallback((d: NodeData): string => {
    if (d.id === highlightRef.current || d.isCurrent) return 'url(#glow-highlighted)';
    if (d.visitedCount && d.visitedCount > 0) return 'url(#glow-visited)';
    return 'url(#glow-normal)';
  }, []);
  const nodeStroke = useCallback((d: NodeData): string => {
    if (d.id === highlightRef.current || d.isCurrent) return '#fff';
    if (d.isEnding) return '#d4af37';
    return 'rgba(255, 255, 255, 0.6)';
  }, []);
  const nodeStrokeWidth = useCallback(
    (d: NodeData): number =>
      d.id === highlightRef.current || d.isCurrent || d.isEnding ? 2.5 : 1.5,
    []
  );

  // Fit all visible nodes in view. Reads the persistent simulation store (the
  // live positions) rather than the nodesData prop, which lags by a render after
  // UPDATE_NODE_POSITIONS — so the fit always includes freshly revealed nodes and
  // never sees an undefined/NaN coordinate.
  const zoomToFit = useCallback((duration = 750, paddingPercent = 0.85) => {
    if (!svgRef.current || !zoomRef.current) return;
    const fitNodes = nodesStoreRef.current.size ? [...nodesStoreRef.current.values()] : nodesData;
    if (!fitNodes.length) return;
    const svg = select(svgRef.current);
    const bounds = { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } };

    fitNodes.forEach((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      const nodeSize = node.size || 25;
      bounds.x.min = Math.min(bounds.x.min, (node.x as number) - nodeSize);
      bounds.x.max = Math.max(bounds.x.max, (node.x as number) + nodeSize);
      bounds.y.min = Math.min(bounds.y.min, (node.y as number) - nodeSize);
      bounds.y.max = Math.max(bounds.y.max, (node.y as number) + nodeSize);
    });

    if (bounds.x.min === Infinity || fitNodes.length <= 1) {
      const node = fitNodes[0];
      if (node && Number.isFinite(node.x) && Number.isFinite(node.y)) {
        // Centre the single node: screen = scale*p + translate, so to land p at
        // (width/2, height/2) the translate must subtract scale*p (not just p).
        const scale = 1.2;
        const tx = width / 2 - scale * (node.x as number);
        const ty = height / 2 - scale * (node.y as number);
        zoomRef.current.transform(
          svg.transition().duration(duration),
          zoomIdentity.translate(tx, ty).scale(scale)
        );
      }
      return;
    }

    const dx = bounds.x.max - bounds.x.min;
    const dy = bounds.y.max - bounds.y.min;
    const cx = (bounds.x.min + bounds.x.max) / 2;
    const cy = (bounds.y.min + bounds.y.max) / 2;
    if (dx === 0 || dy === 0) return;
    const scale = paddingPercent / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * cx, height / 2 - scale * cy];
    zoomRef.current.transform(
      svg.transition().duration(duration),
      zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }, [nodesData, width, height]);
  zoomToFitRef.current = () => zoomToFit(750, 0.8);

  // Animate the clicked node expanding to fill the screen (the transition into
  // the narrative page). Operates on the live selections.
  const animateNodeExpansion = useCallback((
    nodeId: string,
    nodeElements: D3NodeSelection,
    linkElements: D3LinkSelection,
    maxRadius: number
  ) => {
    const targetNode = nodeElements.filter((d: NodeData) => d.id === nodeId).select('.node-main-circle');
    if (targetNode.empty()) return;
    const currentRadius = parseFloat(targetNode.attr('r') || '0');
    targetNode.transition().duration(1200).ease(easeQuadOut).attr('r', maxRadius).style('fill-opacity', 0.7);
    targetNode.transition().duration(300).attr('r', currentRadius * 1.2)
      .transition().duration(1200).attr('r', maxRadius);
    nodeElements.filter((d: NodeData) => d.id !== nodeId).transition().duration(600).style('opacity', 0);
    linkElements.transition().duration(500).style('opacity', 0);
  }, []);

  // Expose zoomToFit to the parent.
  useEffect(() => {
    if (onZoomToFitRef) onZoomToFitRef.current = () => zoomToFit(750, 0.85);
    return () => {
      if (onZoomToFitRef) onZoomToFitRef.current = null;
    };
  }, [onZoomToFitRef, zoomToFit]);

  // ── Scaffold (mount once) ────────────────────────────────────────────────
  // Build the SVG, defs, groups, zoom, tooltip and the persistent simulation.
  // Width/height are captured here and kept current by the resize effect below.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height)
      .style('display', 'block').style('margin', '0 auto').style('overflow', 'visible');

    const g = svg.append('g').attr('class', 'main-group');
    gRef.current = g;
    linkGroupRef.current = g.append('g').attr('class', 'links');
    nodeGroupRef.current = g.append('g').attr('class', 'nodes');

    const defs = svg.append('defs');
    const glowColors = [
      { id: 'glow-normal', strength: 2 },
      { id: 'glow-visited', strength: 3 },
      { id: 'glow-highlighted', strength: 5 },
    ];
    glowColors.forEach(({ id, strength }) => {
      const filter = defs.append('filter').attr('id', id)
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', strength).attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    });
    // Arrowhead for the walked "trail" links, so the path reads as directed.
    defs.append('marker').attr('id', 'trail-arrow')
      .attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L9,0L0,4').style('fill', '#ffcc00');

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      // Set the extent explicitly to the known viewport so d3-zoom never reads
      // SVGSVGElement.width.baseVal (jsdom doesn't implement it, and it's just
      // the container size anyway).
      .extent([[0, 0], [width, height]])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior).on('wheel', (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    });
    // Start slightly zoomed out but CENTRED: the simulation's forceCenter places
    // nodes around (width/2, height/2) in user space, so scale about that point
    // rather than translating by it (which would shove everything bottom-right
    // until zoomToFit fires).
    const initialScale = 0.8;
    zoomBehavior.transform(
      svg,
      zoomIdentity.translate((width / 2) * (1 - initialScale), (height / 2) * (1 - initialScale)).scale(initialScale)
    );

    const tooltip = g.append('g').attr('class', 'tooltip').style('opacity', 0).style('pointer-events', 'none');
    tooltip.append('rect').attr('x', -60).attr('y', -25).attr('width', 120).attr('height', 25)
      .attr('rx', 5).attr('ry', 5).style('fill', 'rgba(0, 0, 0, 0.7)');
    tooltip.append('text').attr('x', 0).attr('y', -8).attr('text-anchor', 'middle')
      .style('fill', '#fff').style('font-size', '12px');
    tooltipRef.current = tooltip;

    const linkForce = forceLink<NodeData, CustomSimulationLink>([])
      .id((d: NodeData) => d.id).distance(100).strength(0.5);
    linkForceRef.current = linkForce;
    const simulation = forceSimulation<NodeData>([])
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(-300).distanceMax(500))
      .force('center', forceCenter(width / 2, height / 2).strength(0.1))
      .force('collision', forceCollide<NodeData>().radius((d: NodeData) => (d.size || 25) + 15))
      .force('x', forceX(width / 2).strength(0.03))
      .force('y', forceY(height / 2).strength(0.03));
    simulation.stop(); // don't run until there's data
    simulationRef.current = simulation;

    simulation.on('tick', () => {
      const linkSel = linkElementsRef.current;
      const nodeSel = nodeElementsRef.current;
      if (linkSel) {
        linkSel
          .attr('x1', (d: CustomSimulationLink) => (d.source as NodeData).x || 0)
          .attr('y1', (d: CustomSimulationLink) => (d.source as NodeData).y || 0)
          .attr('x2', (d: CustomSimulationLink) => (d.target as NodeData).x || 0)
          .attr('y2', (d: CustomSimulationLink) => (d.target as NodeData).y || 0);
      }
      if (nodeSel) {
        nodeSel.each((d: NodeData) => {
          if (d.x !== undefined && d.y !== undefined) {
            const f = 0.01;
            if (d.x < -width) d.x += f * (-width - d.x);
            if (d.x > width * 2) d.x -= f * (d.x - width * 2);
            if (d.y < -height) d.y += f * (-height - d.y);
            if (d.y > height * 2) d.y -= f * (d.y - height * 2);
          }
        });
        nodeSel.attr('transform', (d: NodeData) => `translate(${d.x || 0},${d.y || 0})`);
      }
    });

    simulation.on('end', () => {
      const positions = [...nodesStoreRef.current.values()].map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
      if (positions.length) dispatch({ type: 'UPDATE_NODE_POSITIONS', nodes: positions });
      zoomToFitRef.current?.();
    });

    return () => {
      simulation.stop();
      simulationRef.current = null;
      svg.selectAll('*').remove();
    };
    // Mount-once scaffold; width/height/dispatch are captured here and kept
    // current by the resize effect. Re-running would tear the graph down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize: keep forces, zoom extent and svg size in step with the box ────
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    svg.attr('width', width).attr('height', height);
    zoomRef.current?.extent([[0, 0], [width, height]]);
    const sim = simulationRef.current;
    if (!sim) return;
    (sim.force('center') as ForceCenter<NodeData> | undefined)?.x(width / 2).y(height / 2);
    (sim.force('x') as ForceX<NodeData> | undefined)?.x(width / 2);
    (sim.force('y') as ForceY<NodeData> | undefined)?.y(height / 2);
  }, [width, height]);

  // ── Data join: enter / update / exit on each data change ──────────────────
  useEffect(() => {
    const sim = simulationRef.current;
    const nodeGroup = nodeGroupRef.current;
    const linkGroup = linkGroupRef.current;
    const linkForce = linkForceRef.current;
    if (!sim || !nodeGroup || !linkGroup || !linkForce) return;

    const baseSize = Math.max(20, Math.min(40, Math.min(width, height) / 15));

    if (!nodesData.length) {
      nodeGroup.selectAll('*').remove();
      linkGroup.selectAll('*').remove();
      nodeElementsRef.current = null;
      linkElementsRef.current = null;
      nodesStoreRef.current.clear();
      structureSigRef.current = '';
      return;
    }

    const wasEmpty = nodesStoreRef.current.size === 0;
    const simNodes = syncSimulationNodes(nodesStoreRef.current, nodesData, linksData, width, height);
    const idSet = new Set(simNodes.map((n) => n.id));
    const simLinks: CustomSimulationLink[] = linksData
      .map((l) => ({ source: idOf(l.source), target: idOf(l.target), color: l.color, width: l.width, onTrail: l.onTrail }))
      .filter((l) => idSet.has(l.source as string) && idSet.has(l.target as string));

    // ── Node join ──
    const nodeSel = nodeGroup
      .selectAll<SVGGElement, NodeData>('g.node-group')
      .data(simNodes, (d: NodeData) => d.id)
      .join(
        (enter) => {
          const gEnter = enter.append('g').attr('class', 'node-group').style('cursor', 'pointer');

          gEnter.call(
            drag<SVGGElement, NodeData>()
              .on('start', (event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) => {
                if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
                d.fx = d.x ?? 0; d.fy = d.y ?? 0;
              })
              .on('drag', (event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) => {
                d.fx = event.x; d.fy = event.y;
              })
              .on('end', (event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) => {
                if (!event.active) simulationRef.current?.alphaTarget(0);
                d.fx = null; d.fy = null;
              })
          );

          gEnter.on('click', (event: MouseEvent, d: NodeData) => {
            event.stopPropagation();
            onNodeClickRef.current?.(d.id, d);
          });

          gEnter.on('mouseenter', function (this: SVGGElement, _event: MouseEvent, d: NodeData) {
            select<SVGGElement, NodeData>(this).select<SVGCircleElement>('circle.node-main-circle')
              .transition().duration(300).attr('r', (d.size || baseSize) * 1.2)
              .style('stroke-width', 2.5).style('stroke', '#fff');
            const linkSel = linkElementsRef.current;
            if (linkSel) {
              linkSel.filter((l: CustomSimulationLink) =>
                (l.source as NodeData).id === d.id || (l.target as NodeData).id === d.id)
                .transition().duration(300).style('stroke-opacity', 1)
                .style('stroke-width', (l: CustomSimulationLink) => (l.width || 2) * 1.5);
            }
            const tooltip = tooltipRef.current;
            if (tooltip) {
              tooltip.attr('transform', `translate(${d.x || 0},${(d.y || 0) - (d.size || 15) - 30})`);
              tooltip.select('text').text(d.visitedCount && d.visitedCount > 0
                ? `${d.label || d.id} (Visited ${d.visitedCount}×)` : d.label || d.id);
              tooltip.transition().duration(300).style('opacity', 1);
            }
          });

          gEnter.on('mouseleave', function (this: SVGGElement, _event: MouseEvent, d: NodeData) {
            select<SVGGElement, NodeData>(this).select<SVGCircleElement>('circle.node-main-circle')
              .transition().duration(500).attr('r', d.size || baseSize)
              .style('stroke-width', nodeStrokeWidth(d)).style('stroke', nodeStroke(d));
            linkElementsRef.current?.transition().duration(500).style('stroke-opacity', (l: CustomSimulationLink) => (l.onTrail ? 0.9 : 0.6))
              .style('stroke-width', (l: CustomSimulationLink) => (l.onTrail ? (l.width || 2) + 1 : l.width || 2));
            tooltipRef.current?.transition().duration(200).style('opacity', 0);
          });

          // Outer glow ring.
          gEnter.append('circle').attr('class', 'glow-ring')
            .attr('r', (d: NodeData) => (d.size || 35) + 5).style('fill', 'transparent').style('opacity', 0.7);
          // Main circle — grows in from r=0 (only entering nodes run this).
          gEnter.append('circle').attr('class', 'node-main-circle').attr('r', 0)
            .transition().duration(800).ease(easeBounce).attr('r', (d: NodeData) => d.size || baseSize);
          // Label.
          gEnter.append('text').attr('class', 'node-label').attr('x', 0).attr('text-anchor', 'middle')
            .style('font-size', '12px').style('fill', 'rgba(255, 255, 255, 0.9)')
            .style('pointer-events', 'none').style('text-shadow', '0px 0px 3px rgba(0, 0, 0, 0.7)');

          return gEnter;
        },
        (update) => update,
        (exit) => exit.transition().duration(400).style('opacity', 0).remove()
      );

    nodeElementsRef.current = nodeSel;

    // Update the data-driven visuals on the full (enter + update) selection.
    nodeSel.select<SVGCircleElement>('circle.glow-ring').style('filter', (d: NodeData) => nodeGlow(d));
    nodeSel.select<SVGCircleElement>('circle.node-main-circle')
      .style('fill', (d: NodeData) => nodeFill(d))
      .style('stroke', (d: NodeData) => nodeStroke(d))
      .style('stroke-width', (d: NodeData) => nodeStrokeWidth(d));
    nodeSel.select<SVGTextElement>('text.node-label')
      .attr('y', (d: NodeData) => (d.size || baseSize) + 15)
      .text((d: NodeData) => d.label || d.id);

    // Conditional badges (only present for the relevant nodes) via nested joins.
    nodeSel.each(function (this: SVGGElement, d: NodeData) {
      const gNode = select<SVGGElement, NodeData>(this);
      const visited = !!(d.visitedCount && d.visitedCount > 0);
      const ordered = d.visitOrder !== undefined;

      gNode.selectAll<SVGCircleElement, NodeData>('circle.visit-indicator')
        .data(visited ? [d] : [], (vd: NodeData) => vd.id)
        .join((e) => e.append('circle').attr('class', 'visit-indicator').attr('r', 5)
          .style('fill', '#ffcc00').style('stroke', '#fff').style('stroke-width', 1))
        .attr('cx', (vd: NodeData) => (vd.size || baseSize) * 0.6)
        .attr('cy', (vd: NodeData) => -(vd.size || baseSize) * 0.6);
      gNode.selectAll<SVGTextElement, NodeData>('text.visit-count')
        .data(visited ? [d] : [], (vd: NodeData) => vd.id)
        .join((e) => e.append('text').attr('class', 'visit-count').attr('text-anchor', 'middle')
          .style('font-size', '8px').style('fill', '#000').style('pointer-events', 'none'))
        .attr('x', (vd: NodeData) => (vd.size || baseSize) * 0.6)
        .attr('y', (vd: NodeData) => -(vd.size || baseSize) * 0.6 + 4)
        .text((vd: NodeData) => vd.visitedCount?.toString() ?? '');

      gNode.selectAll<SVGCircleElement, NodeData>('circle.order-indicator')
        .data(ordered ? [d] : [], (vd: NodeData) => vd.id)
        .join((e) => e.append('circle').attr('class', 'order-indicator').attr('r', 7)
          .style('fill', '#1e232d').style('stroke', '#ffcc00').style('stroke-width', 1.5))
        .attr('cx', (vd: NodeData) => -(vd.size || baseSize) * 0.6)
        .attr('cy', (vd: NodeData) => -(vd.size || baseSize) * 0.6);
      gNode.selectAll<SVGTextElement, NodeData>('text.visit-order')
        .data(ordered ? [d] : [], (vd: NodeData) => vd.id)
        .join((e) => e.append('text').attr('class', 'visit-order').attr('text-anchor', 'middle')
          .style('font-size', '9px').style('font-weight', 'bold').style('fill', '#ffcc00').style('pointer-events', 'none'))
        .attr('x', (vd: NodeData) => -(vd.size || baseSize) * 0.6)
        .attr('y', (vd: NodeData) => -(vd.size || baseSize) * 0.6 + 3)
        .text((vd: NodeData) => vd.visitOrder?.toString() ?? '');
    });

    // Pulse the highlighted node.
    if (highlightedNodeId) {
      nodeSel.filter((d: NodeData) => d.id === highlightedNodeId)
        .select<SVGCircleElement>('.node-main-circle')
        .call((selection: Selection<SVGCircleElement, NodeData, SVGGElement, unknown>) => {
          const pulse = (sel: Selection<SVGCircleElement, NodeData, SVGGElement, unknown>) => {
            sel.transition().duration(1000).attr('r', (d: NodeData) => (d.size || baseSize) * 1.2)
              .transition().duration(1000).attr('r', (d: NodeData) => d.size || baseSize)
              .on('end', () => pulse(sel));
          };
          pulse(selection);
        });
    }

    // ── Link join ──
    const linkSel = linkGroup
      .selectAll<SVGLineElement, CustomSimulationLink>('line')
      .data(simLinks, (d: CustomSimulationLink) => `${idOf(d.source as string | NodeData)}->${idOf(d.target as string | NodeData)}`)
      .join(
        (enter) => enter.append('line').style('stroke-dashoffset', 10),
        (update) => update,
        (exit) => exit.transition().duration(300).style('stroke-opacity', 0).remove()
      );

    linkElementsRef.current = linkSel;
    linkSel
      .classed('trail', (d: CustomSimulationLink) => !!d.onTrail)
      // Walked edges are solid, brighter and carry a direction arrow; un-walked
      // (merely revealed) edges keep the faint dashed look.
      .style('stroke', (d: CustomSimulationLink) => (d.onTrail ? '#ffcc00' : d.color || '#888'))
      .style('stroke-opacity', (d: CustomSimulationLink) => (d.onTrail ? 0.9 : 0.6))
      .style('stroke-width', (d: CustomSimulationLink) => (d.onTrail ? (d.width || 2) + 1 : d.width || 2))
      .style('stroke-dasharray', (d: CustomSimulationLink) => (d.onTrail ? 'none' : '5,5'))
      .attr('marker-end', (d: CustomSimulationLink) => (d.onTrail ? 'url(#trail-arrow)' : null));

    // Hand the (possibly new) node/link objects to the simulation.
    sim.nodes(simNodes);
    linkForce.links(simLinks);

    // Reheat ONLY when the structure changed (a reveal) or on a cold start —
    // never on a pure position/presentation update, which avoids re-bouncing the
    // settled graph and breaks the settle→dispatch→re-render→reheat loop.
    const sig = `${simNodes.map((n) => n.id).join('|')}#${simLinks.map((l) => `${l.source as string}>${l.target as string}`).join('|')}`;
    const structureChanged = sig !== structureSigRef.current;
    structureSigRef.current = sig;
    if (structureChanged) sim.alpha(wasEmpty ? 0.8 : 0.4).restart();

    if (zoomToNode && enableZoomAnimation && nodeElementsRef.current && linkElementsRef.current) {
      animateNodeExpansion(zoomToNode, nodeElementsRef.current, linkElementsRef.current, Math.max(width, height));
    }
  }, [
    nodesData, linksData, width, height, highlightedNodeId, zoomToNode, enableZoomAnimation,
    nodeFill, nodeGlow, nodeStroke, nodeStrokeWidth, animateNodeExpansion,
  ]);

  return (
    <div className="node-map-container" style={{
      width: '100%', height: '100%', overflow: 'visible',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', overflow: 'visible' }}></svg>
    </div>
  );
};

export default NodeMap;
