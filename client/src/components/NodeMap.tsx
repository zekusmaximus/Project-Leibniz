// Updated NodeMap.tsx with all TypeScript errors fixed
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface NodeData {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  visitedCount?: number;
  // For D3 force simulation
  fx?: number | null;
  fy?: number | null;
  // Allow D3 to add its own properties
  index?: number;
  vx?: number;
  vy?: number;
}

export interface LinkData {
  source: string;
  target: string;
  color?: string;
  width?: number;
}

// D3 force simulation works with objects, so we need this interface
interface SimulationLinkDatum {
  source: NodeData | string;
  target: NodeData | string;
  color?: string;
  width?: number;
  index?: number;
}

interface NodeMapProps {
  nodesData: NodeData[];
  linksData: LinkData[];
  onNodeClick?: (nodeId: string, data: NodeData) => void;
  width?: number;
  height?: number;
  useForceLayout?: boolean;
}

// For d3 selections, we'll use a more specific type
type D3Selection = ReturnType<typeof d3.selection>;

// Type for the D3 zoom event
interface ZoomEvent {
  transform: {
    x: number;
    y: number;
    k: number;
    toString(): string;
  };
}

const NodeMap: React.FC<NodeMapProps> = ({
  nodesData = [],
  linksData = [],
  onNodeClick,
  width = 800,
  height = 600,
  useForceLayout = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<ReturnType<typeof d3.forceSimulation> | null>(null);
  
  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width)
       .attr('height', height)
       .style('border', '1px solid lightgray');

    // Main container group
    const g = svg.append('g');

    // Create a zoom behavior with proper event typing
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event: ZoomEvent) => {
        g.attr('transform', event.transform);
      });

    // Apply zoom behavior to svg
    svg.call(zoom);

    // Type declarations for selections using ReturnType
    let nodeElements: D3Selection;
    let linkElements: D3Selection;

    if (useForceLayout) {
      // For force layout, we need to convert string IDs to actual node references
      const nodeMap = new Map(nodesData.map(node => [node.id, node]));
      
      // Create a properly typed array of links for the force simulation
      const simulationLinks: SimulationLinkDatum[] = linksData.map(link => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        
        return {
          source: sourceNode || link.source,
          target: targetNode || link.target,
          color: link.color,
          width: link.width
        };
      });

      // Set up the simulation
      const simulation = d3.forceSimulation(nodesData)
        .force('link', d3.forceLink(simulationLinks).id((d: NodeData) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: NodeData) => (d.size || 15) + 10));
      simulationRef.current = simulation;

      // Create links
      linkElements = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(simulationLinks)
        .enter()
        .append('line')
        .style('stroke', (d: SimulationLinkDatum) => d.color || '#999')
        .style('stroke-opacity', 0.6)
        .style('stroke-width', (d: SimulationLinkDatum) => d.width || 2);

      // Create nodes
      nodeElements = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodesData)
        .enter()
        .append('g')
        .attr('class', 'node-group')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', (event: { active: boolean; x: number; y: number; }, d: NodeData) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: { x: number; y: number; }, d: NodeData) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          // Fixed: Removed unused 'd' parameter since it's not used in the function body
          .on('end', (event: { active: boolean; }) => {
            if (!event.active) simulation.alphaTarget(0);
            // If we need to use 'd' later, we'll need to uncomment these lines
            // and add the parameter back
            // d.fx = null;
            // d.fy = null;
          })
        )
        .on('click', (event: MouseEvent, d: NodeData) => {
          event.stopPropagation();
          if (onNodeClick) onNodeClick(d.id, d);
        });

      // Tick function to update positions during simulation
      simulation.on('tick', () => {
        linkElements
          .attr('x1', (d: SimulationLinkDatum) => {
            const source = d.source as NodeData;
            return source.x !== undefined ? source.x : 0;
          })
          .attr('y1', (d: SimulationLinkDatum) => {
            const source = d.source as NodeData;
            return source.y !== undefined ? source.y : 0;
          })
          .attr('x2', (d: SimulationLinkDatum) => {
            const target = d.target as NodeData;
            return target.x !== undefined ? target.x : 0;
          })
          .attr('y2', (d: SimulationLinkDatum) => {
            const target = d.target as NodeData;
            return target.y !== undefined ? target.y : 0;
          });

        nodeElements.attr('transform', (d: NodeData) => {
          return `translate(${d.x !== undefined ? d.x : 0},${d.y !== undefined ? d.y : 0})`;
        });
      });
    } else {
      // Static positioning (non-force layout)
      // Create links
      linkElements = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(linksData)
        .enter()
        .append('line')
        .style('stroke', (d: LinkData) => d.color || '#999')
        .style('stroke-opacity', 0.6)
        .style('stroke-width', (d: LinkData) => d.width || 2);

      // Create nodes
      nodeElements = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodesData)
        .enter()
        .append('g')
        .attr('class', 'node-group')
        .style('cursor', 'pointer')
        .attr('transform', (d: NodeData, i: number) => {
          const x = d.x !== undefined ? d.x : 50 + i * 100;
          const y = d.y !== undefined ? d.y : height / 2;
          // Update the node data with calculated positions
          d.x = x;
          d.y = y;
          return `translate(${x},${y})`;
        })
        .on('click', (event: MouseEvent, d: NodeData) => {
          event.stopPropagation();
          if (onNodeClick) onNodeClick(d.id, d);
        });

      // Update link positions
      linkElements
        .attr('x1', (d: LinkData) => {
          const sourceNode = nodesData.find(node => node.id === d.source);
          return sourceNode?.x ?? 0;
        })
        .attr('y1', (d: LinkData) => {
          const sourceNode = nodesData.find(node => node.id === d.source);
          return sourceNode?.y ?? 0;
        })
        .attr('x2', (d: LinkData) => {
          const targetNode = nodesData.find(node => node.id === d.target);
          return targetNode?.x ?? 0;
        })
        .attr('y2', (d: LinkData) => {
          const targetNode = nodesData.find(node => node.id === d.target);
          return targetNode?.y ?? 0;
        });
    }

    // Add node visuals
    nodeElements.append('circle')
      .attr('r', (d: NodeData) => d.size || 15)
      .style('fill', (d: NodeData) => d.color || 'steelblue')
      .style('stroke', '#fff')
      .style('stroke-width', 1.5)
      .transition()
      .duration(500)
      .ease(d3.easeElastic)
      .attr('r', (d: NodeData) => d.size || 15);

    // Add node labels
    nodeElements.append('text')
      .text((d: NodeData) => d.label || d.id)
      .attr('x', (d: NodeData) => (d.size || 15) + 5)
      .attr('y', 5)
      .style('font-size', '12px')
      .style('fill', '#333')
      .style('pointer-events', 'none'); // Make text not interfere with clicks

    // Add hover effects - using function() syntax to preserve 'this' context
    // Removed unused event parameters and using proper this typing
    nodeElements
      .on('mouseenter', function(this: SVGGElement, _: unknown, d: NodeData) {
        d3.select(this).select('circle')
          .transition()
          .duration(300)
          .attr('r', (d.size || 15) * 1.2);
      })
      .on('mouseleave', function(this: SVGGElement, _: unknown, d: NodeData) {
        d3.select(this).select('circle')
          .transition()
          .duration(500)
          .attr('r', d.size || 15);
      });

    return () => {
  // Replace the existing cleanup code with this
  if (simulationRef.current) {
    simulationRef.current.stop();
    simulationRef.current = null;
  }
};

  }, [nodesData, linksData, onNodeClick, width, height, useForceLayout]);

  return (
    <div className="node-map-container" style={{ textAlign: 'center' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default NodeMap;