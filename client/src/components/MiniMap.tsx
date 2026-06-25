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
  onTrail?: boolean;
}

// d3 is loosely typed (see src/d3.d.ts), so we describe the scale functions we
// pass around explicitly to keep the render callbacks type-safe.
type ScaleFn = (value: number) => number;

// Build a finite [min, max] from possibly-missing coordinates. Newly revealed
// nodes may not have a position yet (they get one only after a settled main-map
// layout), and feeding undefined into d3.extent yields a NaN domain — which
// then paints every cx/cy/x1 as NaN. Falling back keeps the scales finite.
function finiteExtent(values: (number | undefined)[], fallback: [number, number]): [number, number] {
  const finite = values.filter((v): v is number => Number.isFinite(v));
  return finite.length ? [Math.min(...finite), Math.max(...finite)] : fallback;
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

  // Function to render the map with given scales
  const renderMap = useCallback((xScale: ScaleFn, yScale: ScaleFn) => {
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
        color: link.color,
        onTrail: link.onTrail
      };
    }).filter(link => !!link.source && !!link.target);

    // Draw links — walked edges (the trail) are drawn gold and a touch thicker.
    svg.selectAll('line')
      .data(processedLinks)
      .enter()
      .append('line')
      .attr('x1', (d: ProcessedLink) => xScale(d.source?.x || 0))
      .attr('y1', (d: ProcessedLink) => yScale(d.source?.y || 0))
      .attr('x2', (d: ProcessedLink) => xScale(d.target?.x || 0))
      .attr('y2', (d: ProcessedLink) => yScale(d.target?.y || 0))
      .style('stroke', (d: ProcessedLink) => d.onTrail ? '#ffcc00' : (d.color || '#555'))
      .style('stroke-width', (d: ProcessedLink) => d.onTrail ? 2 : 1)
      .style('stroke-opacity', (d: ProcessedLink) => d.onTrail ? 0.9 : 0.6);

    // Draw nodes
    svg.selectAll('circle')
      .data(nodesData)
      .enter()
      .append('circle')
      .attr('cx', (d: NodeData) => xScale(d.x || 0))
      .attr('cy', (d: NodeData) => yScale(d.y || 0))
      .attr('r', (d: NodeData) => Math.max(3, (d.size || 15) / 5))
      .style('fill', (d: NodeData) => {
        if (d.id === currentNodeId) return '#ffcc00';
        if (d.visitedCount && d.visitedCount > 0) return d.color || '#6a0dad';
        return d.color || 'steelblue';
      })
      // Fade older visits to mirror the main map's cooling trail; the current
      // node stays fully lit, unvisited nodes (no recency) are unaffected.
      .style('fill-opacity', (d: NodeData) => (d.id === currentNodeId ? 1 : d.recency ?? 1))
      .style('stroke', (d: NodeData) => d.id === currentNodeId ? '#fff' : 'none')
      .style('stroke-width', 1);

    // Draw small labels for nodes
    svg.selectAll('text')
      .data(nodesData)
      .enter()
      .append('text')
      .attr('x', (d: NodeData) => xScale(d.x || 0))
      .attr('y', (d: NodeData) => yScale(d.y || 0) + 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '6px')
      .style('fill', 'rgba(255, 255, 255, 0.7)')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.label || d.id || '');

    // Visit-order numbers (top-left of each visited node), mirroring the main
    // map so the sequence the reader walked is legible here too.
    svg.selectAll('text.mini-order')
      .data(nodesData.filter((n: NodeData) => n.visitOrder !== undefined))
      .enter()
      .append('text')
      .attr('class', 'mini-order')
      .attr('x', (d: NodeData) => xScale(d.x || 0) - 5)
      .attr('y', (d: NodeData) => yScale(d.y || 0) - 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '7px')
      .style('font-weight', 'bold')
      .style('fill', '#ffcc00')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.visitOrder?.toString() ?? '');

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

  // Function to zoom to fit all nodes
  const zoomToFit = useCallback(() => {
    if (!svgRef.current || !nodesData.length) return;

    // Calculate bounds and render
    const xExtent = finiteExtent(nodesData.map((d: NodeData) => d.x), [0, width]);
    const yExtent = finiteExtent(nodesData.map((d: NodeData) => d.y), [0, height]);

    const padding = 20;

    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - padding, xExtent[1] + padding])
      .range([padding, width - padding]);

    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - padding, yExtent[1] + padding])
      .range([padding, height - padding]);

    renderMap(xScale, yScale);
  }, [nodesData, width, height, renderMap]);

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

  // Main effect to draw the mini map
  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;

    // Calculate bounds and initial scales
    const xExtent = finiteExtent(nodesData.map((d: NodeData) => d.x), [0, width]);
    const yExtent = finiteExtent(nodesData.map((d: NodeData) => d.y), [0, height]);

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
      d3.select(svgRef.current).on('click', (event: MouseEvent) => {
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
