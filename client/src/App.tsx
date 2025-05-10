// client/src/App.tsx

import { useState, useEffect, JSX } from 'react';
// Import the component and the data type interfaces
import NodeMap from './components/NodeMap';
import type { NodeData, LinkData } from './components/NodeMap';
import './App.css'; // For global styles if needed

// Main App component
function App(): JSX.Element { // Explicitly type the return value of the component

  // --- Story State with TypeScript ---
  const [nodes, setNodes] = useState<NodeData[]>([
    // Initial node(s)
    { id: 'start', label: 'The Anomaly', x: 100, y: 300, color: 'orange', size: 20, visitedCount: 0 },
  ]);

  const [links, setLinks] = useState<LinkData[]>([]);

  const [currentStoryText, setCurrentStoryText] = useState<string>(
    "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen."
  );

  // --- Dynamic Sizing for NodeMap ---
  // You might want the map to resize if the window changes size
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
    // Cleanup listener on component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  // --- Game Logic ---
  const handleNodeClick = (nodeId: string, clickedNodeData: NodeData): void => {
    console.log('Node clicked:', nodeId, clickedNodeData);

    // 1. Update properties of the clicked node (e.g., visitedCount, color)
    // It's good practice to create new objects/arrays for state updates
    let storyProgressed = false;
    const updatedNodes = nodes.map(node => {
      if (node.id === nodeId) {
        storyProgressed = true; // Mark that the story should advance
        return {
          ...node,
          visitedCount: (node.visitedCount || 0) + 1,
          color: '#6a0dad', // Example: Change color to purple after visit
          // Potentially change size or other attributes based on visit count
          size: node.size ? node.size * 0.95 : 18, // Example: slightly shrink
        };
      }
      return node;
    });

    let newStoryText = currentStoryText; // Default to current text if no specific update
    const newNodesToAdd: NodeData[] = [];
    const newLinksToAdd: LinkData[] = [];

    // 2. Determine next story segment, new nodes, and new links based on game logic
    // This is where your core narrative branching happens.
    if (storyProgressed) {
      if (nodeId === 'start') {
        if ((clickedNodeData.visitedCount || 0) < 1) { // First time clicking 'start'
          newStoryText = `Investigating "${clickedNodeData.label}"... its energies hum. Two faint paths of distorted reality appear before you.`;
          newNodesToAdd.push(
            { id: 'pathA', label: 'Path of Whispers', x: 350, y: dimensions.height / 2 - 100, color: 'skyblue', size: 15, visitedCount: 0 },
            { id: 'pathB', label: 'Path of Echoes', x: 350, y: dimensions.height / 2 + 100, color: 'lightgreen', size: 15, visitedCount: 0 }
          );
          newLinksToAdd.push(
            { source: 'start', target: 'pathA', color: '#777' },
            { source: 'start', target: 'pathB', color: '#777' }
          );
        } else {
          newStoryText = `You re-examine "${clickedNodeData.label}". The paths remain, but the anomaly itself feels... watchful.`;
        }
      } else if (nodeId === 'pathA') {
        newStoryText = `The "${clickedNodeData.label}" leads you down a corridor of shifting whispers. What secrets does it hold?`;
        // Example: Add a new node if it's the first visit to pathA
        if ((clickedNodeData.visitedCount || 0) < 1) {
            newNodesToAdd.push({ id: 'whisperSource', label: 'Source of Whispers', x: 600, y: dimensions.height / 2 - 150, color: '#ADD8E6', size: 12, visitedCount: 0 });
            newLinksToAdd.push({ source: 'pathA', target: 'whisperSource', color: 'skyblue' });
        }
      } else if (nodeId === 'pathB') {
        newStoryText = `The "${clickedNodeData.label}" resonates with faint, echoing sounds of events that may or may not have been.`;
         if ((clickedNodeData.visitedCount || 0) < 1) {
            newNodesToAdd.push({ id: 'echoChamber', label: 'Echo Chamber', x: 600, y: dimensions.height / 2 + 150, color: '#90EE90', size: 12, visitedCount: 0 });
            newLinksToAdd.push({ source: 'pathB', target: 'echoChamber', color: 'lightgreen' });
        }
      } else {
        newStoryText = `You ponder your choices at "${clickedNodeData.label}". The air is thick with possibility.`;
      }
    }


    // 3. Update State
    // Update existing nodes first, then add new ones (preventing ID clashes if any)
    setNodes(prevNodes => {
        const baseNodes = prevNodes.map(n => {
            const updatedVersion = updatedNodes.find(un => un.id === n.id);
            return updatedVersion ? updatedVersion : n;
        });
        const trulyNewNodes = newNodesToAdd.filter(newNode => !baseNodes.some(existingNode => existingNode.id === newNode.id));
        return [...baseNodes, ...trulyNewNodes];
    });

    setLinks(prevLinks => {
        const trulyNewLinks = newLinksToAdd.filter(
            nl => !prevLinks.some(pl => pl.source === nl.source && pl.target === nl.target)
        );
        return [...prevLinks, ...trulyNewLinks];
    });
    setCurrentStoryText(newStoryText);
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
        <div className="story-text-container" style={{ padding: '20px', marginTop: '20px', border: '1px solid #ccc', maxWidth: '800px', margin: '20px auto' }}>
          <p>{currentStoryText}</p>
        </div>
      </main>
    </div>
  );
}

export default App;