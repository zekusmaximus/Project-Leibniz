// Updated client/src/App.tsx

import { useState, useEffect } from 'react';
import NodeMap from './components/NodeMap';
import type { NodeData, LinkData } from './components/NodeMap';
import './App.css';

// Story segment type for better organization
interface StorySegment {
  id: string;
  text: string;
  choices?: StoryChoice[];
  visited: boolean;
}

interface StoryChoice {
  targetId: string;
  text: string;
  condition?: (state: StoryState) => boolean;
}

// Game state management
interface StoryState {
  currentNodeId: string;
  visitCounts: Record<string, number>;
  flags: Record<string, boolean | number | string>;
}

function App() {
  // State for nodes and links visualization
  const [nodes, setNodes] = useState<NodeData[]>([
    { id: 'start', label: 'The Anomaly', x: 400, y: 300, color: 'orange', size: 20, visitedCount: 0 },
  ]);

  const [links, setLinks] = useState<LinkData[]>([]);

  // State for story and game mechanics
  const [storyState, setStoryState] = useState<StoryState>({
    currentNodeId: 'start',
    visitCounts: { start: 0 },
    flags: { storyBegan: false }
  });

  const [currentStoryText, setCurrentStoryText] = useState<string>(
    "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen."
  );
  
  // Story content - could be moved to a separate file or database later
  const storySegments: Record<string, StorySegment> = {
    'start': {
      id: 'start',
      text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
      choices: [
        { targetId: 'pathA', text: 'Follow the Path of Whispers' },
        { targetId: 'pathB', text: 'Follow the Path of Echoes' }
      ],
      visited: false
    },
    'pathA': {
      id: 'pathA',
      text: "The Path of Whispers leads you down a corridor of shifting sounds. Voices speak in languages you almost understand.",
      choices: [
        { targetId: 'whisperSource', text: 'Investigate the source of whispers' },
        { targetId: 'start', text: 'Return to the anomaly' }
      ],
      visited: false
    },
    'pathB': {
      id: 'pathB',
      text: "The Path of Echoes resonates with faint, echoing sounds of events that may or may not have happened.",
      choices: [
        { targetId: 'echoChamber', text: 'Follow the loudest echoes' },
        { targetId: 'start', text: 'Return to the anomaly' }
      ],
      visited: false
    },
    'whisperSource': {
      id: 'whisperSource',
      text: "You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.",
      choices: [
        { targetId: 'pathA', text: 'Go back to the corridor' }
      ],
      visited: false
    },
    'echoChamber': {
      id: 'echoChamber',
      text: "The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.",
      choices: [
        { targetId: 'pathB', text: 'Retreat from the chamber' }
      ],
      visited: false
    }
  };
  
  // Responsive sizing
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.9,
    height: window.innerHeight * 0.6,
  });

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

  // Game logic for node interactions
  const handleNodeClick = (nodeId: string, clickedNodeData: NodeData): void => {
    console.log('Node clicked:', nodeId, clickedNodeData);

    // 1. Update visit count
    const newVisitCount = (storyState.visitCounts[nodeId] || 0) + 1;
    setStoryState(prev => ({
      ...prev,
      currentNodeId: nodeId,
      visitCounts: {
        ...prev.visitCounts,
        [nodeId]: newVisitCount
      }
    }));

    // 2. Update node appearance
    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          visitedCount: newVisitCount,
          color: newVisitCount > 1 ? '#6a0dad' : node.color, // Change color after first visit
          size: Math.max(node.size ? node.size * 0.95 : 18, 10) // Don't let it get too small
        };
      }
      return node;
    }));

    // 3. Update story text and expand story graph based on node ID and visit count
    updateStoryForNode(nodeId, newVisitCount);
  };

  // Helper function to update story based on node visits
  const updateStoryForNode = (nodeId: string, visitCount: number) => {
    const storySegment = storySegments[nodeId];
    if (!storySegment) return;

    // Set current story text
    setCurrentStoryText(storySegment.text);
    
    // Only add new nodes on first visit
    if (visitCount === 1) {
      const newNodesToAdd: NodeData[] = [];
      const newLinksToAdd: LinkData[] = [];

      // Node-specific story logic
      switch (nodeId) {
        case 'start':
          // First time visiting the start node
          newNodesToAdd.push(
            { 
              id: 'pathA', 
              label: 'Path of Whispers', 
              x: dimensions.width / 2 + 200, 
              y: dimensions.height / 2 - 100, 
              color: 'skyblue', 
              size: 15, 
              visitedCount: 0 
            },
            { 
              id: 'pathB', 
              label: 'Path of Echoes', 
              x: dimensions.width / 2 + 200, 
              y: dimensions.height / 2 + 100, 
              color: 'lightgreen', 
              size: 15, 
              visitedCount: 0 
            }
          );
          newLinksToAdd.push(
            { source: 'start', target: 'pathA', color: '#777' },
            { source: 'start', target: 'pathB', color: '#777' }
          );
          break;
        
        case 'pathA':
          newNodesToAdd.push({ 
            id: 'whisperSource', 
            label: 'Source of Whispers', 
            x: dimensions.width / 2 + 400, 
            y: dimensions.height / 2 - 150, 
            color: '#ADD8E6', 
            size: 12, 
            visitedCount: 0 
          });
          newLinksToAdd.push({ source: 'pathA', target: 'whisperSource', color: 'skyblue' });
          break;
        
        case 'pathB':
          newNodesToAdd.push({ 
            id: 'echoChamber', 
            label: 'Echo Chamber', 
            x: dimensions.width / 2 + 400, 
            y: dimensions.height / 2 + 150, 
            color: '#90EE90', 
            size: 12, 
            visitedCount: 0 
          });
          newLinksToAdd.push({ source: 'pathB', target: 'echoChamber', color: 'lightgreen' });
          break;
        
        // Add more cases as needed for other nodes
      }

      // Update nodes and links, preventing duplicates
      setNodes(prevNodes => {
        const existingIds = new Set(prevNodes.map(n => n.id));
        const filteredNewNodes = newNodesToAdd.filter(n => !existingIds.has(n.id));
        return [...prevNodes, ...filteredNewNodes];
      });

      setLinks(prevLinks => {
        const linkExists = (source: string, target: string) => 
          prevLinks.some(l => l.source === source && l.target === target);
        
        const filteredNewLinks = newLinksToAdd.filter(
          l => !linkExists(l.source, l.target)
        );
        
        return [...prevLinks, ...filteredNewLinks];
      });
    } else {
      // Logic for revisiting nodes (can modify text or other state)
      if (nodeId === 'start') {
        setCurrentStoryText(`You re-examine the anomaly. The paths remain, but the anomaly itself feels... different now.`);
      }
      // Add similar logic for other nodes
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Interactive Speculative Fiction</h1>
      </header>
      <main>
        <NodeMap
          nodesData={nodes}
          linksData={links}
          onNodeClick={handleNodeClick}
          width={dimensions.width}
          height={dimensions.height}
        />
        <div className="story-text-container" style={{ 
          padding: '20px', 
          marginTop: '20px', 
          border: '1px solid #ccc', 
          maxWidth: '800px', 
          margin: '20px auto',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <p>{currentStoryText}</p>
          {storySegments[storyState.currentNodeId]?.choices && (
            <div className="story-choices">
              <p>What would you like to do?</p>
              <div className="choice-buttons">
                {storySegments[storyState.currentNodeId].choices?.map(choice => (
                  <button 
                    key={choice.targetId} 
                    onClick={() => handleNodeClick(choice.targetId, 
                      nodes.find(n => n.id === choice.targetId) || 
                      { id: choice.targetId, label: choice.text, visitedCount: 0 }
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