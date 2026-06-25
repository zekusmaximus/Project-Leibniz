// client/src/context/InitialState.ts
import { StoryNode, StoryLink, StoryState } from './StoryTypes';
import { compileCondition } from '../services/conditionDSL';

// Initial state
const initialStoryContent: StoryNode[] = [
  {
    id: 'start',
    label: 'The Anomaly',
    text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
    choices: [
      { targetId: 'pathA', text: 'Follow the Path of Whispers' },
      { targetId: 'pathB', text: 'Follow the Path of Echoes' },
      // Unlocked once both sources have been seen (rule: both_sources_seen).
      {
        targetId: 'convergence',
        text: 'Surrender to the eternal return',
        condition: compileCondition({ kind: 'flag', key: 'convergenceUnlocked' }),
      },
      // Secret ending: only after the echo->whisper resonance crossing
      // (rule: secret_path_discovery).
      {
        targetId: 'singularity',
        text: 'Step into the tear between whisper and echo',
        condition: compileCondition({ kind: 'flag', key: 'secretPathDiscovered' }),
      },
    ],
    textVariants: [
      {
        id: 'revisit-anomaly',
        priority: 90,
        condition: { kind: 'visited', node: 'start', op: '>=', count: 2 },
        text: 'You re-examine the anomaly. The paths remain, but the anomaly itself feels... different now. It remembers you.',
      },
      {
        id: 'paths-marked',
        priority: 80,
        condition: { kind: 'flag', key: 'bothPathsVisited' },
        text: "Something has changed. The paths you've traveled have left their mark on this place — faint grooves worn into the impossible colors, the shape of your own passage.",
      },
      {
        id: 'convergence-braid',
        priority: 70,
        condition: { kind: 'flag', key: 'convergenceUnlocked' },
        text: 'At the anomaly’s core, the whispers and the echoes have braided into a single shimmering thread — a way through.',
      },
      {
        id: 'singularity-tear',
        priority: 60,
        condition: { kind: 'flag', key: 'secretPathDiscovered' },
        text: 'And behind that thread, where echo collapsed straight into whisper, a hairline tear has opened onto something that has no color at all.',
      },
    ],
    color: 'orange',
    size: 20,
    visitedCount: 0,
    isRevealed: true,
  },
  {
    id: 'pathA',
    label: 'Path of Whispers',
    text: 'The Path of Whispers leads you down a corridor of shifting sounds. Voices speak in languages you almost understand.',
    choices: [
      { targetId: 'whisperSource', text: 'Investigate the source of whispers' },
      { targetId: 'start', text: 'Return to the anomaly' },
    ],
    textVariants: [
      {
        id: 'whispers-hear-echoes',
        priority: 50,
        condition: { kind: 'visited', node: 'echoChamber' },
        text: 'Beneath the whispers you can hear them now: the echoes from the other path, bleeding through the walls.',
      },
    ],
    color: 'skyblue',
    size: 15,
    visitedCount: 0,
    isRevealed: false,
  },
  {
    id: 'pathB',
    label: 'Path of Echoes',
    text: 'The Path of Echoes resonates with faint, echoing sounds of events that may or may not have happened.',
    choices: [
      { targetId: 'echoChamber', text: 'Follow the loudest echoes' },
      { targetId: 'start', text: 'Return to the anomaly' },
    ],
    textVariants: [
      {
        id: 'echoes-whisper',
        priority: 50,
        condition: { kind: 'visited', node: 'whisperSource' },
        text: 'The echoes have started to whisper — repeating, almost faithfully, the words the crystal spoke to you.',
      },
    ],
    color: 'lightgreen',
    size: 15,
    visitedCount: 0,
    isRevealed: false,
  },
  {
    id: 'whisperSource',
    label: 'Source of Whispers',
    text: 'You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.',
    choices: [
      { targetId: 'pathA', text: 'Go back to the corridor' },
      // Resonance shortcut, only after the echo chamber has been heard.
      {
        targetId: 'echoChamber',
        text: 'Follow the resonance toward the echoes',
        condition: compileCondition({ kind: 'visited', node: 'echoChamber' }),
      },
    ],
    textVariants: [
      {
        id: 'revisit-crystal',
        priority: 90,
        condition: { kind: 'visited', node: 'whisperSource', op: '>=', count: 2 },
        text: 'You return to the crystal. It already knows you — it finishes the thoughts you came here to think.',
      },
      {
        id: 'heard-echoes',
        priority: 50,
        condition: { kind: 'visited', node: 'echoChamber' },
        text: 'Its song now carries the echoes you heard in the other chamber, as though the two places were always the same place.',
      },
    ],
    color: '#ADD8E6',
    size: 12,
    visitedCount: 0,
    isRevealed: false,
  },
  {
    id: 'echoChamber',
    label: 'Echo Chamber',
    text: 'The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.',
    choices: [
      { targetId: 'pathB', text: 'Retreat from the chamber' },
      // The mirror resonance shortcut. Crossing directly from here to the
      // whisper source is what reveals the secret ending.
      {
        targetId: 'whisperSource',
        text: 'Cross the resonance toward the whispers',
        condition: compileCondition({ kind: 'visited', node: 'whisperSource' }),
      },
    ],
    textVariants: [
      {
        id: 'whispers-first',
        priority: 80,
        condition: { kind: 'orderSeen', sequence: ['whisperSource', 'echoChamber'] },
        text: 'The shadows at the edge of your vision wear the shape of the whispers you already met. They were waiting for you to arrive in this order.',
      },
      {
        id: 'whispers-late',
        priority: 70,
        condition: {
          kind: 'and',
          clauses: [
            { kind: 'visited', node: 'whisperSource' },
            { kind: 'not', clause: { kind: 'orderSeen', sequence: ['whisperSource', 'echoChamber'] } },
          ],
        },
        text: 'You have heard the crystal since you first stood here; the shadows seem disappointed you came to them so late.',
      },
      {
        id: 'convergence-shortcut',
        priority: 60,
        condition: { kind: 'flag', key: 'convergenceUnlocked' },
        text: 'Where the echoes are loudest, a thread of light leads back toward the whispers — a shortcut that did not exist before.',
      },
    ],
    color: '#90EE90',
    size: 12,
    visitedCount: 0,
    isRevealed: false,
  },
  {
    id: 'convergence',
    label: 'The Eternal Return',
    text: 'The braided thread accepts you. Whisper and echo fold over each other until you cannot tell which voice is yours. You understand, finally, that you have always been here, and will arrive here again. This is the eternal return of the digital self.',
    choices: [],
    textVariants: [
      {
        id: 'tear-hint',
        priority: 50,
        condition: { kind: 'flag', key: 'secretPathDiscovered' },
        text: '(But you suspect this loop is not the only way out. Somewhere, a tear is still open.)',
      },
    ],
    color: '#6a0dad',
    size: 18,
    visitedCount: 0,
    isRevealed: false,
  },
  {
    id: 'singularity',
    label: 'The Singularity',
    text: 'You step into the tear where echo became whisper with nothing in between. Order collapses. Every node you visited, in every sequence you could have chosen, happens at once and forever. There is no map here, no return — only the single point that was always underneath the story. You let go.',
    choices: [],
    textVariants: [],
    color: '#111111',
    size: 16,
    visitedCount: 0,
    isRevealed: false,
  },
];

const initialStoryLinks: StoryLink[] = [
  { source: 'start', target: 'pathA', color: '#777', isRevealed: false },
  { source: 'start', target: 'pathB', color: '#777', isRevealed: false },
  { source: 'pathA', target: 'whisperSource', color: 'skyblue', isRevealed: false },
  { source: 'pathB', target: 'echoChamber', color: 'lightgreen', isRevealed: false },
  { source: 'whisperSource', target: 'pathA', color: 'skyblue', isRevealed: false },
  { source: 'echoChamber', target: 'pathB', color: 'lightgreen', isRevealed: false },
  { source: 'pathA', target: 'start', color: '#777', isRevealed: false },
  { source: 'pathB', target: 'start', color: '#777', isRevealed: false },
  // Resonance shortcuts between the two sources (revealed via conditional choices).
  { source: 'whisperSource', target: 'echoChamber', color: '#6a0dad', isRevealed: false },
  { source: 'echoChamber', target: 'whisperSource', color: '#6a0dad', isRevealed: false },
  // Endings (revealed when their unlock flag flips; see StoryProvider).
  { source: 'start', target: 'convergence', color: '#6a0dad', isRevealed: false },
  { source: 'start', target: 'singularity', color: '#444', isRevealed: false },
];

// Create initial state with nodes as a record for easier access
const initialNodes: Record<string, StoryNode> = {};
initialStoryContent.forEach(node => {
  initialNodes[node.id] = node;
});

export const InitialState: StoryState = {
  nodes: initialNodes,
  links: initialStoryLinks,
  currentNodeId: 'start',
  visitCounts: { start: 0 },
  flags: { storyBegan: false },
  history: []
};
