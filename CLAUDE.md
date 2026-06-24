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
│   └── src/
│       ├── main.tsx            # React entry → renders <App/>
│       ├── App.tsx            # BrowserRouter + routes, wraps app in <StoryProvider>
│       ├── pages/
│       │   ├── HomePage.tsx        # route "/"  — full node map, click a node to enter
│       │   └── NarrativePage.tsx   # route "/narrative/:nodeId" — story text + minimap
│       ├── components/
│       │   ├── NodeMap.tsx         # large interactive D3 force-directed graph
│       │   └── MiniMap.tsx         # small overview map shown on the narrative page
│       ├── context/                # state management (see "State management" below)
│       └── services/               # API client, persistence, story-logic helpers
└── server/            # backend (own package.json, own package-lock.json)
    ├── index.js               # Express app entry, Mongo connection, route mounting
    ├── .env                   # git-ignored, untracked (you create it locally) — see "Security notes"
    ├── .env.example           # template to copy to .env
    ├── .gitignore             # ignores node_modules + .env (keeps .env.example)
    ├── models/                # Mongoose schemas: StoryNode, StoryLink, UserProgress
    └── routes/api/            # REST routers: storyNodes, storyLinks, userProgress
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
npm run lint       # ⚠️ BROKEN — see "Linting is broken" below
npm run preview    # serve the production build locally
```

### Backend (`server/`)
```bash
cd server
npm install
npm run dev        # nodemon index.js (auto-restart)
npm run start      # node index.js
# Listens on PORT (default 3001). Requires MONGODB_URI in server/.env.
npm test           # ⚠️ NOT IMPLEMENTED — prints an error and exits 1
```

The backend serves the built client only when `NODE_ENV=production` (it static-
serves `client/dist`). In development the two run as separate origins and rely on
CORS (enabled wide-open in `server/index.js`).

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
- `context/InitialState.ts` — the live initial story graph (5 nodes: `start`,
  `pathA`, `pathB`, `whisperSource`, `echoChamber`). **This hardcoded data is
  the actual story content the app loads** — see "Backend is not wired in" below.
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
  choices render). Note this is a runtime function on the client, while the
  server's `StoryNode` schema stores `condition` as a string — the two models
  are **not** currently reconciled.

## Services layer (`client/src/services/`)

- `ApiService.ts` — axios REST client for the backend (`fetchAllNodes`,
  `fetchAllLinks`, `fetchNode`, `saveUserProgress`, `loadUserProgress`, …).
  Base URL from `import.meta.env.VITE_API_URL` (fallback `http://localhost:3001/api`).
  **Currently instantiated but not imported by any component** — the frontend
  does not yet load story content from the backend.
- `StoryLogicService.ts` — a priority-ordered rule engine (`evaluateState`) plus
  `getNodeText(nodeId, state)`. Only `getNodeText` is wired in (used by
  `NarrativePage`); `evaluateState`/the rule list is defined but **not called**.
- `SaveLoadService.ts` — localStorage persistence (key `project-leibniz-save`).
- `SaveLoadControls.tsx` — Save/Load/Reset UI component. **Defined but not
  rendered anywhere** yet.

### Backend is not wired in (current state)
The running app uses the **hardcoded** graph from `context/InitialState.ts`.
`ApiService` and the server REST API exist but nothing fetches from them on
load, and `SaveLoadControls` isn't mounted. Treat the backend + services as
scaffolding that is built but not yet connected to the UI. If asked to "make the
story load from the database," the work is: call `ApiService` (e.g. in
`StoryProvider`/an effect), map server documents → the client `StoryState`
shape, and `loadStory(...)` the result.

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
- **Linting is broken (pre-existing).** `npm run lint` fails for two unrelated,
  pre-existing reasons: (1) the script passes `--ext ts,tsx`, which is invalid
  under the flat `eslint.config.js`; and (2) the installed ESLint is `8.57`
  (per `package.json`'s `^8.45.0` + old `@typescript-eslint/*` deps), but
  `eslint.config.js` is ESLint-9 flat-config style importing `typescript-eslint`,
  `@eslint/js`, and `globals` — packages not in `devDependencies`. Fixing it
  means choosing one ESLint era and aligning deps + config + script; until then,
  rely on `tsc` for static checking. (Not yet fixed — out of scope of the cleanup
  that produced this doc.)
- **Heavy `console.log` usage.** The reducer, provider, and pages log verbosely
  (debugging aids left in). Match the surrounding style if extending, but
  consider not adding more noise.
- **Fast Refresh workaround pattern.** A couple of context files export a dummy
  no-op default React component purely to satisfy
  `react-refresh/only-export-components`. That's why `StoryContextDefinition.ts`
  contains an unused component — it's intentional, not a mistake.
- **No tests exist** anywhere (client or server). There is no test runner
  configured; the server `test` script deliberately exits 1.
- **D3 import styles differ** between `NodeMap.tsx` (granular modules) and
  `MiniMap.tsx` (`import * as d3`). `src/d3.d.ts` declares `module 'd3'` to keep
  the namespace import type-checking.

## Security notes (please surface, don't propagate)

- **`server/.env` previously contained a live MongoDB Atlas connection string
  and password and was committed to the repo.** It has now been removed from
  tracking (`git rm --cached server/.env`) and is git-ignored via the new
  `server/.gitignore`; copy `server/.env.example` to `server/.env` and fill in
  real values locally. **The credential is still present in git history**, so it
  must be treated as compromised: rotate the MongoDB password in Atlas. Do **not**
  copy the old value into code, commits, PRs, or chat.
- CORS is enabled with no allow-list (`app.use(cors())`), acceptable for local
  dev but not for production as-is.

## Git workflow for assistants

- Active development branch for this work: `claude/claude-md-docs-7ac1ga`.
  Develop, commit, and push there; create it locally if missing. Never push to
  `main` or another branch without explicit permission.
- Push with `git push -u origin <branch>`; retry transient network failures with
  exponential backoff.
- **Do not open a pull request unless explicitly asked.**
- Commit history style here is terse (e.g. "sizing fixes", "cline fixes"); write
  clearer, descriptive commit messages than the existing log.
