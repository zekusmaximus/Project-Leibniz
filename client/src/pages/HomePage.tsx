// src/pages/HomePage.tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import NodeMap from '../components/NodeMap';
import { NodeData } from '../components/NodeMap';
import { useRef, useState, useEffect } from 'react';

const HomePage = () => {
  const navigate = useNavigate();
  const { visitNode, getVisibleNodes, getVisibleLinks } = useStory();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeTransition, setNodeTransition] = useState<{
    nodeId: string, 
    x: number, 
    y: number
  } | null>(null);

  // Convert story nodes to D3 node format
  const d3Nodes = getVisibleNodes().map(node => ({
    id: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    color: node.color,
    size: node.size,
    visitedCount: node.visitedCount
  }));

  const d3Links = getVisibleLinks().map(link => ({
    source: link.source,
    target: link.target,
    color: link.color,
    width: link.width
  }));

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleNodeClick = (nodeId: string, nodeData: NodeData) => {
    visitNode(nodeId);
    
    // Store transition data for animation
    setNodeTransition({
      nodeId,
      x: nodeData.x || 0,
      y: nodeData.y || 0
    });
    
    // Delay navigation to allow for animation
    setTimeout(() => {
      navigate(`/narrative/${nodeId}`);
    }, 800); // This should match the animation duration
  };

  return (
    <motion.div 
      ref={containerRef}
      className="home-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="title">Eternal Return of the Digital Self</h1>
      
      <div className="node-map-container">
        <NodeMap
          nodesData={d3Nodes}
          linksData={d3Links}
          onNodeClick={handleNodeClick}
          width={dimensions.width}
          height={dimensions.height - 100} // Adjust for title height
          highlightedNodeId={nodeTransition?.nodeId}
          zoomToNode={nodeTransition?.nodeId}
          enableZoomAnimation={!!nodeTransition}
        />
      </div>
    </motion.div>
  );
};

export default HomePage;