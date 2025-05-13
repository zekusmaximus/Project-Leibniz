// src/components/MiniMap.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { NodeData, LinkData } from './NodeMap';

interface MiniMapProps {
  nodesData: NodeData[];
  linksData: LinkData[];
  width?: number;
  height?: number;
  currentNodeId?: string;
  onMiniMapClick?: (x: number, y: number) => void;
  onZoomToFitRef?: React.MutableRefObject<(() => void) | null>;
}

// Interface for our processed links after mapping
interface ProcessedLink {
  source: NodeData | undefined;
  target: NodeData | undefined;
  color?: string;
}

const MiniMap: React.FC<MiniMapProps> = ({
  nodesData,
  linksData,
  width = 150,
  height = 150,
  currentNodeId,
  onMiniMapClick,
  onZoomToFitRef
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Function to zoom to fit all nodes
  const zoomToFit = useCallback(() => {
    if (!svgRef.current || !nodesData.length) return;
    
    // Calculate bounds and render
    const xExtent = d3.extent(nodesData, (d: NodeData) => d.x) as [number, number];
    const yExtent = d3.extent(nodesData, (d: NodeData) => d.y) as [number, number];
    
    const padding = 20;
    
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - padding, xExtent[1] + padding])
      .range([padding, width - padding]);
      
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - padding, yExtent[1] + padding])
      .range([padding, height - padding]);
    
    renderMap(xScale, yScale);
  }, [nodesData, width, height]);

  // Expose the zoomToFit function through the ref
  useEffect(() => {
    if (onZoomToFitRef) {
      onZoomToFitRef.current = zoomToFit;
    }
    
    return () => {
      if (onZoomToFitRef) {
        onZoomToFitRef.current = null;
      }
    };
  }, [onZoomToFitRef, zoomToFit]);

  // Function to render the map with given scales
  // @ts-ignore - Ignore TypeScript errors for scale parameters
  const renderMap = useCallback((xScale, yScale) => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    svg.attr('width', width)
       .attr('height', height)
       .attr('viewBox', `0 0 ${width} ${height}`)
       .style('border', '1px solid rgba(255, 255, 255, 0.2)')
       .style('border-radius', '4px')
       .style('background', 'rgba(20, 25, 35, 0.8)');
    
    // Process links
    const processedLinks: ProcessedLink[] = linksData.map(link => {
  const sourceNode = typeof link.source === 'string'
    ? nodesData.find(n => n.id === link.source)
    : nodesData.find(n => n.id === (link.source as NodeData).id);
    
  const targetNode = typeof link.target === 'string'
    ? nodesData.find(n => n.id === link.target)
    : nodesData.find(n => n.id === (link.target as NodeData).id);
    
  return {
    source: sourceNode,
    target: targetNode,
    color: link.color
  };
}).filter(link => !!link.source && !!link.target);
    
    // Draw links
    svg.selectAll('line')
      .data(processedLinks)
      .enter()
      .append('line')
      // @ts-ignore - Ignore TypeScript errors for d3 callbacks
      .attr('x1', d => xScale(d.source?.x || 0))
      // @ts-ignore
      .attr('y1', d => yScale(d.source?.y || 0))
      // @ts-ignore
      .attr('x2', d => xScale(d.target?.x || 0))
      // @ts-ignore
      .attr('y2', d => yScale(d.target?.y || 0))
      // @ts-ignore
      .style('stroke', d => d.color || '#555')
      .style('stroke-width', 1)
      .style('stroke-opacity', 0.6);
    
    // Draw nodes
    svg.selectAll('circle')
      .data(nodesData)
      .enter()
      .append('circle')
      // @ts-ignore
      .attr('cx', d => xScale(d.x || 0))
      // @ts-ignore
      .attr('cy', d => yScale(d.y || 0))
      // @ts-ignore
      .attr('r', d => Math.max(3, (d.size || 15) / 5))
      // @ts-ignore
      .style('fill', d => {
        if (d.id === currentNodeId) return '#ffcc00';
        if (d.visitedCount && d.visitedCount > 0) return d.color || '#6a0dad';
        return d.color || 'steelblue';
      })
      // @ts-ignore
      .style('stroke', d => d.id === currentNodeId ? '#fff' : 'none')
      .style('stroke-width', 1);
    
    // Draw small labels for nodes
    svg.selectAll('text')
      .data(nodesData)
      .enter()
      .append('text')
      // @ts-ignore
      .attr('x', d => xScale(d.x || 0))
      // @ts-ignore
      .attr('y', d => yScale(d.y || 0) + 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '6px')
      .style('fill', 'rgba(255, 255, 255, 0.7)')
      .style('pointer-events', 'none')
      // @ts-ignore
      .text(d => d.label || d.id || '');
    
    // Draw current viewport indicator
    if (currentNodeId) {
      const currentNode = nodesData.find(n => n.id === currentNodeId);
      if (currentNode) {
        svg.append('circle')
          .attr('cx', xScale(currentNode.x || 0))
          .attr('cy', yScale(currentNode.y || 0))
          .attr('r', Math.max(5, (currentNode.size || 15) / 4))
          .style('fill', 'none')
          .style('stroke', '#ffcc00')
          .style('stroke-width', 1.5)
          .style('stroke-dasharray', '2,2')
          .style('opacity', 0.8);
      }
    }
  }, [nodesData, linksData, width, height, currentNodeId]);

  // Main effect to draw the mini map
  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;
    
    // Calculate bounds and initial scales
    const xExtent = d3.extent(nodesData, (d: NodeData) => d.x) as [number, number];
    const yExtent = d3.extent(nodesData, (d: NodeData) => d.y) as [number, number];
    
    const padding = 15;
    
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - padding, xExtent[1] + padding])
      .range([10, width - 10]);
      
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - padding, yExtent[1] + padding])
      .range([10, height - 10]);
    
    // Initial render
    renderMap(xScale, yScale);
    
    // Handle clicks on the minimap
    if (onMiniMapClick && svgRef.current) {
      // @ts-ignore - Ignore TypeScript errors for d3 event handling
      d3.select(svgRef.current).on('click', function(event) {
        // @ts-ignore
        const [x, y] = d3.pointer(event);
        const originalX = xScale.invert(x);
        const originalY = yScale.invert(y);
        onMiniMapClick(originalX, originalY);
      });
    }
  }, [nodesData, linksData, width, height, currentNodeId, onMiniMapClick, renderMap]);

  return (
    <div className="mini-map" style={{ 
      zIndex: 10,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
      borderRadius: '4px',
      overflow: 'hidden'
    }}>
      <svg 
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
      ></svg>
    </div>
  );
};

export default MiniMap;