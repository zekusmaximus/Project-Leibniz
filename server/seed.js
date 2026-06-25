// server/seed.js
//
// Seeds the database with the starter story graph so the client has content to
// fetch from /api/nodes and /api/links. Run once against a configured database:
//
//   cd server && npm run seed
//
// Requires MONGODB_URI in server/.env. This is destructive: it clears the
// StoryNode and StoryLink collections before inserting the starter graph.
//
// The graph data is the single source of truth in client/src/data/storyGraph.json;
// ./storyGraph.js just re-exports it, so the seed and the client's offline
// fallback can't drift. Edit the JSON, then re-seed.
require('dotenv').config();
const mongoose = require('mongoose');
const StoryNode = require('./models/StoryNode');
const StoryLink = require('./models/StoryLink');
const { nodes, links } = require('./storyGraph');

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
