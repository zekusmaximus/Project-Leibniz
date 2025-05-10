// client/src/components/MiniMap.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NodeData, LinkData } from './NodeMap';

interface MiniMapProps {
  nodesData: NodeData[];
  linksData: LinkData[];
  width?: number;
  height?: number;
  currentNodeId?: string;
  onMiniMapClick?: (x: number, y: number) => void;
}

const MiniMap: React.FC<MiniMapProps> = ({
  nodesData,
  linksData,
  width = 150,
  height = 150,
  currentNodeId,
  onMiniMapClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    svg.attr('width', width)
       .attr('height', height)
       .style('border', '1px solid rgba(255, 255, 255, 0.2)')
       .style('border-radius', '4px')
       .style('background', 'rgba(20, 25, 35, 0.8)');
    
    // Calculate bounds of the full graph
    const xExtent = d3.extent(nodesData, d => d.x) as [number, number];
    const yExtent = d3.extent(nodesData, d => d.y) as [number, number];
    
    // Create scale functions
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 50, xExtent[1] + 50])
      .range([10, width - 10]);
      
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 50, yExtent[1] + 50])
      .range([10, height - 10]);
    
    // Draw links
    svg.selectAll('line')
      .data(linksData)
      .enter()
      .append('line')
      .attr('x1', d => {
        const sourceNode = nodesData.find(node => node.id === d.source) || 
                          nodesData.find(node => (node as any).id === (d.source as any).id);
        return xScale(sourceNode?.x || 0);
      })
      .attr('y1', d => {
        const sourceNode = nodesData.find(node => node.id === d.source) ||
                          nodesData.find(node => (node as any).id === (d.source as any).id);
        return yScale(sourceNode?.y || 0);
      })
      .attr('x2', d => {
        const targetNode = nodesData.find(node => node.id === d.target) ||
                          nodesData.find(node => (node as any).id === (d.target as any).id);
        return xScale(targetNode?.x || 0);
      })
      .attr('y2', d => {
        const targetNode = nodesData.find(node => node.id === d.target) ||
                          nodesData.find(node => (node as any).id === (d.target as any).id);
        return yScale(targetNode?.y || 0);
      })
      .style('stroke', d => d.color || '#555')
      .style('stroke-width', 1)
      .style('stroke-opacity', 0.6);
    
    // Draw nodes
    svg.selectAll('circle')
      .data(nodesData)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.x || 0))
      .attr('cy', d => yScale(d.y || 0))
      .attr('r', d => Math.max(3, (d.size || 15) / 5))
      .style('fill', d => {
        if (d.id === currentNodeId) return '#ffcc00';
        return d.color || 'steelblue';
      })
      .style('stroke', d => d.id === currentNodeId ? '#fff' : 'none')
      .style('stroke-width', 1);
    
    // Draw viewport rect (placeholder for now)
    const viewportWidth = width * 0.3;
    const viewportHeight = height * 0.3;
    
    svg.append('rect')
      .attr('class', 'viewport')
      .attr('x', (width - viewportWidth) / 2)
      .attr('y', (height - viewportHeight) / 2)
      .attr('width', viewportWidth)
      .attr('height', viewportHeight)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .attr('stroke-dasharray', '3,3');
    
    // Handle clicks on the minimap
    if (onMiniMapClick) {
      svg.on('click', function(event: MouseEvent) {
        const [x, y] = d3.pointer(event);
        const originalX = xScale.invert(x);
        const originalY = yScale.invert(y);
        onMiniMapClick(originalX, originalY);
      });
    }
    
  }, [nodesData, linksData, width, height, currentNodeId, onMiniMapClick]);
  
  return (
    <div className="mini-map" style={{ 
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      zIndex: 10,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
    }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default MiniMap;