# Consolidation provenance

The immutable reference state is tag `pre-consolidation-2026-07-13`.

Project-Leibniz software is MIT-licensed under `LICENSE`; narrative and media content is reserved under `CONTENT_LICENSE.md`. Narramorph may study or reimplement the following concepts, with file-level attribution where code or prose is directly adapted:

- the serializable condition DSL in `client/src/services/conditionDSL.ts`;
- explanation behavior in the narrative UI and story logic;
- `ProseBeat`/`ProsePhrasing` and rendering behavior;
- condition-aware edge prose;
- experienced-journey export in `client/src/services/narrativeExport.ts`.

Preferred transfer mode is a clean-room reimplementation inside Narramorph's existing domain/state architecture. Direct copying requires a provenance entry naming this repository, immutable commit, source path, target path, transfer type, license, and approving PR.

The Express/Mongo backend, React Context state architecture, and current D3 visual design are not approved v1 transfers.
