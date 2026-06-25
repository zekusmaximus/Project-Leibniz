// src/pages/HomePage.tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import NodeMap from '../components/NodeMap';
import { NodeData } from '../components/NodeMap';
import SaveLoadControls from '../services/SaveLoadControls';
import storyLogicService from '../services/StoryLogicService';
import { getVisitOrder, getTrailLinkKeys, getVisitRecency } from '../services/mapVisuals';
import { useRef, useState, useEffect } from 'react';

const HomePage = () => {
  const navigate = useNavigate();
  const { state, visitNode, getVisibleNodes, getVisibleLinks } = useStory();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [nodeTransition, setNodeTransition] = useState<{
    nodeId: string, 
    x: number, 
    y: number
  } | null>(null);

  // Order-legibility annotations (pure, from mapVisuals): the first-visit
  // sequence number per node and the directed edges actually walked.
  const visitOrder = getVisitOrder(state.history);
  const recency = getVisitRecency(state.history);
  const trailKeys = getTrailLinkKeys(state.history, state.links);

  // Convert story nodes to D3 node format
  const d3Nodes = getVisibleNodes().map(node => ({
  id: node.id,
  label: node.label || node.id, // Ensure label exists
  x: node.x, // Let NodeMap handle undefined coordinates
  y: node.y,
  color: node.color || 'steelblue', // Default color
  size: node.size || 25, // Default size
  visitedCount: node.visitedCount || 0,
  visitOrder: visitOrder[node.id], // 1-based first-visit order, if visited
  recency: recency[node.id], // decay weight: recent visits stay lit, older fade
  isCurrent: node.id === state.currentNodeId,
  isEnding: storyLogicService.isEnding(node.id)
}));

const d3Links = getVisibleLinks().map(link => ({
  source: link.source,
  target: link.target,
  color: link.color || '#888', // Default color
  width: link.width || 2, // Default width
  onTrail: trailKeys.has(`${link.source}->${link.target}`) // walked edge → highlight
}));

// Add debug to check if we're getting data

  // Measure the actual map container (not the whole page) and feed its real
  // pixel size to NodeMap. The SVG fills this box via width/height:100%, so the
  // size we pass must equal the rendered size or D3's centering math (forceCenter,
  // zoomToFit) is computed against the wrong dimensions and the map sits
  // off-centre. A ResizeObserver keeps it correct across layout/resize.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const measure = () => setDimensions({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ensure nodes are positioned correctly when returning from narrative page
  useEffect(() => {
    // This forces a re-render of the NodeMap with proper positioning
    if (mapContainerRef.current && d3Nodes.length > 0) {
      // Reset any transition state
      setNodeTransition(null);
    }
  }, [d3Nodes.length]);

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
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh', // Use full viewport height
        padding: '20px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="title-container" style={{ 
        marginBottom: '20px',  // Ensure space below title
        paddingTop: '20px',    // Prevent title from being cut off at top
        textAlign: 'center'
      }}>
        <h1 className="title">Eternal Return of the Digital Self</h1>
        <SaveLoadControls className="home-save-load" />
      </div>
      
      <div 
        ref={mapContainerRef}
        className="node-map-container" 
        style={{ 
            flex: '1',
            width: '80%',              // Reduced from 100%
            maxWidth: '800px',         // Add maximum width constraint
            maxHeight: '70vh',         // Add maximum height constraint
            margin: '0 auto',          // Center horizontally
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)', // Add a subtle border
            borderRadius: '8px',
            minHeight: '400px'         // Reduced minimum height
  }}
      >
         <NodeMap
            nodesData={d3Nodes}
            linksData={d3Links}
            onNodeClick={handleNodeClick}
            width={dimensions.width} // Actual map-container pixel size
            height={dimensions.height}
            highlightedNodeId={nodeTransition?.nodeId}
            zoomToNode={nodeTransition?.nodeId}
            enableZoomAnimation={!!nodeTransition}
        />
      </div>
    </motion.div>
  );
};

export default HomePage;