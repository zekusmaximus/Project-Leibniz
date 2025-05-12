// src/pages/NarrativePage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import MiniMap from '../components/MiniMap';
import storyLogicService from '../services/StoryLogicService';
import { useEffect, useState } from 'react';

const NarrativePage = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const { state, visitNode, getVisibleNodes, getVisibleLinks, getCurrentNode } = useStory();
  const [backgroundColor, setBackgroundColor] = useState('#1e232d');
  
  useEffect(() => {
    if (!nodeId) return;
    
    const currentNode = state.nodes[nodeId];
    if (currentNode) {
      setBackgroundColor(currentNode.color || '#1e232d');
    }
  }, [nodeId, state.nodes]);

  // Get current node text
  const currentNodeText = nodeId 
    ? storyLogicService.getNodeText(nodeId, state) 
    : "";

  // Convert story nodes to D3 node format for MiniMap
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

  const handleMiniMapClick = (x: number, y: number) => {
    // Find the closest node to the clicked coordinates
    let closestNode = d3Nodes[0];
    let minDistance = Infinity;
    
    d3Nodes.forEach(node => {
      const dx = (node.x || 0) - x;
      const dy = (node.y || 0) - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    });
    
    // Navigate to the selected node
    navigate(`/narrative/${closestNode.id}`);
    visitNode(closestNode.id);
  };

  const handleBackToMap = () => {
    navigate('/');
  };

  const nodeChoices = getCurrentNode()?.choices?.filter(
    choice => !choice.condition || choice.condition(state)
  );

  return (
    <motion.div 
      className="narrative-page"
      style={{ backgroundColor }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="narrative-content">
        <button className="back-button" onClick={handleBackToMap}>
          Back to Map
        </button>
        
        <h2>{getCurrentNode()?.label || ''}</h2>
        
        <div className="story-text-container">
          <p>{currentNodeText}</p>
          
          {nodeChoices && nodeChoices.length > 0 && (
            <div className="story-choices">
              <p>What would you like to do?</p>
              <div className="choice-buttons">
                {nodeChoices.map(choice => (
                  <button 
                    key={choice.targetId} 
                    onClick={() => {
                      navigate(`/narrative/${choice.targetId}`);
                      visitNode(choice.targetId);
                    }}
                    className="choice-button"
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mini-map-container">
        <MiniMap
          nodesData={d3Nodes}
          linksData={d3Links}
          width={180}
          height={180}
          currentNodeId={nodeId}
          onMiniMapClick={handleMiniMapClick}
        />
      </div>
    </motion.div>
  );
};

export default NarrativePage;