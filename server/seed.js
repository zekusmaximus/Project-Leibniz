// server/seed.js
//
// Seeds the database with the starter story graph so the client has content to
// fetch from /api/nodes and /api/links. Run once against a configured database:
//
//   cd server && npm run seed
//
// Requires MONGODB_URI in server/.env. This is destructive: it clears the
// StoryNode and StoryLink collections before inserting the starter graph.
require('dotenv').config();
const mongoose = require('mongoose');
const StoryNode = require('./models/StoryNode');
const StoryLink = require('./models/StoryLink');

// Mirrors the bundled client fallback in client/src/context/InitialState.ts.
//
// Choice `condition` values are serialized ConditionSpec objects (see
// client/src/services/conditionDSL.ts). The client compiles these strings back
// into predicates in storyMapper.ts, so conditions behave identically whether
// the graph is served from here or loaded from the offline fallback. Keep these
// specs in sync with the compiled specs in InitialState.ts.
const nodes = [
  {
    id: 'start',
    label: 'The Anomaly',
    text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
    choices: [
      { targetId: 'pathA', text: 'Follow the Path of Whispers' },
      { targetId: 'pathB', text: 'Follow the Path of Echoes' },
      {
        targetId: 'convergence',
        text: 'Surrender to the eternal return',
        condition: JSON.stringify({ kind: 'flag', key: 'convergenceUnlocked' }),
      },
      {
        targetId: 'singularity',
        text: 'Step into the tear between whisper and echo',
        condition: JSON.stringify({ kind: 'flag', key: 'secretPathDiscovered' }),
      },
    ],
    textVariants: [
      {
        id: 'revisit-anomaly',
        priority: 90,
        condition: JSON.stringify({ kind: 'visited', node: 'start', op: '>=', count: 2 }),
        text: 'You re-examine the anomaly. The paths remain, but the anomaly itself feels... different now. It remembers you.',
      },
      {
        id: 'paths-marked',
        priority: 80,
        condition: JSON.stringify({ kind: 'flag', key: 'bothPathsVisited' }),
        text: "Something has changed. The paths you've traveled have left their mark on this place — faint grooves worn into the impossible colors, the shape of your own passage.",
      },
      {
        id: 'convergence-braid',
        priority: 70,
        condition: JSON.stringify({ kind: 'flag', key: 'convergenceUnlocked' }),
        text: 'At the anomaly’s core, the whispers and the echoes have braided into a single shimmering thread — a way through.',
      },
      {
        id: 'singularity-tear',
        priority: 60,
        condition: JSON.stringify({ kind: 'flag', key: 'secretPathDiscovered' }),
        text: 'And behind that thread, where echo collapsed straight into whisper, a hairline tear has opened onto something that has no color at all.',
      },
    ],
    visualProperties: { color: 'orange', size: 20 },
    metadata: { isStartNode: true },
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
        condition: JSON.stringify({ kind: 'visited', node: 'echoChamber' }),
        text: 'Beneath the whispers you can hear them now: the echoes from the other path, bleeding through the walls.',
      },
    ],
    visualProperties: { color: 'skyblue', size: 15 },
    metadata: { isStartNode: false },
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
        condition: JSON.stringify({ kind: 'visited', node: 'whisperSource' }),
        text: 'The echoes have started to whisper — repeating, almost faithfully, the words the crystal spoke to you.',
      },
    ],
    visualProperties: { color: 'lightgreen', size: 15 },
    metadata: { isStartNode: false },
  },
  {
    id: 'whisperSource',
    label: 'Source of Whispers',
    text: 'You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.',
    choices: [
      { targetId: 'pathA', text: 'Go back to the corridor' },
      {
        targetId: 'echoChamber',
        text: 'Follow the resonance toward the echoes',
        condition: JSON.stringify({ kind: 'visited', node: 'echoChamber' }),
      },
    ],
    textVariants: [
      {
        id: 'revisit-crystal',
        priority: 90,
        condition: JSON.stringify({ kind: 'visited', node: 'whisperSource', op: '>=', count: 2 }),
        text: 'You return to the crystal. It already knows you — it finishes the thoughts you came here to think.',
      },
      {
        id: 'heard-echoes',
        priority: 50,
        condition: JSON.stringify({ kind: 'visited', node: 'echoChamber' }),
        text: 'Its song now carries the echoes you heard in the other chamber, as though the two places were always the same place.',
      },
    ],
    visualProperties: { color: '#ADD8E6', size: 12 },
    metadata: { isStartNode: false },
  },
  {
    id: 'echoChamber',
    label: 'Echo Chamber',
    text: 'The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.',
    choices: [
      { targetId: 'pathB', text: 'Retreat from the chamber' },
      {
        targetId: 'whisperSource',
        text: 'Cross the resonance toward the whispers',
        condition: JSON.stringify({ kind: 'visited', node: 'whisperSource' }),
      },
    ],
    textVariants: [
      {
        id: 'whispers-first',
        priority: 80,
        condition: JSON.stringify({ kind: 'orderSeen', sequence: ['whisperSource', 'echoChamber'] }),
        text: 'The shadows at the edge of your vision wear the shape of the whispers you already met. They were waiting for you to arrive in this order.',
      },
      {
        id: 'whispers-late',
        priority: 70,
        condition: JSON.stringify({
          kind: 'and',
          clauses: [
            { kind: 'visited', node: 'whisperSource' },
            { kind: 'not', clause: { kind: 'orderSeen', sequence: ['whisperSource', 'echoChamber'] } },
          ],
        }),
        text: 'You have heard the crystal since you first stood here; the shadows seem disappointed you came to them so late.',
      },
      {
        id: 'convergence-shortcut',
        priority: 60,
        condition: JSON.stringify({ kind: 'flag', key: 'convergenceUnlocked' }),
        text: 'Where the echoes are loudest, a thread of light leads back toward the whispers — a shortcut that did not exist before.',
      },
    ],
    visualProperties: { color: '#90EE90', size: 12 },
    metadata: { isStartNode: false },
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
        condition: JSON.stringify({ kind: 'flag', key: 'secretPathDiscovered' }),
        text: '(But you suspect this loop is not the only way out. Somewhere, a tear is still open.)',
      },
    ],
    visualProperties: { color: '#6a0dad', size: 18 },
    metadata: { isStartNode: false },
  },
  {
    id: 'singularity',
    label: 'The Singularity',
    text: 'You step into the tear where echo became whisper with nothing in between. Order collapses. Every node you visited, in every sequence you could have chosen, happens at once and forever. There is no map here, no return — only the single point that was always underneath the story. You let go.',
    choices: [],
    textVariants: [],
    visualProperties: { color: '#111111', size: 16 },
    metadata: { isStartNode: false },
  },
];

const links = [
  { source: 'start', target: 'pathA', visualProperties: { color: '#777' } },
  { source: 'start', target: 'pathB', visualProperties: { color: '#777' } },
  { source: 'pathA', target: 'whisperSource', visualProperties: { color: 'skyblue' } },
  { source: 'pathB', target: 'echoChamber', visualProperties: { color: 'lightgreen' } },
  { source: 'whisperSource', target: 'pathA', visualProperties: { color: 'skyblue' } },
  { source: 'echoChamber', target: 'pathB', visualProperties: { color: 'lightgreen' } },
  { source: 'pathA', target: 'start', visualProperties: { color: '#777' } },
  { source: 'pathB', target: 'start', visualProperties: { color: '#777' } },
  { source: 'whisperSource', target: 'echoChamber', visualProperties: { color: '#6a0dad' } },
  { source: 'echoChamber', target: 'whisperSource', visualProperties: { color: '#6a0dad' } },
  { source: 'start', target: 'convergence', visualProperties: { color: '#6a0dad' } },
  { source: 'start', target: 'singularity', visualProperties: { color: '#444' } },
];

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Create server/.env from server/.env.example.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Seeding story graph...');

  await StoryNode.deleteMany({});
  await StoryLink.deleteMany({});

  await StoryNode.insertMany(nodes);
  await StoryLink.insertMany(links);

  console.log(`Seeded ${nodes.length} nodes and ${links.length} links.`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
