# Project-Leibniz pre-consolidation baseline

Reviewed: July 13, 2026

Immutable tag: `pre-consolidation-2026-07-13`

Tagged commit: `03e35ef858b7f1a7dfbbe63dbf8cc151b95e6df1`

## Role in consolidation

Project-Leibniz is feature frozen and retained as a reference for order-sensitive conditions, plain-language adaptation explanations, compositional prose beats, condition-aware edge prose, and experienced-journey export. Narramorph is the only active product implementation.

The Express/Mongo backend, React Context state architecture, and current visual design are not v1 migration targets unless a later architecture decision explicitly reverses that choice.

## Verified client state

| Check | Result |
|---|---|
| `npm run build` in `client/` | Passed |
| `npm test` in `client/` | 13 files, 137 tests passed |
| `npm run lint` in `client/` | Passed with no warnings/errors |

The client contains a 15-node graph, three initial paths, six endings, a serializable condition DSL, appended variants, an incremental prose-beat model, adaptation explanations, and Markdown journey export.

## Verified server state

- `node --check` passed for the server entry point, seed script, and API routes.
- The server has no automated route/model integration tests.
- The frontend can fall back to the bundled story when the API is unavailable.
- The root `package.json` is intentionally empty; client and server are independent npm projects.
- A historical MongoDB credential was committed in earlier history. Current files ignore `.env`, but the credential must be treated as compromised until external revocation/rotation is confirmed. See `SECURITY.md`.

## UX baseline

Strengths:

- The adaptation ledger clearly explains why prose changed.
- The journey download preserves repeated sections and connective edge prose.
- Narrative choices are represented as accessible buttons once a passage is open.

Risks:

- The first map provides little onboarding or orientation.
- D3 map nodes are not exposed as meaningful semantic controls in the tested accessibility tree.
- Opening the first node involved an unclear select/open interaction.
- Narrative page colors and contrast are inconsistent.
- The frontend logs an expected bundled-content fallback warning when the backend is absent.

## Issue disposition

GitHub reported no open issues on July 13, 2026. Future migration work is tracked in Narramorph's consolidation backlog.

## Archive gate

This repository may be archived only after Narramorph records a migrate/reject decision and passing replacement proof for every Project-Leibniz row in its feature extraction matrix, all provenance is complete, the credential is confirmed revoked, and the owner accepts the Phase 4 parity review.
