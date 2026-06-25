// client/src/context/StoryReducer.ts
import { StoryState, StoryAction } from './StoryTypes';
import { InitialState } from './InitialState';

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
          // Ensure the node is revealed when visited
          isRevealed: true,
          // Change color after first visit (if needed)
          color: newVisitCount > 1 ? '#6a0dad' : updatedNodes[nodeId].color,
          // Optionally adjust size
          size: Math.max((updatedNodes[nodeId].size || 15) * 0.95, 10)
        };
      }
      
      // Get all choices from this node to possibly reveal connected nodes
      const choices = updatedNodes[nodeId]?.choices || [];
      
      // Automatically reveal links connected to this node when it's visited
      const updatedLinks = state.links.map(link => {
        // If this link connects the current node to a node in choices
        if (link.source === nodeId && 
            choices.some(choice => choice.targetId === link.target)) {
          return { ...link, isRevealed: true };
        }
        
        // Also reveal links where the current node is a target, if the source is revealed
        if (link.target === nodeId && state.nodes[link.source]?.isRevealed) {
          return { ...link, isRevealed: true };
        }
        
        return link;
      });
      
      // Update history to keep track of the visit order
      const newHistory = [...state.history, nodeId];
      
      return {
        ...state,
        nodes: updatedNodes,
        links: updatedLinks,
        currentNodeId: nodeId,
        visitCounts: {
          ...state.visitCounts,
          [nodeId]: newVisitCount
        },
        history: newHistory
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
      
      // Also check if we can reveal any links that connect to or from this node
      const updatedLinks = state.links.map(link => {
        if ((link.source === nodeId || link.target === nodeId) &&
            state.nodes[link.source]?.isRevealed && 
            state.nodes[link.target]?.isRevealed) {
          return { ...link, isRevealed: true };
        }
        return link;
      });
      
      return {
        ...state,
        nodes: updatedNodes,
        links: updatedLinks
      };
    }

    case 'REVEAL_LINK': {
      const newLink = action.link;
      
      // First, ensure both source and target nodes exist and are revealed
      const sourceNode = state.nodes[newLink.source];
      const targetNode = state.nodes[newLink.target];
      
      if (!sourceNode || !targetNode) {
        console.warn(`Cannot reveal link - nodes don't exist: ${newLink.source} -> ${newLink.target}`);
        return state;
      }
      
      // Ensure both nodes are revealed
      const updatedNodes = { ...state.nodes };
      if (!sourceNode.isRevealed) {
        updatedNodes[newLink.source] = {
          ...sourceNode,
          isRevealed: true
        };
      }
      
      if (!targetNode.isRevealed) {
        updatedNodes[newLink.target] = {
          ...targetNode,
          isRevealed: true
        };
      }
      
      // Check if the link already exists
      const linkExists = state.links.some(
        link => link.source === newLink.source && link.target === newLink.target
      );
      
      let updatedLinks;
      if (linkExists) {
        // Update existing link
        updatedLinks = state.links.map(link => {
          if (link.source === newLink.source && link.target === newLink.target) {
            return { ...link, isRevealed: true };
          }
          return link;
        });
      } else {
        // Add new link
        updatedLinks = [...state.links, { ...newLink, isRevealed: true }];
      }
      
      return {
        ...state,
        nodes: updatedNodes,
        links: updatedLinks
      };
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

    case 'UPDATE_NODE_POSITIONS': {
      const updatedNodes = { ...state.nodes };
      action.nodes.forEach(nodeUpdate => {
        if (updatedNodes[nodeUpdate.id]) {
          updatedNodes[nodeUpdate.id] = {
            ...updatedNodes[nodeUpdate.id],
            x: nodeUpdate.x,
            y: nodeUpdate.y
          };
        }
      });
      return {
        ...state,
        nodes: updatedNodes
      };
    }

    default:
      return state;
  }
};
