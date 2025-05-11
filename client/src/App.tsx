// client/src/App.tsx (updated to include MiniMap and SaveLoadControls)
import { useState, useEffect } from 'react';
import StoryProvider from './context/StoryContext';
import useStory from './context/StoryContext';
import { StoryChoice } from './context/StoryTypes';
import storyLogicService from './services/StoryLogicService';
import NodeMap from './components/NodeMap';
import MiniMap from './components/MiniMap';
import SaveLoadControls from './services/SaveLoadControls';
import type { NodeData, LinkData } from './components/NodeMap';
import './App.css';

// Main App component - just wraps StoryProvider around content
function App() {
  return (
    <StoryProvider>
      <StoryContent />
    </StoryProvider>
  );
}

// Actual content component that uses story context
function StoryContent() {
  const { 
    state, 
    visitNode, 
    revealNode, 
    revealLink, 
    setFlag, 
    getVisibleNodes, 
    getVisibleLinks, 
    getCurrentNode 
  } = useStory();

  // Convert story nodes to D3 node format
  const [d3Nodes, setD3Nodes] = useState<NodeData[]>([]);
  const [d3Links, setD3Links] = useState<LinkData[]>([]);
  const [currentStoryText, setCurrentStoryText] = useState<string>("");
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [zoomTarget, setZoomTarget] = useState<string | undefined>(undefined);

  // Responsive sizing
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.9,
    height: window.innerHeight * 0.6,
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth * 0.9,
        height: window.innerHeight * 0.6,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update D3 nodes and links when story state changes
  useEffect(() => {
    // Convert story nodes to D3 nodes
    const visibleNodes = getVisibleNodes();
    const newD3Nodes = visibleNodes.map(node => ({
      id: node.id,
      label: node.label,
      x: node.x || positionNodeOnGraph(node.id, dimensions.width, dimensions.height).x,
      y: node.y || positionNodeOnGraph(node.id, dimensions.width, dimensions.height).y,
      color: node.color,
      size: node.size,
      visitedCount: node.visitedCount
    }));

    // Convert story links to D3 links
    const visibleLinks = getVisibleLinks();
    const newD3Links = visibleLinks.map(link => ({
      source: link.source,
      target: link.target,
      color: link.color,
      width: link.width
    }));

    setD3Nodes(newD3Nodes);
    setD3Links(newD3Links);

    // Show mini-map if we have enough nodes
    setShowMiniMap(newD3Nodes.length > 5);

    // Update story text
    const currentNode = getCurrentNode();
    if (currentNode) {
      setCurrentStoryText(storyLogicService.getNodeText(currentNode.id, state));
    }

    // Run story logic rules
    const stateChanges = storyLogicService.evaluateState(state);
    
    // Apply rule effects
    if (stateChanges.flags) {
      Object.entries(stateChanges.flags).forEach(([key, value]) => {
        setFlag(key, value);
        
        // Handle special flags that affect the graph
        handleSpecialFlag(key, value);
      });
    }
  }, [state, dimensions.width, dimensions.height]);

 // Helper function to handle special flags that affect the graph
  const handleSpecialFlag = (key: string, value: any) => {
    switch(key) {
      case 'initialPathsRevealed':
        if (value === true) {
          // Reveal paths A and B
          revealNode('pathA', {
            x: dimensions.width / 2 + 200,
            y: dimensions.height / 2 - 100,
          });
          revealNode('pathB', {
            x: dimensions.width / 2 + 200,
            y: dimensions.height / 2 + 100,
          });
          
          // Reveal links
          revealLink({ source: 'start', target: 'pathA', color: '#777', isRevealed: true });
          revealLink({ source: 'start', target: 'pathB', color: '#777', isRevealed: true });
          revealLink({ source: 'pathA', target: 'start', color: '#777', isRevealed: true });
          revealLink({ source: 'pathB', target: 'start', color: '#777', isRevealed: true });
        }
        break;
        
      case 'whisperSourceRevealed':
        if (value === true) {
          revealNode('whisperSource', {
            x: dimensions.width / 2 + 400,
            y: dimensions.height / 2 - 150,
          });
          
          revealLink({ source: 'pathA', target: 'whisperSource', color: 'skyblue', isRevealed: true });
          revealLink({ source: 'whisperSource', target: 'pathA', color: 'skyblue', isRevealed: true });
        }
        break;
        
      case 'echoChamberRevealed':
        if (value === true) {
          revealNode('echoChamber', {
            x: dimensions.width / 2 + 400,
            y: dimensions.height / 2 + 150,
          });
          
          revealLink({ source: 'pathB', target: 'echoChamber', color: 'lightgreen', isRevealed: true });
          revealLink({ source: 'echoChamber', target: 'pathB', color: 'lightgreen', isRevealed: true });
        }
        break;
        
      case 'secretPathDiscovered':
        if (value === true) {
          // Create a secret node when a particular path is traveled
          revealNode('secretNode', {
            x: dimensions.width / 2 + 300,
            y: dimensions.height / 2,
            label: 'Hidden Chamber',
            text: "You've discovered a hidden chamber between the two paths. The walls shimmer with symbols that seem to shift as you look at them.",
            color: '#ff5500',
            size: 18,
            choices: [
              { targetId: 'start', text: 'Return to the anomaly' },
              { targetId: 'whisperSource', text: 'Go to the Source of Whispers' },
              { targetId: 'echoChamber', text: 'Go to the Echo Chamber' }
            ]
          });
          
          // Connect the secret node
          revealLink({ source: 'secretNode', target: 'whisperSource', color: '#ff5500', isRevealed: true });
          revealLink({ source: 'secretNode', target: 'echoChamber', color: '#ff5500', isRevealed: true });
          revealLink({ source: 'secretNode', target: 'start', color: '#ff5500', isRevealed: true });
          
          // Set zoom target to the new node
          setZoomTarget('secretNode');
        }
        break;
        
      case 'bothPathsVisited':
        if (value === true) {
          // Update the start node appearance to indicate progression
          revealNode('start', {
            color: '#9900cc', // Change color to indicate progression
            text: "The anomaly pulses with new energy now that you've explored both paths. It feels more stable, yet somehow more complex."
          });
        }
        break;
    }
  };

  // Helper function to determine node positions
  const positionNodeOnGraph = (nodeId: string, width: number, height: number) => {
    // Default to center
    let x = width / 2;
    let y = height / 2;
    
    // You can customize positions based on node ID or other factors
    switch(nodeId) {
      case 'start':
        x = width / 2;
        y = height / 2;
        break;
      case 'pathA':
        x = width / 2 + 200;
        y = height / 2 - 100;
        break;
      case 'pathB':
        x = width / 2 + 200;
        y = height / 2 + 100;
        break;
      case 'whisperSource':
        x = width / 2 + 400;
        y = height / 2 - 150;
        break;
      case 'echoChamber':
        x = width / 2 + 400;
        y = height / 2 + 150;
        break;
      case 'secretNode':
        x = width / 2 + 300;
        y = height / 2;
        break;
      // Add more cases for other nodes
    }
    
    return { x, y };
  };

  // Handle node click in visualization
  const handleNodeClick = (nodeId: string, clickedNodeData: NodeData) => {
    console.log('Node clicked:', nodeId, clickedNodeData);
    visitNode(nodeId);
    setZoomTarget(nodeId);
    
    // Clear zoom target after animation
    setTimeout(() => setZoomTarget(undefined), 1000);
  };
  
  // Handle mini-map click for navigation
  const handleMiniMapClick = (x: number, y: number) => {
    // Find the closest node to the clicked point
    let closestNode: NodeData | undefined;
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
    
    // If we found a close node, zoom to it
    if (closestNode) {
      setZoomTarget(closestNode.id);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Interactive Speculative Fiction</h1>
        <SaveLoadControls className="save-controls" />
      </header>
      <main>
        <NodeMap
          nodesData={d3Nodes}
          linksData={d3Links}
          onNodeClick={handleNodeClick}
          width={dimensions.width}
          height={dimensions.height}
          useForceLayout={d3Nodes.length > 10} // Use force layout for larger graphs
          highlightedNodeId={state.currentNodeId}
          zoomToNode={zoomTarget}
        />
        
        {showMiniMap && (
          <MiniMap
            nodesData={d3Nodes}
            linksData={d3Links}
            width={150}
            height={150}
            currentNodeId={state.currentNodeId}
            onMiniMapClick={handleMiniMapClick}
          />
        )}
        
        <div className="story-text-container">
          <p>{currentStoryText}</p>
          
          {getCurrentNode()?.choices && (
  <div className="story-choices">
    <p>What would you like to do?</p>
    <div className="choice-buttons">
      {getCurrentNode()?.choices?.filter((choice: StoryChoice) => {
        // Filter choices based on conditions
        return !choice.condition || choice.condition(state);
      }).map((choice: StoryChoice) => (
        <button 
          key={choice.targetId} 
          onClick={() => handleNodeClick(choice.targetId, 
            d3Nodes.find(n => n.id === choice.targetId) || 
            { 
              id: choice.targetId, 
              label: choice.text, 
              visitedCount: 0,
              isRevealed: true // Add this to match the StoryNode interface
            }
          )}
          className="choice-button"
        >
          {choice.text}
        </button>
      ))}
    </div>
  </div>
)}
        </div>
      </main>
    </div>
  );
}

export default App;