import { defineConfig } from 'vitest/config';

// Tests are pure logic (reducer, condition DSL, mappers, the seed/InitialState
// drift guard) — no DOM or React rendering — so they run in the lightweight
// `node` environment. Test files live in `tests/` (outside `src/`) so the app
// build's `tsc` (which compiles `src`) never sees them.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
