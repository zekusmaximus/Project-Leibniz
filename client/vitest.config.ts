import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Most tests are pure logic (reducer, condition DSL, mappers, map-visual
// derivation, the seed/InitialState drift guard) and run in the lightweight
// default `node` environment. Component/DOM tests (e.g. NodeMap rendering) opt
// into jsdom per-file with a `// @vitest-environment jsdom` docblock, so the
// pure-logic suite stays fast. Test files live in `tests/` (outside `src/`) so
// the app build's `tsc` (which compiles `src`) never sees them.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
