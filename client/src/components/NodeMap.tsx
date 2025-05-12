// src/components/NodeMap.tsx
import React, { useEffect, useRef } from 'react';
import { select, type Selection } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from 'd3-zoom';
import { drag, type DragBehavior, type D3DragEvent } from 'd3-drag';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type Simulation, type SimulationLinkDatum, type ForceLink } from 'd3-force';
import 'd3-transition';
import { type Transition } from 'd3-transition';
import { easeBounce } from 'd3-ease';

export interface NodeData {
  iconUrl?: string;
  id: string;
  label?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  visitedCount?: number;
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
}

interface CustomSimulationLink extends SimulationLinkDatum<NodeData> {
  color?: string;
  width?: number;
}

interface NodeMapProps {
  nodesData: NodeData[];
  linksData: LinkData[];
  onNodeClick?: (nodeId: string, data: NodeData) => void;
  width?: number;
  height?: number;
  highlightedNodeId?: string;
  zoomToNode?: string;
  enableZoomAnimation?: boolean; // Added this prop
}

type D3NodeSelection = Selection<SVGGElement, NodeData, SVGGElement, unknown>;
type D3LinkSelection = Selection<SVGLineElement, CustomSimulationLink, SVGGElement, unknown>;

const NodeMap: React.FC<NodeMapProps> = ({
  nodesData = [],
  linksData = [],
  onNodeClick,
  width = 800,
  height = 600,
  highlightedNodeId,
  zoomToNode,
  enableZoomAnimation = false, // Added default value
}) => {
  // Add this console log to debug input data
  console.log('NodeMap received:', {
    nodesLength: nodesData.length,
    linksLength: linksData.length,
    width,
    height
  });

  // Ensure each node has valid data
  const validNodesData = nodesData.map(node => ({
    ...node,
    id: node.id,
    x: node.x ?? Math.random() * width * 0.8 + width * 0.1,
    y: node.y ?? Math.random() * height * 0.8 + height * 0.1,
    size: node.size ?? 25,
    color: node.color ?? 'steelblue',
    visitedCount: node.visitedCount ?? 0
  }));
  
  // Log the valid data
  console.log('Processed nodes:', validNodesData.length);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<NodeData, CustomSimulationLink> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Refs to store selections for later use in animations
  const nodeElementsRef = useRef<D3NodeSelection | null>(null);
  const linkElementsRef = useRef<D3LinkSelection | null>(null);

  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;

// Make sure we have valid data to render
  if (nodesData.length === 0) {
    console.log('No nodes to display');
    return;
  }
  
  console.log(`Rendering ${nodesData.length} nodes and ${linksData.length} links`);

    // Clear previous SVG content and refs
  const svgSelection = select(svgRef.current);
  svgSelection.selectAll('*').remove();
  nodeElementsRef.current = null;
  linkElementsRef.current = null;

  // Set full size
 svgSelection.attr('width', width)
  .attr('height', height)
  .style('display', 'block') // Ensure it's a block element
  .style('margin', '0 auto') // Center it horizontally
  .style('overflow', 'hidden'); // Hide anything outside bounds

  // Create main group for all elements
  const g = svgSelection.append('g').attr('class', 'main-group');
  const initialScale = 1.2; // Slightly zoomed in by default
  const initialTransform = zoomIdentity
    .translate(width / 2, height / 2)
    .scale(initialScale);
  g.attr('transform', initialTransform.toString());

   // Create map of nodeId to node for faster lookup
  const nodeMap = new Map<string, NodeData>();
  nodesData.forEach((node, i) => {
  // Get the node size (or default)
  const nodeSize = node.size || 25;
  
  if (node.x === undefined || node.y === undefined) {
    // Position nodes in a circle formation centered in the visible area
    const angle = (i * (2 * Math.PI)) / nodesData.length;
    const radius = Math.min(width, height) * 0.3;
    
    // Center at width/2, height/2 to place in middle of container
    node.x = (width / 2) + Math.cos(angle) * radius;
    node.y = (height / 2) + Math.sin(angle) * radius;
  }
  
  // Regardless of how position was set, constrain within visible area
  // Make sure nodes stay at least nodeSize distance from the edges
  node.x = Math.max(nodeSize, Math.min(width - nodeSize, node.x || width/2));
  node.y = Math.max(nodeSize, Math.min(height - nodeSize, node.y || height/2));
});
  
  // Process links, ensuring they reference valid nodes
  const processedLinks = linksData
    .filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeMap.has(sourceId) && nodeMap.has(targetId);
    })
    .map(link => ({
      ...link,
      source: typeof link.source === 'string' ? link.source : link.source.id,
      target: typeof link.target === 'string' ? link.target : link.target.id
    }));
  
  console.log(`Valid links after processing: ${processedLinks.length}`);
  

  // Define zoom behavior
  const zoomBehaviorInstance = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 2])
    .translateExtent([[0, 0], [width, height]]) // Constrain panning to container size
    .extent([[0, 0], [width, height]])
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr('transform', event.transform.toString());
    });
  zoomRef.current = zoomBehaviorInstance;
  svgSelection.call(zoomBehaviorInstance);
  
  // Apply initial transform to the zoom behavior
  zoomBehaviorInstance.transform(svgSelection, initialTransform);
  
  // Make sure each node has a position if x,y are not defined
  nodesData.forEach((node, i) => {
    if (node.x === undefined) {
      // Position nodes in a circle if no position is defined
      const angle = (i * (2 * Math.PI)) / nodesData.length;
      const radius = Math.min(width, height) * 0.3;
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle) * radius;
    }
  });

    const defs = svgSelection.append("defs");

    // Glow filters
    const glowColors = [
      { id: "glow-normal", color: "white", strength: 2 },
      { id: "glow-visited", color: "#6a0dad", strength: 3 },
      { id: "glow-highlighted", color: "#ffcc00", strength: 5 }
    ];

    glowColors.forEach(({ id, color: _color, strength }) => {
      const filter = defs.append("filter")
        .attr("id", id)
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");

      filter.append("feGaussianBlur")
        .attr("stdDeviation", strength)
        .attr("result", "coloredBlur");

      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    });

    // Declare nodeElements and linkElements here before use
    let nodeElements: D3NodeSelection;
    let linkElements: D3LinkSelection;

// In NodeMap.tsx - Helper function to calculate appropriate node size based on container dimensions
const calculateNodeSize = () => {
  // Scale node size based on container size
  const minDimension = Math.min(width, height);
  const baseSize = minDimension / 15; // Size relative to container
  return Math.max(20, Math.min(40, baseSize)); // Min 20px, max 40px
};

// Use this function when rendering nodes
const nodeSize = calculateNodeSize();

    // Prepare links for the simulation
    const linksForSimulation: LinkData[] = linksData
      .map(link => ({
        ...link,
        source: typeof link.source === 'string' ? link.source : link.source.id,
        target: typeof link.target === 'string' ? link.target : link.target.id,
      }))
      .filter(link => nodeMap.has(link.source as string) && nodeMap.has(link.target as string));

    const linksGroup = g.append('g').attr('class', 'links');
    // Create gradients for links
    linksForSimulation.forEach((link, i) => {
      const gradientId = `link-gradient-${i}`;
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse");

      const sourceNode = nodeMap.get(link.source as string);
      const targetNode = nodeMap.get(link.target as string);

      const sourceColor = sourceNode?.color || '#999';
      const targetColor = targetNode?.color || '#999';

      gradient.append("stop").attr("offset", "0%").attr("stop-color", sourceColor);
      gradient.append("stop").attr("offset", "100%").attr("stop-color", targetColor);
    });

console.log('Links data check:', processedLinks.map(l => ({
  sourceId: l.source,
  targetId: l.target,
  sourceExists: nodeMap.has(l.source as string),
  targetExists: nodeMap.has(l.target as string)
})));
    
    linkElements = linksGroup.selectAll('line')
      .data(linksForSimulation as unknown as CustomSimulationLink[])
      .enter()
      .append('line')
      .style('stroke', (_: CustomSimulationLink, i: number) => `url(#link-gradient-${i})`)
      .style('stroke-opacity', 0.6)
      .style('stroke-width', (d: CustomSimulationLink) => d.width || 2)
      .style('stroke-dasharray', '5,5')
      .style('stroke-dashoffset', 10);

    // Store linkElements in ref for later use
    linkElementsRef.current = linkElements;

    // Animate stroke-dashoffset separately
    linkElements.transition()
      .duration(1500)
      .style('stroke-dashoffset', 0);

    const nodesGroup = g.append('g').attr('class', 'nodes');
    nodeElements = nodesGroup.selectAll('g')
      .data(nodesData)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        (() => {
          const dragBehaviorInstance: DragBehavior<SVGGElement, NodeData, NodeData | NodeData> = drag<SVGGElement, NodeData, NodeData>()
            .on('start', function (this: SVGGElement, event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
              if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
              d.fx = d.x ?? 0;
              d.fy = d.y ?? 0;
            })
            .on('drag', function (this: SVGGElement, event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', function (this: SVGGElement, event: D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
              if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            });
          return dragBehaviorInstance;
        })()
      )
      .on('click', (event: MouseEvent, d: NodeData) => {
        event.stopPropagation();
        if (onNodeClick) onNodeClick(d.id, d);
      });

    // Store nodeElements in ref for later use
    nodeElementsRef.current = nodeElements;

    // Optional icon for each node
    nodeElements
      .filter((d: NodeData) => !!d.iconUrl)
      .append('image')
      .attr('href', (d: NodeData) => d.iconUrl || '')
      .attr('x', (d: NodeData) => -(d.size || 15) / 2)
      .attr('y', (d: NodeData) => -(d.size || 15) / 2)
      .attr('width', (d: NodeData) => (d.size || 15))
      .attr('height', (d: NodeData) => (d.size || 15))
      .attr('clip-path', 'circle(50%)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .on('error', function (this: SVGImageElement) {
        select(this).remove();
      });

    nodeElements.append('circle')
      .attr('r', (d: NodeData) => (d.size || 35) + 5)
      .style('fill', 'transparent')
      .style('filter', (d: NodeData) => {
        if (d.id === highlightedNodeId) return 'url(#glow-highlighted)';
        if (d.visitedCount && d.visitedCount > 0) return 'url(#glow-visited)';
        return 'url(#glow-normal)';
      })
      .style('opacity', 0.7);

    // Main circle layer with animation
    nodeElements.append('circle')
      .attr('class', 'node-main-circle')
      .attr('r', 0)
      .style('fill', (d: NodeData) => {
        let baseColor = d.color || 'steelblue';
        if (d.visitedCount && d.visitedCount > 1) baseColor = '#6a0dad';
        if (d.id === highlightedNodeId) baseColor = '#ffcc00';
        return baseColor;
      })
      .style('stroke', (d: NodeData) => d.id === highlightedNodeId ? '#fff' : 'rgba(255, 255, 255, 0.6)')
      .style('stroke-width', (d: NodeData) => d.id === highlightedNodeId ? 2.5 : 1.5)
      .transition()
      .duration(800)
      .ease(easeBounce)
      .attr('r', (d: NodeData) => d.size || nodeSize);

    // Add pulsing animation for highlighted node
    if (highlightedNodeId) {
      nodeElements
      .filter((d: NodeData) => d.id === highlightedNodeId)
      .select<SVGCircleElement>('.node-main-circle')
      .call((selection: Selection<SVGCircleElement, NodeData, SVGGElement, unknown>) => {
        const pulse = (sel: Selection<SVGCircleElement, NodeData, SVGGElement, unknown>) => {
          sel
            .transition()
            .duration(1000)
            .attr('r', (d: NodeData) => (d.size || 15) * 1.2)
            .transition()
            .duration(1000)
            .attr('r', (d: NodeData) => d.size || 15)
            .on('end', () => pulse(sel));
        };
        pulse(selection);
      });
    }

    // Add node labels
    nodeElements.append('text')
      .text((d: NodeData) => d.label || d.id)
      .attr('x', 0)
      .attr('y', (d: NodeData) => (d.size || 35) + 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'rgba(255, 255, 255, 0.9)')
      .style('pointer-events', 'none')
      .style('text-shadow', '0px 0px 3px rgba(0, 0, 0, 0.7)');

    // Zoom to highlighted node
    if (zoomToNode) {
      const targetNode = nodesData.find(node => node.id === zoomToNode);
      if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined && zoomRef.current) {
        // Calculate transformations to center on the node
        const tx = width / 2 - targetNode.x;
        const ty = height / 2 - targetNode.y;
        const scale = 1.5; // Slightly larger zoom level
    
        // Apply the transformation with a smooth transition
        zoomRef.current.transform(
          svgSelection.transition().duration(750) as Transition<SVGSVGElement, unknown, null, undefined>,
          zoomIdentity.translate(tx, ty).scale(scale)
        );
      }
    }

    // Add animation for the transition when enableZoomAnimation is true
    if (zoomToNode && enableZoomAnimation && nodeElementsRef.current && linkElementsRef.current) {
      const targetNode = nodesData.find(node => node.id === zoomToNode);
      if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
        const node = nodeElementsRef.current
          .filter((d: NodeData) => d.id === zoomToNode)
          .select('.node-main-circle');
          
        node.transition()
          .duration(800)
          .attr('r', Math.min(width, height) / 2);
          
        // Fade out other nodes
        nodeElementsRef.current
          .filter((d: NodeData) => d.id !== zoomToNode)
          .transition()
          .duration(400)
          .style('opacity', 0);
          
        // Fade out links
        linkElementsRef.current
          .transition()
          .duration(400)
          .style('opacity', 0);
      }
    }

   // Replace your current simulation code with this:
const linkForce: ForceLink<NodeData, CustomSimulationLink> = forceLink<NodeData, CustomSimulationLink>(linksForSimulation as CustomSimulationLink[])
  .id((d: NodeData) => d.id)
  .distance(100);

const simulationInstance: Simulation<NodeData, CustomSimulationLink> = forceSimulation(nodesData)
  .force('link', linkForce)
  .force('charge', forceManyBody().strength(-300))
  .force('center', forceCenter(width / 2, height / 2).strength(0.2)) // Increased strength
  .force('collision', forceCollide<NodeData>().radius((d: NodeData) => (d.size || 25) + 20))
  .force('x', forceX(width / 2).strength(0.1)) // Increased strength
  .force('y', forceY(height / 2).strength(0.1)); // Increased strength

simulationRef.current = simulationInstance;

// Run initial simulation ticks
simulationInstance.alpha(1).restart();
simulationInstance.tick(200);

// Add a tick event handler that constrains nodes to visible area
simulationInstance.on('tick', () => {
  // Constrain nodes to visible area
  nodeElements.each((d: NodeData) => {
    // Get the size of this node (or default)
    const nodeSize = d.size || 25;
    
    // Constrain x position within visible area
    d.x = Math.max(nodeSize, Math.min(width - nodeSize, d.x || width/2));
    
    // Constrain y position within visible area
    d.y = Math.max(nodeSize, Math.min(height - nodeSize, d.y || height/2));
  });
  
  // Update link positions
  linkElements
    .attr('x1', (d: CustomSimulationLink) => (d.source as NodeData).x || 0)
    .attr('y1', (d: CustomSimulationLink) => (d.source as NodeData).y || 0)
    .attr('x2', (d: CustomSimulationLink) => (d.target as NodeData).x || 0)
    .attr('y2', (d: CustomSimulationLink) => (d.target as NodeData).y || 0);

  // Update node positions
  nodeElements.attr('transform', (d: NodeData) => `translate(${d.x || 0},${d.y || 0})`);
});

    // Tooltip
    const tooltip = g.append('g')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    tooltip.append('rect')
      .attr('x', -60)
      .attr('y', -25)
      .attr('width', 120)
      .attr('height', 25)
      .attr('rx', 5)
      .attr('ry', 5)
      .style('fill', 'rgba(0, 0, 0, 0.7)');

    tooltip.append('text')
      .attr('x', 0)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .style('font-size', '12px');

    // Add visit indicators
    nodeElements
      .filter((d: NodeData) => !!(d.visitedCount && d.visitedCount > 0))
      .append('circle')
      .attr('class', 'visit-indicator')
      .attr('r', 5)
      .attr('cx', (d: NodeData) => (d.size || 35) * 0.6)
      .attr('cy', (d: NodeData) => -(d.size || 35) * 0.6)
      .style('fill', '#ffcc00')
      .style('stroke', '#fff')
      .style('stroke-width', 1);

    nodeElements
      .filter((d: NodeData) => !!(d.visitedCount && d.visitedCount > 0))
      .append('text')
      .attr('class', 'visit-count')
      .attr('x', (d: NodeData) => (d.size || 35) * 0.6)
      .attr('y', (d: NodeData) => -(d.size || 35) * 0.6 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', '#000')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.visitedCount?.toString() ?? '');

    // Add hover tooltips
    nodeElements
      .on('mouseenter', function (this: SVGGElement, _event: MouseEvent, d: NodeData) {
        const currentSelection = select<SVGGElement, NodeData>(this);
        currentSelection.select<SVGCircleElement>('circle:not(.visit-indicator)')
          .transition()
          .duration(300)
          .attr('r', (d.size || 15) * 1.2)
          .style('stroke-width', 2.5)
          .style('stroke', '#fff');

        const connectedLinks = linkElements.filter((link: CustomSimulationLink) => {
            const sourceNode = link.source as NodeData;
            const targetNode = link.target as NodeData;
            return sourceNode.id === d.id || targetNode.id === d.id;
        });

        connectedLinks
          .transition()
          .duration(300)
          .style('stroke-opacity', 1)
          .style('stroke-width', (l: CustomSimulationLink) => (l.width || 2) * 1.5);
        
        tooltip.attr('transform', `translate(${d.x || 0},${(d.y || 0) - (d.size || 15) - 30})`);
        tooltip.select('text')
          .text(() => {
            if (d.visitedCount && d.visitedCount > 0) {
              return `${d.label || d.id} (Visited ${d.visitedCount}×)`;
            }
            return d.label || d.id;
          });
        
        tooltip.transition()
          .duration(300)
          .style('opacity', 1);
      })
      .on('mouseleave', function (this: SVGGElement, _event: MouseEvent, d: NodeData) {
        const currentSelection = select<SVGGElement, NodeData>(this);
        currentSelection.select<SVGCircleElement>('circle:not(.visit-indicator)')
          .transition()
          .duration(500)
          .attr('r', d.size || 15)
          .style('stroke-width', d.id === highlightedNodeId ? 2.5 : 1.5)
          .style('stroke', d.id === highlightedNodeId ? '#fff' : 'rgba(255, 255, 255, 0.6)');

        linkElements
          .transition()
          .duration(500)
          .style('stroke-opacity', 0.6)
          .style('stroke-width', (l: CustomSimulationLink) => l.width || 2);

        tooltip.transition()
          .duration(200)
          .style('opacity', 0);
      });

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, [nodesData, linksData, onNodeClick, width, height, highlightedNodeId, zoomToNode, enableZoomAnimation]);

    return (
    <div className="node-map-container" style={{ 
      width: '100%', 
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }}></svg>
    </div>
  );
};

export default NodeMap;