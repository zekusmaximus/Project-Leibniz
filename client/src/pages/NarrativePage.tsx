// src/pages/NarrativePage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStory } from '../context/context';
import MiniMap from '../components/MiniMap';
import storyLogicService from '../services/StoryLogicService';
import { useRef, useState, useEffect, useCallback } from 'react';

const NarrativePage = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();
  const { state, visitNode, revealNode, revealLink, getVisibleNodes, getVisibleLinks, getCurrentNode } = useStory();
  const [backgroundColor, setBackgroundColor] = useState('#1e232d');
  
  // Add this ref for the mini map zoom function
  const miniMapZoomToFitRef = useRef<(() => void) | null>(null);
  
  // Add the handler
  const handleMiniMapZoomToFit = useCallback(() => {
    if (miniMapZoomToFitRef.current) {
      miniMapZoomToFitRef.current();
    }
  }, []);

  // Effect to handle node visiting and revealing connected paths
  useEffect(() => {
    if (!nodeId) return;
    
    const currentNode = state.nodes[nodeId];
    if (currentNode) {
      // First, make sure current node is revealed
      if (!currentNode.isRevealed) {
        console.log(`Revealing node ${nodeId} on page visit`);
        revealNode(nodeId, { ...currentNode, isRevealed: true });
      }
      
      // Then visit it to update count if not already visited
      if (!state.visitCounts[nodeId] || state.visitCounts[nodeId] === 0) {
        console.log(`Marking node ${nodeId} as visited`);
        visitNode(nodeId);
      }
      
      // Next, make sure any choices are revealed as nodes
      if (currentNode.choices) {
        currentNode.choices.forEach(choice => {
          const targetNode = state.nodes[choice.targetId];
          if (targetNode) {
            // Reveal the target node
            if (!targetNode.isRevealed) {
              console.log(`Revealing choice target node ${choice.targetId}`);
              revealNode(choice.targetId, { ...targetNode, isRevealed: true });
            }
            
            // Find and reveal the link between current node and target
            const linkToReveal = state.links.find(link => 
              link.source === nodeId && 
              link.target === choice.targetId
            );
            
            if (linkToReveal && !linkToReveal.isRevealed) {
              console.log(`Revealing link from ${nodeId} to ${choice.targetId}`);
              revealLink({
                ...linkToReveal,
                isRevealed: true
              });
            }
          }
        });
      }
      
      // Also reveal any links coming into this node
      state.links.forEach(link => {
        if (link.target === nodeId && !link.isRevealed) {
          const sourceNode = state.nodes[link.source];
          if (sourceNode && sourceNode.isRevealed) {
            console.log(`Revealing incoming link from ${link.source} to ${nodeId}`);
            revealLink({ ...link, isRevealed: true });
          }
        }
      });
      
      // Set background color based on node
      setBackgroundColor(currentNode.color || '#1e232d');
    }
  }, [nodeId, state.nodes, state.links, visitNode, revealNode, revealLink]);
  
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

  // For debugging
  console.log(`NarrativePage rendering with ${d3Nodes.length} nodes and ${d3Links.length} links`);
  console.log('Visible node IDs:', d3Nodes.map(n => n.id));
  console.log('Visible link pairs:', d3Links.map(l => `${l.source}->${l.target}`));

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
    if (closestNode && closestNode.id) {
      console.log(`MiniMap click navigating to node ${closestNode.id}`);
      navigate(`/narrative/${closestNode.id}`);
      visitNode(closestNode.id);
    }
  };

  const handleBackToMap = () => {
    navigate('/');
  };

  // Filter choices based on conditions if present
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
                      // First, make sure the target node is revealed
                      const targetNode = state.nodes[choice.targetId];
                      if (targetNode && !targetNode.isRevealed) {
                        console.log(`Revealing target node ${choice.targetId} on choice click`);
                        revealNode(choice.targetId, {
                          ...targetNode,
                          isRevealed: true
                        });
                      }
                      
                      // Next, reveal the link between current node and target
                      const link = state.links.find(l => 
                        l.source === nodeId && 
                        l.target === choice.targetId
                      );
                      if (link && !link.isRevealed) {
                        console.log(`Revealing link from ${nodeId} to ${choice.targetId} on choice click`);
                        revealLink({
                          ...link,
                          isRevealed: true
                        });
                      }
                      
                      // Then visit the node (this will increment visit count)
                      visitNode(choice.targetId);
                      
                      // Finally navigate to the target node
                      navigate(`/narrative/${choice.targetId}`);
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
        {/* Add zoom control to mini map */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          marginBottom: '5px' 
        }}>
          <button
            onClick={handleMiniMapZoomToFit}
            title="Fit all nodes in view"
            className="mini-map-zoom-button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"></path>
              <path d="M9 21H3v-6"></path>
              <path d="M21 3l-7 7"></path>
              <path d="M3 21l7-7"></path>
            </svg>
          </button>
        </div>
        
        <MiniMap
          nodesData={d3Nodes}
          linksData={d3Links}
          width={180}
          height={180}
          currentNodeId={nodeId}
          onMiniMapClick={handleMiniMapClick}
          onZoomToFitRef={miniMapZoomToFitRef}
        />
      </div>
    </motion.div>
  );
};

export default NarrativePage;