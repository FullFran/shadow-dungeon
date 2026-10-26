import { defineConfig } from 'vitest/config';

/**
 * The live beatability proofs of the Sendas' bosses take minutes. They run
 * with `npm run test:proofs` (PROOFS=1), and CI runs them only when a push
 * touches what they prove (.github/workflows/deploy.yml).
 */
const HEAVY_PROOFS = ['tests/sim/story-prove-*.test.ts', 'tests/sim/wound-prove.test.ts'];

export default defineConfig({
  test: {
    include: process.env.PROOFS === '1' ? HEAVY_PROOFS : ['tests/**/*.test.ts'],
    exclude: process.env.PROOFS === '1' ? [] : HEAVY_PROOFS,
    environment: 'node',
  },
});
