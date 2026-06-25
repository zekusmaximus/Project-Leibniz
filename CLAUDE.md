# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this project is

**Project-Leibniz** (in-app title: *"Eternal Return of the Digital Self"*) is a
web-based interactive speculative-fiction experience. The reader navigates a
graph of interconnected **story nodes** rendered as an interactive D3 force
map. Visiting nodes reveals neighbouring nodes and links, mutates node
appearance (color/size), and records visit order — the narrative is meant to
adapt to *which* nodes you visit and *in what order*.

It is a full-stack TypeScript/JavaScript app split into two **independent**
sub-projects:

- `client/` — React 19 + TypeScript + Vite single-page app (the actual experience).
- `server/` — Node.js + Express 5 + MongoDB/Mongoose REST API.

## Repository layout

```
/                      # root: package.json is EMPTY ({}). No monorepo tooling, no workspaces.
├── client/            # frontend (own package.json, own package-lock.json)
│   ├── index.html
│   ├── vite.config.ts
│   ├── eslint.config.js        # flat ESLint config (typescript-eslint)
│   ├── tsconfig*.json
│   ├── src/
│   │   ├── main.tsx            # React entry → renders <App/>
│   │   ├── App.tsx             # BrowserRouter + routes, wraps app in <StoryProvider>
│   │   ├── pages/
│   │   │   ├── HomePage.tsx        # route "/"  — full node map, click a node to enter
│   │   │   └── NarrativePage.tsx   # route "/narrative/:nodeId" — story text + minimap
│   │   ├── components/
│   │   │   ├── NodeMap.tsx         # large interactive D3 force-directed graph
│   │   │   └── MiniMap.tsx         # small overview map shown on the narrative page
│   │   ├── data/
│   │   │   └── storyGraph.json     # ⭐ SINGLE SOURCE OF TRUTH for the story graph
│   │   ├── context/            # state management (see "State management" below)
│   │   └── services/           # API client, persistence, story-logic helpers
│   └── tests/                  # Vitest unit tests (run with `npm test`; see "Tests")
├── server/            # backend (own package.json, own package-lock.json)
│   ├── index.js               # Express app entry, Mongo connection, route mounting
│   ├── storyGraph.js          # re-exports client/src/data/storyGraph.json for the seed
│   ├── seed.js                # `npm run seed` — writes the graph to MongoDB (DESTRUCTIVE)
│   ├── .env                   # git-ignored, untracked (you create it locally) — see "Security notes"
│   ├── .env.example           # template to copy to .env
│   ├── .gitignore             # ignores node_modules + .env (keeps .env.example)
│   ├── models/                # Mongoose schemas: StoryNode, StoryLink, UserProgress
│   └── routes/api/            # REST routers: storyNodes, storyLinks, userProgress
└── tools/             # standalone dev scripts (no package.json; run with plain `node`)
    └── generate-node.js       # AI co-authoring CLI — see "Authoring nodes with AI" below
```

## Running the project

There is **no root-level script**. The two halves run separately, each from its
own directory.

### Frontend (`client/`)
```bash
cd client
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm run build      # tsc (type-check) THEN vite build → client/dist  ✅ works
npm run lint       # ESLint 9 flat config; --max-warnings 0  ✅ works (clean)
npm run preview    # serve the production build locally
npm test           # Vitest (run mode) — pure-logic unit tests in client/tests/  ✅ works
npm run test:watch # Vitest in watch mode
```

### Backend (`server/`)
```bash
cd server
npm install
npm run dev        # nodemon index.js (auto-restart)
npm run start      # node index.js
npm run seed       # ⚠️ DESTRUCTIVE: clears + reseeds StoryNode/StoryLink with the starter graph
# Listens on PORT (default 3001). Requires MONGODB_URI in server/.env.
npm test           # ⚠️ NOT IMPLEMENTED — prints an error and exits 1
```

The backend serves the built client only when `NODE_ENV=production` (it static-
serves `client/dist`). In development the two run as separate origins and rely on
CORS, which is restricted to an allow-list (`config.allowedOrigins`, from the
`CLIENT_ORIGINS` env var; defaults to the Vite dev/preview origins in
development). Runtime config is centralised and validated in `server/config.js`,
which fails fast if `MONGODB_URI` is missing — see "Security notes".

## Tech stack & key versions

- **Frontend:** React `19`, React Router DOM `6`, Vite `5`, TypeScript `5`,
  D3 `7` (imported as granular `d3-selection`/`d3-force`/`d3-zoom`/`d3-drag`
  modules in `NodeMap.tsx`, but as a namespace `import * as d3` in `MiniMap.tsx`),
  framer-motion `12` (page transitions), axios.
- **Backend:** Express `5`, Mongoose `8`, MongoDB driver `6`, dotenv, cors, uuid.
  `server/package.json` uses CommonJS (`"type": "commonjs"`, `require`/
  `module.exports`). The client is ESM.

## State management (the important part)

Client state lives in a **React Context + `useReducer`** store, not Redux.

**The live wiring** (this is what actually runs):
- `context/StoryProvider.tsx` — the provider used in `App.tsx`. Creates the
  reducer store and exposes helper methods (`visitNode`, `revealNode`,
  `revealLink`, `setFlag`, `resetStory`, `loadStory`, `getCurrentNode`,
  `getVisibleNodes`, `getVisibleLinks`, plus raw `dispatch`).
- `context/StoryReducer.ts` — the live reducer (`storyReducer`). Handles
  `VISIT_NODE`, `REVEAL_NODE`, `REVEAL_LINK`, `SET_FLAG`, `RESET_STORY`,
  `LOAD_STORY`, `UPDATE_NODE_POSITIONS`.
- `context/InitialState.ts` — the bundled offline-fallback story graph. It no
  longer hardcodes anything: it imports the canonical `data/storyGraph.json` and
  runs it through `storyMapper.buildStoryState`. **The graph content lives in
  `client/src/data/storyGraph.json`** (15 nodes): three paths from `start` —
  whispers (`pathA`→`whisperSource`→`whisperDepths`), echoes
  (`pathB`→`echoChamber`→`echoDepths`), and silence (`pathC`→`silenceSource`, the
  Null) — woven together by source↔source resonance shortcuts, plus six endings:
  `convergence` (both sources), `singularity` (secret order echo→whisper),
  `chorus` (all three sources), and the three order-determined endings `descent`
  (whisper→echo→silence), `emergence` (silence→echo→whisper) and `persistence`
  (whisper→silence→echo). See "The story graph (single source of truth)" below.
- `data/storyGraph.json` — **the single source of truth for the story graph.**
  Server-DTO shape (conditions serialized as JSON strings), so the offline
  fallback (via `buildStoryState`) and the backend API path produce the identical
  client state. The server seed (`server/storyGraph.js`) re-exports this same
  file. Edit the graph here and **nowhere else**; `npm test` validates its
  integrity (`tests/graphIntegrity.test.ts`).
- `context/StoryTypes.ts` — the canonical shared types (`StoryNode`,
  `StoryLink`, `StoryChoice`, `StoryState`, `StoryContextType`, `StoryAction`).
- `context/StoryContextDefinition.ts` — `createContext` call.
- `context/context.ts` — exports `StoryContext` and the `useStory()` hook.
  **Import `useStory` from here** (`../context/context`), as the pages do.
- `context/index.ts` — barrel re-exporting `StoryProvider`, `useStory`, types.

### Single source of truth (after dead-code cleanup)

The context layer previously had three parallel copies of the store/initial
data left over from iteration. These have been removed so the live files above
are the only ones:

- Deleted `context/StoryContext.tsx` (legacy self-contained store) — its type
  consumers (`services/ApiService.ts`, `services/SaveLoadService.ts`) now import
  from `StoryTypes.ts`.
- Deleted `context/StoryInitialState.ts` (unused duplicate of `InitialState.ts`).
- Deleted `context/useStory.ts` (duplicate hook; the live one is in `context.ts`).

When you change the story graph, node shape, or state logic, update the live
files and keep `StoryTypes.ts` as the single source of truth for types. Don't
reintroduce parallel copies of the reducer or initial state.

### Reducer behaviour worth knowing
- `VISIT_NODE` increments `visitCounts[nodeId]`, sets `isRevealed`, recolors a
  re-visited node to purple (`#6a0dad`), shrinks it slightly each visit, appends
  to `history`, and auto-reveals connected links.
- Visibility is derived: `getVisibleNodes()` = nodes with `isRevealed`;
  `getVisibleLinks()` = revealed links whose *both* endpoints are revealed.
- `StoryChoice.condition` is a function `(state) => boolean` (filters which
  choices render). On the client it is a runtime predicate; the server's
  `StoryNode` schema stores `condition` as a string. The two are reconciled by
  `services/conditionDSL.ts`: conditions are authored as serializable
  `ConditionSpec` objects, stored as `JSON.stringify(spec)` on the server, and
  compiled back to predicates by `storyMapper`. The same mechanism backs
  `textVariants` (see below).

### Text variants
- `StoryNode.textVariants?: TextVariant[]` — adaptive prose fragments that append
  to a node's base `text` as the reader revisits nodes, sees them in a particular
  order, or trips story flags. Each `TextVariant` is `{ id, text, priority,
  condition }` where `condition` is a `ConditionSpec` (see `conditionDSL.ts`).
- **Additive, not replacing:** the base `text` always renders; `getNodeText`
  appends every variant whose condition matches, sorted by `priority` descending.
  There is no per-node hardcoded text switch — all adaptive prose lives in the
  node data.
- **One source, conditions as strings:** variants live in the canonical
  `client/src/data/storyGraph.json` with their condition `JSON.stringify`-ed (the
  same serialized shape the backend stores). `storyMapper.mapServerNode` parses
  those strings back into `ConditionSpec` objects when building the client state
  (dropping any that won't parse). Edit the variant in the JSON only — see
  "The story graph (single source of truth)" below.

### Morphing prose (the beats model)

Beyond appended `textVariants`, a node may carry compositional **`prose`** — an
ordered list of **beats** that MORPH the sentence by path rather than appending to
it. Types: `ProseBeat { id, includeWhen?, phrasings: ProsePhrasing[] }` and
`ProsePhrasing { id?, text, priority?, when? }` (in `StoryTypes.ts`).

- **Render** (`StoryLogicService.renderProse`): per beat, skip it if `includeWhen`
  fails; otherwise pick the **highest-priority phrasing whose `when` matches**,
  falling back to the conditionless default (ties → author order). The chosen
  phrasings are woven with single spaces into one paragraph. `getNodeText` routes
  through `renderProse` when `node.prose` is present, ELSE the legacy `text` +
  appended-variants path — so migration is incremental and per-node.
- **Conditions** are serialized `ConditionSpec` strings in the JSON (same as
  variants/choices); `storyMapper.mapServerProse` parses them (dropping an
  unparseable phrasing, then a beat with no usable phrasings).
- **"Why this text?"** uses `getActiveAdaptations` (unified over both models): for
  a prose node it returns the conditionally-chosen phrasings (defaults omitted,
  since a default has no path-specific reason); for a legacy node it returns
  `getMatchingVariants`. The adaptation ledger uses the same accessor.
- **Authoring rule** (enforced by `graphIntegrity`): every beat must be able to
  render something — a default phrasing OR an `includeWhen`. Beat ids unique per
  node; phrasing ids unique per beat. `whisperSource` is the reference node
  (arrival morphs by route; a `return-depth` beat replaces the arrival on
  revisits; a `silence-mark` beat appears only after the Null). Covered by
  `proseMorph.test.ts` (and the whisperSource cases in `contentVariants.test.ts`).
- The server `StoryNode` schema has a matching optional `prose` field.

### Exporting the experienced novel (`services/narrativeExport.ts`)

`buildTranscript(state)` REPLAYS `state.history` from a cleared graph through the
real reducer + a PRIVATE `StoryLogicService` instance (so it never disturbs the
live singleton), snapshotting `getNodeText` after each visit — one `NovelSection`
per visit, **repeats kept**, each faithful to how it read at that step (recency/
order morphs included). `toMarkdown` serializes a transcript to a Markdown book
(title, colophon/permutation fingerprint, one `## ` chapter per section).
`NarrativePage` wires the download button. The `NovelSection.chapter` slot is
reserved for later structure (chapter grouping, connective edge-prose). Covered by
`narrativeExport.test.ts`. Determinism matters: same path → same novel.

## Services layer (`client/src/services/`)

- `ApiService.ts` — axios REST client for the backend (`fetchAllNodes`,
  `fetchAllLinks`, `fetchNode`, `saveUserProgress`, `loadUserProgress`, …).
  Base URL from `import.meta.env.VITE_API_URL` (fallback `http://localhost:3001/api`).
  Also exports `getStoredUserId`/`setStoredUserId` (anonymous user id in
  localStorage, key `project-leibniz-user-id`). **Wired into `StoryProvider`.**
- `storyMapper.ts` — translates backend DTOs (`ServerNode`/`ServerLink`, with
  their nested `visualProperties`/`metadata`) ↔ the flat client `StoryState`.
  `buildStoryState`, `applyProgress` (reconstructs reveal state from history),
  and `toProgressPayload` live here. **All shape-knowledge of the API lives in
  this file** — keep it there.
- `StoryLogicService.ts` — a priority-ordered rule engine (`evaluateState`) plus
  the text helpers `getNodeText(nodeId, state)`, `getMatchingVariants(nodeId,
  state)`, and `getAdaptationLedger(state)`. **All are wired in:** `StoryProvider`
  runs `evaluateState` after every visit (on `history`/`visitCounts` change) to
  set the story flags (`bothPathsVisited`, `convergenceUnlocked`,
  `secretPathDiscovered`, …) and reveal the endings; `NarrativePage` calls
  `getNodeText` (to render the prose), `getMatchingVariants` (to power the "Why
  this text?" panel — the current node's active adaptive fragments, each with a
  `describeCondition` reason), and `getAdaptationLedger` (the run-wide "How your
  journey has adapted" panel: every currently-active variant across all visited
  nodes, grouped by node in first-visit order, so the breadth of the
  order-dependence is legible beyond the current node).
  `getNodeText` returns the node's base `text` with every matching `textVariant`
  appended (highest priority first) — see "Text variants" below. Variant predicates are compiled
  from the condition DSL once and cached by `${nodeId}::${variantId}`; the cache
  is cleared in `reset()` (call it on restart/reload — the singleton's mutable
  once-rule + cache state survives remounts). **Adding an ending touches three
  places that must agree:** a `once` rule here that sets its unlock flag (order
  endings reuse the `historyEndsWith`/`orderSeen` DSL), the `ENDING_NODE_IDS` set
  here (so `isEnding` hides further choices), and `ENDING_UNLOCKS` in
  `StoryProvider` (so the node + its links light up on the map when the flag
  flips). Then add the node, a flag-gated choice from `start`, and a `start`→node
  link in the JSON. `endingsIntegration.test.ts` covers the order endings.
- `conditionDSL.ts` — a small **serializable** condition language. Conditions are
  authored as plain-data `ConditionSpec` objects and compiled to
  `(state) => boolean` predicates with `compileCondition`. Twelve kinds: `flag`,
  `visited`, `notVisited`, `visitedCountAcross` (compares the summed visit count
  across several nodes), `withinNSteps` (a node was visited within the last N
  history entries — recency, vs. `visited` which is true forever), `historyEndsWith`
  (exact consecutive tail of history), `historyStartsWith` (exact consecutive
  *head* — how the run opened), `orderSeen` (relative order, gaps allowed),
  `visitedImmediatelyAfter` (a direct `first`→`second` hop anywhere in history —
  adjacency, vs. `orderSeen`'s gaps and `historyEndsWith`'s tail-only),
  `and`, `or`, `not`. The same compiler runs in both paths, so a
  condition behaves identically whether the graph came from the backend (parsed
  from the stored JSON string with `parseConditionSpec`/`compileConditionFromString`)
  or the offline fallback (compiled inline). Used by both `StoryChoice.condition`
  and `TextVariant`. `describeCondition(spec, resolveLabel?)` renders a spec as a
  human-readable explanation (e.g. "you arrived here via the Echo Chamber → the
  Source of Whispers") — used by the "Why this text?" affordance on `NarrativePage`.
- `SaveLoadService.ts` — localStorage persistence (key `project-leibniz-save`).
- `SaveLoadControls.tsx` — Save/Load/Reset UI. **Mounted on `HomePage`.** Save
  writes both localStorage and the backend (via `saveProgress`).
- `mapVisuals.ts` — **pure** (no React/D3) derivations that make a playthrough's
  ORDER legible on the map: `getVisitOrder(history)` (1-based first-visit number
  per node), `getVisitRecency(history, floor?)` (a `[floor,1]` decay weight per
  visited node — most-recently-visited = 1, oldest = `floor` — so a *cooling
  trail* fades behind the reader; ranks by LAST visit, so a revisit refreshes a
  node), `getTrailLinkKeys(history, links)` (the directed `source->target`
  edges actually walked, for the highlighted trail), `getNodeRole(...)`
  (current > ending > visited > unvisited emphasis), and `getJourneyFrame(history,
  links, step)` (bundles the above for the first `step` visits — `visitOrder`,
  `recency`, `trailKeys` and the `currentId` at that step — so the map can REPLAY
  a journey by truncating history; `HomePage`'s play/scrub controls drive `step`,
  and because only annotations change (not node ids) NodeMap re-renders without
  reheating the simulation). `HomePage` calls these to
  annotate the D3 node/link data (`visitOrder`/`recency`/`isCurrent`/`isEnding`
  on nodes, `onTrail` on links); both `NodeMap` (`HomePage`) and `MiniMap`
  (`NarrativePage`) render them (badges/order numbers, gold trail + direction
  arrows on NodeMap, role strokes, and `recency` driving node fill/halo opacity —
  the current node always stays fully lit). Covered by `mapVisuals.test.ts` plus
  the DOM tests `nodeMap.render.test.tsx` / `miniMap.render.test.tsx`.

### Backend integration (wired)
On mount, `StoryProvider` fetches `/api/nodes` + `/api/links`, maps them with
`storyMapper.buildStoryState`, restores saved progress for the stored
`userId` via `/api/progress/:userId` (`applyProgress`), and dispatches
`LOAD_STORY`. **If the backend is unreachable or returns no nodes, it falls back
to the bundled `context/InitialState.ts`** so the app still runs offline — so
"nothing loaded from the API" is a *normal* state in dev when no server/DB is up.
`saveProgress()` (exposed on the context, used by `SaveLoadControls`) POSTs the
progress subset (`currentNodeId`/`visitCounts`/`flags`/`history` — the only
fields the `UserProgress` schema stores) to `/api/progress`.

The context exposes two integration members beyond the helpers:
`isLoading` (true during the initial fetch) and `saveProgress()`.

**To get real data flowing:** start the server with a reachable `MONGODB_URI`,
run `npm run seed` once to populate the graph, then run the client. The seed and
the client's offline fallback both derive from the same `client/src/data/storyGraph.json`,
so there is nothing to keep in sync — edit that one file and re-seed.

## Authoring nodes with AI (`tools/generate-node.js`)

A standalone, dependency-free Node CLI (uses the built-in global `fetch`; needs
Node 18+) that asks an LLM to co-author a fully-formed story node — morphing
`prose` beats (preferred) or legacy appended `textVariants`, plus `choices` and
`links` — in the exact shape `server/seed.js` expects (conditions serialized to
JSON strings). The system prompt teaches the full **12-kind** Condition DSL and
the beats model (arrival/return/layer beats, `includeWhen`/`when`/default), and
the validator enforces the same authoring rule as `graphIntegrity` (every beat
has a default phrasing or an `includeWhen`; EITHER `prose` OR `textVariants`).
Internals are exported (`module.exports`) for testing; it self-runs only as a
CLI (`require.main === module`).

```bash
node tools/generate-node.js "A node where the reader meets their own echo"
node tools/generate-node.js --concept brief.md --existing nodes.json --out new.json
node tools/generate-node.js --batch concepts.jsonl --style-ref prose-sample.txt
node tools/generate-node.js "..." --dry-run        # print the assembled prompt only
```

- **Provider:** Claude API by default (needs `ANTHROPIC_API_KEY`), with an OpenAI
  fallback (`OPENAI_API_KEY`); auto-selects based on which key is present, or
  force with `--provider`. Default model `claude-3-5-haiku-latest` (`--model` to
  override).
- The system prompt embeds the full Condition DSL reference and output schema;
  the script **validates** the returned JSON (DSL kinds, schema, choice↔link
  consistency, at-least-one-conditional) before emitting, and prints token usage
  plus a rough cost estimate on stderr (stdout stays clean JSON).
- Output is in the canonical server-DTO shape (conditions as JSON strings), so it
  drops straight into `client/src/data/storyGraph.json` — the single source. No
  mirroring needed; the client derives `InitialState` and the server seeds from
  that same file. Run `npm test` afterward to integrity-check the graph.

## Backend API reference

Mounted in `server/index.js`. All under `/api`.

- **Story nodes** (`/api/nodes`, `routes/api/storyNodes.js`)
  - `GET /` all nodes · `GET /:id` one node (by string `id`, not Mongo `_id`)
  - `POST /` create · `PUT /:id` update · `DELETE /:id`
- **Story links** (`/api/links`, `routes/api/storyLinks.js`)
  - `GET /` all · `GET /source/:sourceId` · `GET /target/:targetId`
  - `POST /` create · `PUT /:sourceId/:targetId` update · `DELETE /:sourceId/:targetId`
  - Links are uniquely keyed by `(source, target)` (compound unique index).
- **User progress** (`/api/progress`, `routes/api/userProgress.js`)
  - `GET /:userId` · `POST /` (upsert; generates a `uuid` if `userId` omitted) ·
    `DELETE /:userId`
- `GET /api/test` — health-check returning `{ message: "Hello from the backend!" }`.

Mongoose models (`server/models/`): `StoryNode`, `StoryLink`, `UserProgress`.
All add `createdAt`/`updatedAt` via a `pre('save')` hook. `UserProgress`
stores `visitCounts` and `flags` as Mongo `Map`s and a `history` string array.

## Conventions & gotchas

- **Two package trees.** Run `npm install` in `client/` and `server/`
  separately. The root `package.json` is empty — don't add scripts expecting a
  monorepo runner.
- **Type-check is the real gate.** `npm run build` runs `tsc` (strict, with
  `noUnusedLocals`/`noUnusedParameters`) before `vite build`, so keep new client
  code warning-clean or the build fails. `tsc && vite build` currently passes.
- **Linting works and passes clean.** The toolchain is ESLint 9 flat config:
  `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, and the react-hooks /
  react-refresh plugins (v5 / v0.4.16). `npm run lint` runs with
  `--max-warnings 0`, so keep new code warning-free. Config notes: unused vars
  prefixed `_` are ignored (`@typescript-eslint/no-unused-vars` ignore patterns);
  a few effects in `NodeMap.tsx`/`NarrativePage.tsx` carry intentional
  `// eslint-disable-next-line react-hooks/exhaustive-deps` with a reason — don't
  remove them blindly.
- **`d3` is loosely typed.** `src/d3.d.ts` declares `module 'd3'` (so namespace
  `import * as d3` in `MiniMap.tsx` is effectively `any`). Type your d3 callback
  params explicitly (e.g. `(d: NodeData) => …`) rather than reaching for
  `@ts-ignore` — the recommended config bans `@ts-ignore`.
- **Keep `console.log` out of the runtime paths.** The reducer/pages/NodeMap used
  to log verbosely; those debug logs have been removed. Only genuine diagnostics
  remain — `console.warn`/`console.error` for real error/fallback conditions
  (e.g. `storyMapper` dropping an unparseable variant, the `StoryProvider` offline
  fallback, save/load failures). Don't reintroduce informational `console.log`s.
- **Fast Refresh / context files.** Keep React context objects in their own
  non-component module (`StoryContextDefinition.ts` exports only the context) so
  `react-refresh/only-export-components` stays happy. Don't co-locate a component
  export with the context.
- **Tests: Vitest on the client only.** Mostly pure logic — `conditionDSL`,
  `StoryReducer`, `StoryLogicService` (variants + rule engine), `storyMapper`,
  `mapVisuals` (visit-order / trail / role derivation), `graphIntegrity`
  (validates the canonical `data/storyGraph.json`: no dangling choice
  targets/links, all conditions parse, unique ids, every node reachable from
  `start`), `endingsIntegration` (drives playthroughs through the real
  reducer + rule engine and asserts the order-based endings fire for the right
  visit orders), and `contentVariants` (same playthrough harness, asserts the
  order-sensitive `textVariants` — opening moves, direct hops, deep revisits —
  surface for the right order and stay hidden otherwise). Default env is `node`. **DOM/component tests** (e.g.
  `nodeMap.render.test.tsx`) opt into jsdom with a `// @vitest-environment jsdom`
  docblock on the first line and use `@testing-library/react`; they assert the
  synchronous render structure (data-join groups, badges, trail), NOT animated
  end-states or settled simulation positions (those run on timers that don't
  settle deterministically under jsdom). Test files match `tests/**/*.test.{ts,tsx}`
  (config in `client/vitest.config.ts`, which loads `@vitejs/plugin-react`). Run
  with `npm test`. Tests live outside `src/` so the app build's `tsc` ignores
  them, but `eslint .` still lints them (keep them warning-clean). The **server**
  has no tests — its `test` script deliberately exits 1. When you change the story
  graph, run `npm test`: `graphIntegrity` catches broken references and
  unreachable nodes.
- **D3 import styles differ** between `NodeMap.tsx` (granular modules) and
  `MiniMap.tsx` (`import * as d3`). `src/d3.d.ts` declares `module 'd3'` to keep
  the namespace import type-checking.
- **NodeMap is a persistent-simulation component.** It builds the SVG/defs/zoom/
  simulation ONCE (a mount-only "scaffold" effect) and then does incremental
  enter/update/exit data joins on each data change — it does NOT tear down and
  rebuild. Node objects are kept stable across renders in a `Map` ref (so layout
  survives reveals), new nodes are seeded at a placed neighbour, and the
  simulation is reheated ONLY when the node/edge set changes (a signature check)
  — never on a pure position/presentation update, which is what prevents the
  settle → `UPDATE_NODE_POSITIONS` → re-render → reheat loop. Once-attached
  handlers (click/hover) read the latest props via refs so they never go stale.
  `zoomToFit` reads the live position store, not the lagging `nodesData` prop.
  **MiniMap, by contrast, still fully re-renders** (`selectAll('*').remove()`) —
  it's small and cheap, so that's fine; its scale domains are finite-guarded so a
  not-yet-positioned node can't produce NaN coordinates.
- **Map centring depends on passing the REAL container size.** `HomePage`
  measures the `.node-map-container` box with a `ResizeObserver` and passes its
  actual `clientWidth/clientHeight` to `NodeMap` (the SVG fills that box via
  `width/height:100%`), because `forceCenter`/`zoomToFit` centre against those
  numbers — feed it the wrong size and the map sits off-centre. The zoom
  transforms also account for scale: to land a point p at the viewport centre the
  translate subtracts `scale*p` (not just `p`), and the initial transform scales
  *about* the centre rather than translating by it.

## Security notes (please surface, don't propagate)

- **`server/.env` previously contained a live MongoDB Atlas connection string
  and password and was committed to the repo.** It has now been removed from
  tracking (`git rm --cached server/.env`) and is git-ignored via the new
  `server/.gitignore`; copy `server/.env.example` to `server/.env` and fill in
  real values locally. **The credential is still present in git history**, so it
  must be treated as compromised: rotate the MongoDB password in Atlas. Do **not**
  copy the old value into code, commits, PRs, or chat.
- **CORS is now restricted to an allow-list.** `server/index.js` uses an `origin`
  callback against `config.allowedOrigins` (from `CLIENT_ORIGINS`, comma-
  separated). Development defaults to the Vite dev/preview origins; production
  must set `CLIENT_ORIGINS` explicitly unless the API only serves the bundled
  same-origin client. Requests with no `Origin` header (curl, health checks) pass.
- **Env is validated at startup.** `server/config.js` loads `.env` and exits with
  a clear message if `MONGODB_URI` is missing, rather than failing deep inside
  mongoose. Both `index.js` and the seed read config/env through this path.
- **CI** (`.github/workflows/ci.yml`) runs on push to `main` and on every PR:
  the client job runs `npm ci && lint && test && build`; the server job installs
  and syntax-checks the entry points + verifies the seed graph loads (there is no
  server test suite yet).
- **`node_modules` is committed to the repo** (root + `server/`, ~2000 files) —
  pre-existing, not yet cleaned up. It bloats the tree and should be untracked
  (`git rm -r --cached`) with a root `.gitignore` added, but that is a large,
  separate change.

## Git workflow for assistants

- Active development branch for this work: `claude/claude-md-docs-7ac1ga`.
  Develop, commit, and push there; create it locally if missing. Never push to
  `main` or another branch without explicit permission.
- Push with `git push -u origin <branch>`; retry transient network failures with
  exponential backoff.
- **Do not open a pull request unless explicitly asked.**
- Commit history style here is terse (e.g. "sizing fixes", "cline fixes"); write
  clearer, descriptive commit messages than the existing log.
