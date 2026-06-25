# Project-Leibniz

### *Eternal Return of the Digital Self* — an interactive speculative-fiction experience

Project-Leibniz is a web app where you read a short, strange novel by *navigating*
it. The story is a graph of interconnected **nodes** drawn as an interactive
[D3](https://d3js.org/) force map. Click a node to enter it; entering reveals its
neighbours, redraws the map, and — the heart of the project — **adapts the prose to
which nodes you have visited and in what order.**

The same node reads differently depending on how you arrived. Cross *straight* from
the Echo Chamber to the Source of Whispers and the crystal is "still warm with echoes
that have not yet had time to cool into whispers"; arrive by a wandering detour and it
reads otherwise. Six endings are gated not just on *which* places you saw but on the
*sequence* you saw them in. The order is the story.

> **New here?** This README is the front door. For the deep contributor guide —
> exact module wiring, gotchas, and conventions — see [`CLAUDE.md`](./CLAUDE.md).

---

## The core conceit: order-dependent narrative

Three mechanisms work together:

1. **The story graph** ([`client/src/data/storyGraph.json`](./client/src/data/storyGraph.json))
   is the single source of truth — 15 nodes, three paths out of `start`
   (Whispers, Echoes, Silence), source↔source "resonance" shortcuts, and six
   endings. Both the offline app and the database seed derive from this one file.

2. **A serializable condition DSL** ([`conditionDSL.ts`](./client/src/services/conditionDSL.ts))
   lets content gate itself on the playthrough. Conditions are plain JSON data
   (so they survive a round-trip through the database) compiled to predicates.
   Twelve kinds, including order-aware ones: `historyStartsWith` (how the run
   opened), `historyEndsWith` (the exact path that led here), `orderSeen`
   (relative order, gaps allowed), `visitedImmediatelyAfter` (a direct hop),
   `withinNSteps` (recency), `visitedCountAcross`, plus `flag`/`visited`/`and`/
   `or`/`not`.

3. **Adaptive text variants.** Each node has a base `text` plus optional
   `textVariants` — fragments that *append* (never replace) when their condition
   matches, highest priority first. The reader can open a **"Why this text?"**
   panel and a run-wide **"How your journey has adapted"** ledger that explain, in
   plain language, exactly which fragments fired and why.

The engine assembles the experienced prose per node
([`StoryLogicService.getNodeText`](./client/src/services/StoryLogicService.ts)) and
records the full visit order in `state.history`.

### Two ways a node's prose adapts

- **Appended `textVariants`** (the original mechanism): the base `text` always
  renders, and matching fragments are *appended* on top.
- **Morphing `prose` beats** (the compositional model): a node is authored as an
  ordered list of **beats**, each resolving to *one* path-conditioned phrasing (or
  omitted), woven into continuous prose — so the *sentence itself* changes by route,
  not just gets a fragment added. A node with `prose` renders it instead of
  `text`/`textVariants`; nodes without it keep the legacy behavior, so migration is
  incremental. `whisperSource` is authored in this model as the reference example.
  See `ProseBeat`/`ProsePhrasing` in
  [`StoryTypes.ts`](./client/src/context/StoryTypes.ts) and `renderProse` in
  [`StoryLogicService.ts`](./client/src/services/StoryLogicService.ts).

### Download your novel

Because the engine can render a node's morphed prose for any path, your *novel* is
just that rendering written down along your `history`.
[`narrativeExport.ts`](./client/src/services/narrativeExport.ts) replays a run and
captures each visited section as it read **at that step** (repeats kept), then
serializes it to a Markdown book with front matter. The narrative page offers
"Download your novel so far" / "Download your novel" (at endings). EPUB and an
in-app reader are on the roadmap.

---

## Repository layout

This is **not** a monorepo — the root `package.json` is empty. It is two
independent npm projects you run separately:

```
/
├── client/   # React 19 + TypeScript + Vite SPA — the actual experience
│   └── src/
│       ├── data/storyGraph.json   ⭐ single source of truth for the story
│       ├── context/               # React Context + useReducer store
│       ├── services/              # condition DSL, story logic, API client, mappers
│       ├── components/            # NodeMap (big D3 graph), MiniMap
│       └── pages/                 # HomePage (map), NarrativePage (prose + minimap)
├── server/   # Node + Express 5 + MongoDB/Mongoose REST API
│   ├── index.js, config.js        # app entry + validated config
│   ├── models/, routes/api/       # Mongoose schemas + REST routers
│   ├── storyGraph.js              # re-exports client's storyGraph.json
│   └── seed.js                    # writes the graph to MongoDB (destructive)
├── tools/generate-node.js         # AI co-authoring CLI for new nodes
└── CLAUDE.md                      # deep contributor guide
```

The frontend and backend run as separate origins in development (CORS-gated). The
**client works fully offline**: if the backend is unreachable it falls back to the
bundled copy of the graph, so you don't need a database to try it.

---

## Quick start

### Run the client (no database needed)

```bash
cd client
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

That's enough to play the whole experience — the client falls back to the bundled
story graph when no API is reachable.

Other client scripts:

```bash
npm run build      # tsc (type-check, strict) THEN vite build → client/dist
npm run lint       # ESLint 9 flat config, --max-warnings 0
npm test           # Vitest — pure-logic + DOM tests (currently 110 passing)
npm run preview    # serve the production build locally
```

### Run the backend (optional — for persistence + DB-served content)

```bash
cd server
cp .env.example .env          # then edit .env (see below)
npm install
npm run seed                  # ⚠️ DESTRUCTIVE: clears + reseeds the graph collections
npm run dev                   # nodemon → http://localhost:3001  (npm start for plain node)
```

**Environment** (`server/.env`, git-ignored — never commit it):

| Variable         | Required | Notes                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `MONGODB_URI`    | **yes**  | MongoDB / Atlas connection string. Startup fails fast if missing.     |
| `PORT`           | no       | Express port, default `3001`.                                         |
| `NODE_ENV`       | no       | `development` (default) or `production`.                              |
| `CLIENT_ORIGINS` | prod     | Comma-separated CORS allow-list. Dev defaults to the Vite origins.    |

**CORS** is an explicit allow-list (`config.allowedOrigins`), not a wildcard.
Development defaults to `http://localhost:5173` / `:4173`; in production you must
set `CLIENT_ORIGINS` unless the API only serves the bundled same-origin client.
Requests with no `Origin` header (curl, health checks) pass.

In production (`NODE_ENV=production`) the server also static-serves the built
client from `client/dist`, so the whole app can run same-origin from one process.

To point the client at the API, set `VITE_API_URL` (default
`http://localhost:3001/api`).

---

## How a playthrough flows

1. **`HomePage`** (`/`) renders the full node map. Click a revealed node to enter it.
2. **`NarrativePage`** (`/narrative/:nodeId`) visits the node — which appends it to
   `history`, increments its visit count, reveals neighbours and links — then renders
   the assembled prose (base text + every matching variant) plus a minimap of where
   you've been.
3. The **rule engine** ([`StoryLogicService`](./client/src/services/StoryLogicService.ts))
   runs after every visit, sets story flags (e.g. `convergenceUnlocked`,
   `secretPathDiscovered`, the order-ending flags), and lights up newly-unlocked
   endings on the map.
4. Reaching an **ending** node hides further choices and offers *Begin again*.

State lives in a **React Context + `useReducer`** store (not Redux); see the
"State management" section of [`CLAUDE.md`](./CLAUDE.md) for the exact wiring.

### Save / load

`SaveLoadControls` (on the HomePage) persists progress to **localStorage** and,
when the backend is reachable, to **MongoDB** keyed by an anonymous user id. Only
the progress subset is stored (`currentNodeId`, `visitCounts`, `flags`, `history`);
reveal state is *reconstructed* from history on load
([`storyMapper.applyProgress`](./client/src/services/storyMapper.ts)).

---

## Authoring content

**Edit the story in exactly one place:** `client/src/data/storyGraph.json`. The
client derives its offline graph from it and the server seeds from it (via
`server/storyGraph.js`), so there is nothing to keep in sync. After any edit, run
`npm test` — `graphIntegrity.test.ts` validates the graph (no dangling choice/link
targets, all conditions parse, unique ids, every node reachable from `start`).

Conditions on choices and text variants are authored as **serialized
`ConditionSpec` strings** (the same shape the database stores). A whisper that only
appears after you've heard the echoes, for example:

```jsonc
{
  "id": "whispers-hear-echoes",
  "priority": 50,
  "condition": "{\"kind\":\"visited\",\"node\":\"echoChamber\"}",
  "text": "Beneath the whispers you can hear them now: the echoes from the other path, bleeding through the walls."
}
```

Match the existing **lyrical, second-person** authorial voice when you write prose.

### Co-authoring with AI (`tools/generate-node.js`)

A standalone, dependency-free Node CLI (Node 18+) that asks an LLM to draft a
fully-formed node — base text, conditional `textVariants`, `choices`, and `links` —
already in the canonical shape, then validates it before printing clean JSON to
stdout.

```bash
node tools/generate-node.js "A node where the reader meets their own echo"
node tools/generate-node.js "..." --dry-run      # print the assembled prompt only
```

Uses the Claude API by default (`ANTHROPIC_API_KEY`), with an OpenAI fallback
(`OPENAI_API_KEY`); see [`CLAUDE.md`](./CLAUDE.md) for batch mode, style refs, and
model selection. Drop the output into `storyGraph.json` and re-run `npm test`.

---

## Testing & CI

- **Client:** Vitest. ~110 tests covering the condition DSL, reducer, rule engine
  and text variants, the server↔client mapper, map-visual derivations, graph
  integrity, and the order-based endings/variants driven through the real engine.
  DOM tests for `NodeMap`/`MiniMap` opt into jsdom. Run with `npm test` in `client/`.
- **Server:** ⚠️ **no test suite yet** — `npm test` deliberately exits 1. CI
  syntax-checks the entry points and verifies the seed graph loads.
- **CI** ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs on every PR
  and on push to `main`: the client job runs `npm ci && lint && test && build`; the
  server job runs `npm ci` plus `node --check` smoke checks.

---

## API reference (backend)

All routes under `/api`:

| Resource     | Routes                                                                                 |
| ------------ | -------------------------------------------------------------------------------------- |
| Story nodes  | `GET /nodes`, `GET /nodes/:id`, `POST /nodes`, `PUT /nodes/:id`, `DELETE /nodes/:id`   |
| Story links  | `GET /links`, `GET /links/source/:id`, `GET /links/target/:id`, `POST`, `PUT`, `DELETE` (keyed by `source`+`target`) |
| User progress| `GET /progress/:userId`, `POST /progress` (upsert; mints a uuid if omitted), `DELETE /progress/:userId` |
| Health       | `GET /test`                                                                            |

Mongoose stores `condition` (on choices and variants) as a **string**, and
`visitCounts`/`flags` as Mongo `Map`s.

---

## Known caveats & security

- 🔑 **Rotate the MongoDB credential.** A real Atlas connection string was committed
  in `server/.env` early in the project's history. The file is now untracked and
  git-ignored, but **the secret remains in git history and must be treated as
  compromised** — rotate the Atlas password. Never copy the old value into code,
  commits, or chat.
- **No server tests.** The backend has only CI smoke checks; the REST routers and
  Mongoose models are untested.
- **`client/README.md`** is an older, template-flavoured readme scoped to the
  frontend. This root README is the canonical overview.

See [`CLAUDE.md`](./CLAUDE.md) for the full contributor guide, architectural
gotchas (the persistent-simulation `NodeMap`, the singleton rule engine's mutable
state, the offline-fallback path), and conventions.

## Tech stack

**Client:** React 19 · React Router 6 · Vite 5 · TypeScript 5 (strict) · D3 7 ·
framer-motion 12 · axios.
**Server:** Express 5 · Mongoose 8 · MongoDB driver 6 · dotenv · cors · uuid
(CommonJS).
</content>
</invoke>
