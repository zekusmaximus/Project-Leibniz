// src/pages/HomePage.tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import NodeMap from '../components/NodeMap';
import { NodeData } from '../components/NodeMap';
import SaveLoadControls from '../services/SaveLoadControls';
import storyLogicService from '../services/StoryLogicService';
import { getJourneyFrame } from '../services/mapVisuals';
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

  // Journey playback: `playbackStep` null means "live" (annotate with the whole
  // history); a number means the reader is scrubbing/replaying, so we annotate
  // the map from only the first N visits. Either way the same pure frame drives
  // visit-order badges, recency fade, the trail and the lit "current" node.
  const [playbackStep, setPlaybackStep] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const total = state.history.length;
  const isScrubbing = playbackStep !== null;
  const effectiveStep = isScrubbing ? playbackStep : total;
  const frame = getJourneyFrame(state.history, state.links, effectiveStep);
  const visitOrder = frame.visitOrder;
  const recency = frame.recency;
  const trailKeys = frame.trailKeys;
  // While scrubbing, the lit node is wherever the reader stood at that step;
  // live, it's the real current node.
  const currentId = isScrubbing ? frame.currentId : state.currentNodeId;

  // Auto-advance the replay one visit at a time; on reaching the end, snap back
  // to live. Cleared on pause/unmount.
  useEffect(() => {
    if (!isPlaying) return;
    if (total === 0) {
      setIsPlaying(false);
      return;
    }
    const id = setInterval(() => {
      setPlaybackStep((prev) => {
        const next = (prev ?? 0) + 1;
        if (next >= total) {
          setIsPlaying(false);
          return null; // back to live at the end of the replay
        }
        return next;
      });
    }, 750);
    return () => clearInterval(id);
  }, [isPlaying, total]);

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Restart from the beginning if we're live or already at the end.
    setPlaybackStep((prev) => (prev == null || prev >= total ? 1 : prev));
    setIsPlaying(true);
  };

  const handleScrub = (value: number) => {
    setIsPlaying(false);
    // Dragging to the end returns to the live view.
    setPlaybackStep(value >= total ? null : value);
  };

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
  isCurrent: node.id === currentId,
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
    // Leaving a replay: a fresh visit always returns the map to live.
    setIsPlaying(false);
    setPlaybackStep(null);
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

      {total >= 2 && (
        <div className="journey-controls">
          <button
            type="button"
            className="journey-play"
            onClick={handlePlayToggle}
            aria-label={isPlaying ? 'Pause replay' : 'Replay journey'}
            title={isPlaying ? 'Pause replay' : 'Replay your journey'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            className="journey-slider"
            min={1}
            max={total}
            value={effectiveStep}
            onChange={(e) => handleScrub(Number(e.target.value))}
            aria-label="Scrub through your journey"
          />
          <span className="journey-label">
            {isScrubbing
              ? `Step ${effectiveStep} / ${total}${
                  currentId ? ` · ${state.nodes[currentId]?.label ?? currentId}` : ''
                }`
              : 'Live'}
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default HomePage;