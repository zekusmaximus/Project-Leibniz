// client/src/App.tsx (updated for layout debugging with placeholders)
import { useState, useEffect, useRef } from 'react';
import StoryProvider from './context/StoryProvider';
import { useStory } from './context/context';
import storyLogicService from './services/StoryLogicService';
import NodeMap from './components/NodeMap';
import MiniMap from './components/MiniMap'; // Restore MiniMap
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
    // revealNode, // Not used with placeholders
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
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false); // Restore
  const [zoomTarget, setZoomTarget] = useState<string | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null); // Restore for NodeMap sizing

  // Responsive sizing based on container, not window
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 }); // Restore (used by NodeMap positioning logic)
  const [mapDimensions, setMapDimensions] = useState({ width: 800, height: 500 }); // Restore for NodeMap

  useEffect(() => { // Original dimensions effect
  //   function updateSize() {
  //     if (containerRef.current) {
  //       const rect = containerRef.current.getBoundingClientRect();
  //       setDimensions({
  //         width: Math.min(rect.width, 1200),
  //         height: Math.min(rect.height, 600),
  //       });
  //     }
  //   }
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.min(rect.width, 1200), // This was from original, might need adjustment
          height: Math.min(rect.height, 600), // This was from original, might need adjustment
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => { // Original mapDimensions effect
    function updateMapSize() {
      if (leftPanelRef.current) {
        const rect = leftPanelRef.current.getBoundingClientRect();
        setMapDimensions({
          width: Math.max(rect.width, 300), // avoid 0 width
          height: Math.max(rect.height, 300),
        });
      }
    }
    updateMapSize();
    window.addEventListener('resize', updateMapSize);
    return () => window.removeEventListener('resize', updateMapSize);
  }, []);

  // Update D3 nodes and links when story state changes - Restore full logic
  useEffect(() => {
    const visibleNodes = getVisibleNodes();
    const newD3Nodes = visibleNodes.map(node => ({
      id: node.id,
      label: node.label,
      x: node.x, // Rely on initial positions or simulation
      y: node.y,
      color: node.color,
      size: node.size,
      visitedCount: node.visitedCount
    }));

    const visibleLinks = getVisibleLinks();
    const newD3Links = visibleLinks.map(link => ({
      source: link.source,
      target: link.target,
      color: link.color,
      width: link.width
    }));

    setD3Nodes(newD3Nodes);
    setD3Links(newD3Links);

    // setShowMiniMap(newD3Nodes.length > 5); // Original condition
    setShowMiniMap(newD3Nodes.length >= 1); // Temporarily change to show if any nodes exist for debugging

    const currentNode = getCurrentNode();
    if (currentNode) {
      setCurrentStoryText(storyLogicService.getNodeText(currentNode.id, state));
    }

    const stateChanges = storyLogicService.evaluateState(state);
    if (stateChanges.flags) {
      Object.entries(stateChanges.flags).forEach(([key, value]) => {
        setFlag(key, value);
        handleSpecialFlag(key, value); // Restore call
      });
    }
  }, [state, getVisibleNodes, getVisibleLinks, getCurrentNode, setFlag, dimensions, revealNode, revealLink]); // Added revealNode/Link to deps for handleSpecialFlag

  // Restore handleSpecialFlag function (copied from original App.tsx provided earlier)
  const handleSpecialFlag = (key: string, value: boolean | string | number | null) => {
    switch(key) {
      case 'initialPathsRevealed':
        if (value === true) {
          revealNode('pathA', {
            x: dimensions.width / 2 + 200, // dimensions here refers to overall app container, might need mapDimensions for NodeMap specific coords
            y: dimensions.height / 2 - 100,
          });
          revealNode('pathB', {
            x: dimensions.width / 2 + 200,
            y: dimensions.height / 2 + 100,
          });
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
          revealNode('secretNode', {
            x: dimensions.width / 2 + 300,
            y: dimensions.height / 2,
            label: 'Hidden Chamber',
            // text: "You've discovered a hidden chamber between the two paths. The walls shimmer with symbols that seem to shift as you look at them.", // Text is part of node definition in context
            color: '#ff5500',
            size: 18,
            // choices: [ // Choices are part of node definition in context
            //   { targetId: 'start', text: 'Return to the anomaly' },
            //   { targetId: 'whisperSource', text: 'Go to the Source of Whispers' },
            //   { targetId: 'echoChamber', text: 'Go to the Echo Chamber' }
            // ]
          });
          revealLink({ source: 'secretNode', target: 'whisperSource', color: '#ff5500', isRevealed: true });
          revealLink({ source: 'secretNode', target: 'echoChamber', color: '#ff5500', isRevealed: true });
          revealLink({ source: 'secretNode', target: 'start', color: '#ff5500', isRevealed: true });
          setZoomTarget('secretNode');
        }
        break;
      case 'bothPathsVisited':
        if (value === true) {
          revealNode('start', {
            color: '#9900cc',
            // text: "The anomaly pulses with new energy now that you've explored both paths. It feels more stable, yet somehow more complex." // Text is part of node definition
          });
        }
        break;
    }
  };

  const handleNodeClick = (nodeId: string, _clickedNodeData: NodeData) => {
    visitNode(nodeId);
    setZoomTarget(nodeId);
    setTimeout(() => setZoomTarget(undefined), 1000);
  };

  // Handle mini-map click for navigation (copied from original App.tsx)
  const handleMiniMapClick = (x: number, y: number) => {
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
    
    if (closestNode) {
      setZoomTarget(closestNode.id);
      // Clear zoom target after animation (optional, if NodeMap handles it)
      // setTimeout(() => setZoomTarget(undefined), 1000); 
    }
  };

 return (
    <div 
      className="LeibnizProjectRootContainer"  // Changed className
      ref={containerRef} 
      style={{
        display: 'flex', // Added for App to control its direct children
        flexDirection: 'column', // App-header then main
        height: '100vh', 
        width: '100vw', 
        // overflow: 'hidden', // Temporarily remove to see if it affects offset
        margin: 0, // Ensure no default margin
        padding: 0 // Ensure no default padding
      }}
    >
      <header className="App-header" style={{ flexShrink: 0 /* Prevent header from shrinking */ }}>
        <h1>Interactive Speculative Fiction</h1>
        <SaveLoadControls className="save-controls" />
      </header>
      <main
        style={{
          flexGrow: 1, // Allow main to grow and take remaining space
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden', // Prevent internal scrollbars on main itself
          // gap: '10px', // Removing gap for now
          // padding: '10px', // Removing padding for now
          boxSizing: 'border-box'
        }}
        >
        {/* Left Panel - NodeMap */}
        <div
          ref={leftPanelRef} // Restored ref
          style={{
            flex: 2,
            height: '100%',
            background: '#f8f8fa', // Original background for this panel
            display: 'flex', // Keep for centering NodeMap if smaller
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px', // Original style
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', // Original style
            // padding: '10px', // Padding was removed from main, can add here if needed around NodeMap
            boxSizing: 'border-box'
          }}
        >
          {(mapDimensions.width > 0 && mapDimensions.height > 0) && (
            <NodeMap
              nodesData={d3Nodes}
              linksData={d3Links}
              onNodeClick={handleNodeClick}
              width={mapDimensions.width}
              height={mapDimensions.height}
              highlightedNodeId={state.currentNodeId}
              zoomToNode={zoomTarget}
            />
          )}
        </div>

        {/* Right Panel Placeholder (contents still placeholders) */}
        <div
          style={{
            flex: 1,
            height: '100%',
            // background: 'lightskyblue', // Original right panel background was #fff
            background: '#fff', // Restore original right panel background
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px', // Original style
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', // Original style
            overflow: 'hidden', // Original style
            // padding: '10px', // Padding was removed from main
            boxSizing: 'border-box'
            // gap: '10px' // Gap will be handled by padding/margins of children if needed
          }}
        >
          {/* Narrative Area - Restored */}
          <div className="story-text-container" style={{
            flex: 2, // Takes 2/3 of right panel height
            background: 'rgba(30, 35, 45, 0.8)', // Add dark background for light text
            color: 'rgba(255, 255, 255, 0.9)', // Ensure text color contrasts
            overflowY: 'auto',
            padding: '20px', // Original padding
            borderRadius: '8px', // Original style (top part of panel)
            boxSizing: 'border-box'
            // display: 'flex', alignItems: 'center', justifyContent: 'center' // Remove placeholder centering
            // border: '1px dashed darkgrey' // Remove debug border
          }}>
            {/* Original narrative content restored */}
            <p>{currentStoryText}</p>
            {getCurrentNode()?.choices && (
              <div className="story-choices">
                <p>What would you like to do?</p>
                <div className="choice-buttons">
                  {getCurrentNode()?.choices
                    ?.filter((choice) => !choice.condition || choice.condition(state))
                    .map((choice) => (
                      <button 
                        key={choice.targetId} 
                        onClick={() => handleNodeClick( // Use handleNodeClick for consistency
                          choice.targetId, 
                          d3Nodes.find(n => n.id === choice.targetId) || 
                          { id: choice.targetId, label: choice.text, visitedCount: 0 } // Provide dummy NodeData if not found
                        )}
                        className="choice-button"
                      >
                        {choice.text}
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* MiniMap Area - Restored */}
          <div style={{
            flex: 1, // Takes 1/3 of right panel height
            // background: 'lightgoldenrodyellow', // Remove placeholder background
            width: '100%', // Ensure it takes full width of its column flex container
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderTop: '1px solid #eee', // Original style
            background: '#fafbfc', // Original style
            // padding: '10px', // Padding was in original MiniMap div, not this container
            boxSizing: 'border-box'
            // border: '1px dashed darkgrey' // Remove debug border
          }}>
            {showMiniMap && (
              <MiniMap
                nodesData={d3Nodes}
                linksData={d3Links}
                width={150} // Original fixed size
                height={150} // Original fixed size
                currentNodeId={state.currentNodeId}
                onMiniMapClick={handleMiniMapClick}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
