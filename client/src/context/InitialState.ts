// client/src/context/initialState.ts
import { StoryNode, StoryLink, StoryState } from './StoryContext';

// Initial state
const initialStoryContent: StoryNode[] = [
  {
    id: 'start',
    label: 'The Anomaly',
    text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
    choices: [
      { targetId: 'pathA', text: 'Follow the Path of Whispers' },
      { targetId: 'pathB', text: 'Follow the Path of Echoes' }
    ],
    color: 'orange',
    size: 20,
    visitedCount: 0,
    isRevealed: true
  },
  {
    id: 'pathA',
    label: 'Path of Whispers',
    text: "The Path of Whispers leads you down a corridor of shifting sounds. Voices speak in languages you almost understand.",
    choices: [
      { targetId: 'whisperSource', text: 'Investigate the source of whispers' },
      { targetId: 'start', text: 'Return to the anomaly' }
    ],
    color: 'skyblue',
    size: 15,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'pathB',
    label: 'Path of Echoes',
    text: "The Path of Echoes resonates with faint, echoing sounds of events that may or may not have happened.",
    choices: [
      { targetId: 'echoChamber', text: 'Follow the loudest echoes' },
      { targetId: 'start', text: 'Return to the anomaly' }
    ],
    color: 'lightgreen',
    size: 15,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'whisperSource',
    label: 'Source of Whispers',
    text: "You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.",
    choices: [
      { targetId: 'pathA', text: 'Go back to the corridor' }
    ],
    color: '#ADD8E6',
    size: 12,
    visitedCount: 0,
    isRevealed: false
  },
  {
    id: 'echoChamber',
    label: 'Echo Chamber',
    text: "The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.",
    choices: [
      { targetId: 'pathB', text: 'Retreat from the chamber' }
    ],
    color: '#90EE90',
    size: 12,
    visitedCount: 0,
    isRevealed: false
  }
];

const initialStoryLinks: StoryLink[] = [
  { source: 'start', target: 'pathA', color: '#777', isRevealed: false },
  { source: 'start', target: 'pathB', color: '#777', isRevealed: false },
  { source: 'pathA', target: 'whisperSource', color: 'skyblue', isRevealed: false },
  { source: 'pathB', target: 'echoChamber', color: 'lightgreen', isRevealed: false },
  { source: 'whisperSource', target: 'pathA', color: 'skyblue', isRevealed: false },
  { source: 'echoChamber', target: 'pathB', color: 'lightgreen', isRevealed: false },
  { source: 'pathA', target: 'start', color: '#777', isRevealed: false },
  { source: 'pathB', target: 'start', color: '#777', isRevealed: false }
];

// Create initial state with nodes as a record for easier access
const initialNodes: Record<string, StoryNode> = {};
initialStoryContent.forEach(node => {
  initialNodes[node.id] = node;
});

const initialState: StoryState = {
  nodes: initialNodes,
  links: initialStoryLinks,
  currentNodeId: 'start',
  visitCounts: { start: 0 },
  flags: { storyBegan: false },
  history: []
};

export default initialState;