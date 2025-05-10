// client/src/components/NodeMap.tsx (updated with animations)
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
  highlightedNodeId?: string;
  zoomToNode?: string;
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
  highlightedNodeId,
  zoomToNode,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<ReturnType<typeof d3.forceSimulation> | null>(null);
  const zoomRef = useRef<ReturnType<typeof d3.zoom> | null>(null);
  
  // Effect to initialize and update the visualization
  useEffect(() => {
    if (!svgRef.current || !nodesData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width)
       .attr('height', height)
       .style('border', '1px solid rgba(255, 255, 255, 0.1)')
       .style('border-radius', '8px')
       .style('background', 'rgba(20, 25, 35, 0.5)');

    // Main container group
    const g = svg.append('g')
                 .attr('class', 'main-group');

    // Create a zoom behavior with proper event typing
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });
    
    zoomRef.current = zoom;

    // Apply zoom behavior to svg
    svg.call(zoom);

    // Add a subtle grid for visual reference
    const gridSize = 40;
    const gridGroup = g.append('g').attr('class', 'grid');
    
    // Horizontal grid lines
    for (let i = 0; i < height; i += gridSize) {
      gridGroup.append('line')
        .attr('x1', 0)
        .attr('y1', i)
        .attr('x2', width)
        .attr('y2', i)
        .style('stroke', 'rgba(255, 255, 255, 0.05)');
    }
    
    // Vertical grid lines
    for (let i = 0; i < width; i += gridSize) {
      gridGroup.append('line')
        .attr('x1', i)
        .attr('y1', 0)
        .attr('x2', i)
        .attr('y2', height)
        .style('stroke', 'rgba(255, 255, 255, 0.05)');
    }

    // Type declarations for selections using ReturnType
    let nodeElements: D3Selection;
    let linkElements: D3Selection;

    if (useForceLayout) {
      // For force layout, we convert string IDs to actual node references
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

      // Set up the simulation with more dynamic forces
      const simulation = d3.forceSimulation(nodesData)
        .force('link', d3.forceLink(simulationLinks).id((d: NodeData) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-150))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: NodeData) => (d.size || 15) + 15))
        .force('x', d3.forceX(width / 2).strength(0.05))
        .force('y', d3.forceY(height / 2).strength(0.05));
      
      simulationRef.current = simulation;

      // Create links with gradients for nicer styling
      const linksGroup = g.append('g').attr('class', 'links');
      
      // Create gradients for each link
      const defs = svg.append("defs");
      
      simulationLinks.forEach((link, i) => {
        const gradientId = `link-gradient-${i}`;
        const gradient = defs.append("linearGradient")
          .attr("id", gradientId)
          .attr("gradientUnits", "userSpaceOnUse");
        
        // Get source and target colors
        const sourceNode = typeof link.source === 'object' ? link.source : null;
        const targetNode = typeof link.target === 'object' ? link.target : null;
        
        const sourceColor = sourceNode?.color || '#999';
        const targetColor = targetNode?.color || '#999';
        
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", sourceColor);
          
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", targetColor);
      });

      // Create links
      linkElements = linksGroup.selectAll('line')
        .data(simulationLinks)
        .enter()
        .append('line')
        .style('stroke', (d: SimulationLinkDatum, i: number) => `url(#link-gradient-${i})`)
        .style('stroke-opacity', 0.6)
        .style('stroke-width', (d: SimulationLinkDatum) => d.width || 2);

      // Create nodes with more visual elements
      const nodesGroup = g.append('g').attr('class', 'nodes');
      
      nodeElements = nodesGroup.selectAll('g')
        .data(nodesData)
        .enter()
        .append('g')
        .attr('class', 'node-group')
        .style('cursor', 'pointer')
        .call(d3.drag<SVGGElement, NodeData>()
          .on('start', (event: any, d: NodeData) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: any, d: NodeData) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: any, d: NodeData) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
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

    // Add node visuals with glow effects
    // First add a glow filter
    const defs = svg.append("defs");
    
    // Add different glow filters based on node types/states
    const glowColors = [
      { id: "glow-normal", color: "white", strength: 2 },
      { id: "glow-visited", color: "#6a0dad", strength: 3 },
      { id: "glow-highlighted", color: "#ffcc00", strength: 5 }
    ];
    
    glowColors.forEach(({ id, color, strength }) => {
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

    // Add node backgrounds for glow effect
    nodeElements.append('circle')
      .attr('r', (d: NodeData) => (d.size || 15) + 5)
      .style('fill', 'transparent')
      .style('filter', (d: NodeData) => {
        if (d.id === highlightedNodeId) return 'url(#glow-highlighted)';
        if (d.visitedCount && d.visitedCount > 0) return 'url(#glow-visited)';
        return 'url(#glow-normal)';
      })
      .style('opacity', 0.7);

    // Add node circles
    nodeElements.append('circle')
      .attr('r', 0) // Start with radius 0 for animation
      .style('fill', (d: NodeData) => {
        // Base color logic
        let baseColor = d.color || 'steelblue';
        
        // Modify color based on visit count
        if (d.visitedCount && d.visitedCount > 1) {
          baseColor = '#6a0dad'; // Purple for visited nodes
        }
        
        // Highlight the current node
        if (d.id === highlightedNodeId) {
          baseColor = '#ffcc00'; // Gold for highlighted node
        }
        
        return baseColor;
      })
      .style('stroke', (d: NodeData) => d.id === highlightedNodeId ? '#fff' : 'rgba(255, 255, 255, 0.6)')
      .style('stroke-width', (d: NodeData) => d.id === highlightedNodeId ? 2.5 : 1.5)
      .transition()
      .duration(800)
      .ease(d3.easeBounce)
      .attr('r', (d: NodeData) => d.size || 15);

    // Add pulsing animation for highlighted node
    if (highlightedNodeId) {
      nodeElements
        .filter((d: NodeData) => d.id === highlightedNodeId)
        .select('circle')
        .call(selection => {
          const pulse = () => {
            selection
              .transition()
              .duration(1000)
              .attr('r', (d: NodeData) => (d.size || 15) * 1.2)
              .transition()
              .duration(1000)
              .attr('r', (d: NodeData) => d.size || 15)
              .on('end', pulse);
          };
          pulse();
        });
    }

    // Add connection lines that animate when created
    linkElements
      .style('stroke-dasharray', '5,5')
      .style('stroke-dashoffset', 10)
      .transition()
      .duration(1500)
      .style('stroke-dashoffset', 0);

    // Add node labels with better styling
    nodeElements.append('text')
      .text((d: NodeData) => d.label || d.id)
      .attr('x', 0)
      .attr('y', (d: NodeData) => (d.size || 15) + 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', 'rgba(255, 255, 255, 0.9)')
      .style('pointer-events', 'none') // Make text not interfere with clicks
      .style('text-shadow', '0px 0px 3px rgba(0, 0, 0, 0.7)');

    // Add small indicators for visit count
    nodeElements
      .filter((d: NodeData) => d.visitedCount && d.visitedCount > 0)
      .append('circle')
      .attr('class', 'visit-indicator')
      .attr('r', 5)
      .attr('cx', (d: NodeData) => (d.size || 15) * 0.6)
      .attr('cy', (d: NodeData) => -(d.size || 15) * 0.6)
      .style('fill', '#ffcc00')
      .style('stroke', '#fff')
      .style('stroke-width', 1);

    // Add visit count text
    nodeElements
      .filter((d: NodeData) => d.visitedCount && d.visitedCount > 0)
      .append('text')
      .attr('class', 'visit-count')
      .attr('x', (d: NodeData) => (d.size || 15) * 0.6)
      .attr('y', (d: NodeData) => -(d.size || 15) * 0.6 + 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', '#000')
      .style('pointer-events', 'none')
      .text((d: NodeData) => d.visitedCount);

    // Add hover effects with improved animations
    nodeElements
      .on('mouseenter', function(this: SVGGElement, event: MouseEvent, d: NodeData) {
        // Highlight the node on hover
        d3.select(this).select('circle:not(.visit-indicator)')
          .transition()
          .duration(300)
          .attr('r', (d.size || 15) * 1.2)
          .style('stroke-width', 2.5)
          .style('stroke', '#fff');
          
        // Highlight connected links and nodes
        const connectedLinks = linkElements.filter((link: any) => {
          return link.source === d || link.target === d || 
                 link.source.id === d.id || link.target.id === d.id;
        });
        
        connectedLinks
          .transition()
          .duration(300)
          .style('stroke-opacity', 1)
          .style('stroke-width', (l: any) => (l.width || 2) * 1.5);
          
        // Show tooltip with node info
        g.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${d.x !== undefined ? d.x : 0},${d.y !== undefined ? d.y - (d.size || 15) - 30 : 0})`)
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .transition()
          .duration(300)
          .style('opacity', 1);
          
        g.select('.tooltip')
          .append('rect')
          .attr('x', -60)
          .attr('y', -25)
          .attr('width', 120)
          .attr('height', 25)
          .attr('rx', 5)
          .attr('ry', 5)
          .style('fill', 'rgba(0, 0, 0, 0.7)');
          
        g.select('.tooltip')
          .append('text')
          .attr('x', 0)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .style('fill', '#fff')
          .style('font-size', '12px')
          .text(() => {
            if (d.visitedCount && d.visitedCount > 0) {
              return `${d.label || d.id} (Visited ${d.visitedCount}×)`;
            }
            return d.label || d.id;
          });
      })
      .on('mouseleave', function(this: SVGGElement, event: MouseEvent, d: NodeData) {
        // Restore node appearance
        d3.select(this).select('circle:not(.visit-indicator)')
          .transition()
          .duration(500)
          .attr('r', d.size || 15)
          .style('stroke-width', d.id === highlightedNodeId ? 2.5 : 1.5)
          .style('stroke', d.id === highlightedNodeId ? '#fff' : 'rgba(255, 255, 255, 0.6)');
          
        // Restore links
        linkElements
          .transition()
          .duration(500)
          .style('stroke-opacity', 0.6)
          .style('stroke-width', (l: any) => l.width || 2);
          
        // Remove tooltip
        g.select('.tooltip')
          .transition()
          .duration(200)
          .style('opacity', 0)
          .remove();
      });

    // Zoom to highlighted node if specified
    if (zoomToNode) {
      const targetNode = nodesData.find(node => node.id === zoomToNode);
      if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined && zoomRef.current) {
        const tx = width / 2 - targetNode.x;
        const ty = height / 2 - targetNode.y;
        
        svg.transition()
          .duration(750)
          .call(
            zoomRef.current.transform as any,
            d3.zoomIdentity.translate(tx, ty).scale(1.2)
          );
      }
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };

  }, [nodesData, linksData, onNodeClick, width, height, useForceLayout, highlightedNodeId, zoomToNode]);

  return (
    <div className="node-map-container" style={{ textAlign: 'center' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default NodeMap;