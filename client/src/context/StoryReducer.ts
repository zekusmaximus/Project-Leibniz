// client/src/context/storyReducer.ts
import { StoryNode, StoryLink, StoryState, StoryAction } from './StoryTypes';
import { InitialState } from './InitialState';

// Create the reducer function
export const storyReducer = (state: StoryState, action: StoryAction): StoryState => {
  switch (action.type) {
    case 'VISIT_NODE': {
      const nodeId = action.nodeId;
      const newVisitCount = (state.visitCounts[nodeId] || 0) + 1;
      
      // Update the node's visitedCount
      const updatedNodes = { ...state.nodes };
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          visitedCount: newVisitCount,
          // Change color after first visit (if needed)
          color: newVisitCount > 1 ? '#6a0dad' : updatedNodes[nodeId].color,
          // Optionally adjust size
          size: Math.max((updatedNodes[nodeId].size || 15) * 0.95, 10)
        };
      }
      
      return {
        ...state,
        nodes: updatedNodes,
        currentNodeId: nodeId,
        visitCounts: {
          ...state.visitCounts,
          [nodeId]: newVisitCount
        },
        history: [...state.history, nodeId]
      };
    }

    case 'REVEAL_NODE': {
      const { nodeId, nodeData } = action;
      const updatedNodes = { ...state.nodes };
      
      if (updatedNodes[nodeId]) {
        // Update existing node
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          ...nodeData,
          isRevealed: true
        };
      } else {
        // Create new node
        updatedNodes[nodeId] = {
          id: nodeId,
          label: nodeData.label || nodeId,
          text: nodeData.text || "",
          choices: nodeData.choices || [],
          color: nodeData.color || 'gray',
          size: nodeData.size || 15,
          visitedCount: 0,
          isRevealed: true
        };
      }
      
      return {
        ...state,
        nodes: updatedNodes
      };
    }

    case 'REVEAL_LINK': {
      const newLink = action.link;
      const linkExists = state.links.some(
        link => link.source === newLink.source && link.target === newLink.target
      );
      
      if (linkExists) {
        // Update existing link
        const updatedLinks = state.links.map(link => {
          if (link.source === newLink.source && link.target === newLink.target) {
            return { ...link, isRevealed: true };
          }
          return link;
        });
        
        return {
          ...state,
          links: updatedLinks
        };
      } else {
        // Add new link
        return {
          ...state,
          links: [...state.links, { ...newLink, isRevealed: true }]
        };
      }
    }

    case 'SET_FLAG': {
      return {
        ...state,
        flags: {
          ...state.flags,
          [action.key]: action.value
        }
      };
    }

    case 'RESET_STORY': {
      return InitialState;
    }

    case 'LOAD_STORY': {
      return action.state;
    }

    default:
      return state;
  }
};