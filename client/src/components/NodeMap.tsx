// client/src/components/NodeMap.tsx

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Define interfaces for your data structures
// It's good practice to export them if you'll use them in App.tsx or elsewhere
export interface NodeData {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  visitedCount?: number;
  // ... any other custom properties for your nodes
}

export interface LinkData {
  source: string; // ID of the source node
  target: string; // ID of the target node
  color?: string;
  // ... any other custom properties for your links
}

// Define the props interface for the NodeMap component
interface NodeMapProps {
  nodesData?: NodeData[];
  linksData?: LinkData[];
  onNodeClick?: (nodeId: string, data: NodeData) => void; // Be specific about callback params
  width?: number;
  height?: number;
}

const NodeMap: React.FC<NodeMapProps> = ({
  nodesData = [],
  linksData = [],
  onNodeClick,
  width = 800,
  height = 600,
}) => {
  // Specify the type of element the ref will point to (SVGSVGElement)
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodesData || !linksData) {
      return;
    }

    // d3.select can often infer types, but you can be explicit
    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3.select(svgRef.current);

    svg.selectAll('*').remove(); // Clear previous content

    svg.attr('width', width)
       .attr('height', height)
       .style('border', '1px solid lightgray');

    const g = svg.append('g');

    // --- Links ---
    const linkGroup = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksData) // D3 infers LinkData here for `d`
      .enter()
      .append('line')
      .style('stroke', (d: LinkData) => d.color || '#999')
      .style('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    // --- Nodes ---
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodesData) // D3 infers NodeData here for `d`
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: NodeData) => { // Explicitly type event and d
        if (onNodeClick) {
          onNodeClick(d.id, d);
        }
      });

    nodeGroup.append('circle')
      .attr('r', (d: NodeData) => d.size || 15)
      .style('fill', (d: NodeData) => d.color || 'steelblue');

    nodeGroup.append('text')
      .text((d: NodeData) => d.label || d.id)
      .attr('x', (d: NodeData) => (d.size || 15) + 5)
      .attr('y', 5)
      .style('font-size', '12px')
      .style('fill', '#333');

    // Positioning logic
    nodeGroup.attr('transform', (d: NodeData, i: number) => {
      const x = d.x !== undefined ? d.x : 50 + i * 100;
      const y = d.y !== undefined ? d.y : height / 2;
      d.x = x; // Mutating data like this is common in D3 examples,
      d.y = y; // but for React, consider if positions should be managed by React state
               // or if D3 fully owns the layout after initial data pass.
      return `translate(${x},${y})`;
    });

    linkGroup
      .attr('x1', (d: LinkData) => {
        const sourceNode = nodesData.find(node => node.id === d.source);
        return sourceNode?.x ?? 0; // Use optional chaining and nullish coalescing
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

    return () => {
      // Cleanup if necessary
    };
  }, [nodesData, linksData, onNodeClick, width, height]);

  return (
    <div className="node-map-container" style={{ textAlign: 'center' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default NodeMap;