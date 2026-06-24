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
const nodes = [
  {
    id: 'start',
    label: 'The Anomaly',
    text: "You stand before a shimmering, unstable anomaly. Its surface writhes with colors you've never seen.",
    choices: [
      { targetId: 'pathA', text: 'Follow the Path of Whispers' },
      { targetId: 'pathB', text: 'Follow the Path of Echoes' },
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
    visualProperties: { color: 'lightgreen', size: 15 },
    metadata: { isStartNode: false },
  },
  {
    id: 'whisperSource',
    label: 'Source of Whispers',
    text: 'You find the source of the whispers - a small, pulsating crystal that seems to speak directly to your mind.',
    choices: [{ targetId: 'pathA', text: 'Go back to the corridor' }],
    visualProperties: { color: '#ADD8E6', size: 12 },
    metadata: { isStartNode: false },
  },
  {
    id: 'echoChamber',
    label: 'Echo Chamber',
    text: 'The echoes grow louder in this chamber. You see shadowy figures moving just at the edge of your vision.',
    choices: [{ targetId: 'pathB', text: 'Retreat from the chamber' }],
    visualProperties: { color: '#90EE90', size: 12 },
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
