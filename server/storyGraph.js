// server/storyGraph.js
//
// The starter story graph for the seed script. The canonical data lives in the
// client (client/src/data/storyGraph.json) so the React app can bundle it
// directly; the server just re-exports it for seed.js. This is the SINGLE source
// of truth — both the client's offline fallback (InitialState.ts) and the seeded
// database derive from this one JSON file, so they can't drift.
//
// Conditions are stored as serialized ConditionSpec strings (see
// client/src/services/conditionDSL.ts); the client compiles them back into
// predicates in storyMapper.ts. To change the graph, edit the JSON.
module.exports = require('../client/src/data/storyGraph.json');
