import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The extractors call `new DOMParser()`. jsdom would work, but @xmldom is
    // what the MCP server ships with, so tests exercise the same parser the
    // Node consumer actually uses (see test/setup.ts).
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // Underscore-prefixed files are scratch/experiment files (also gitignored).
    // Excluding them keeps the reported test count honest: a stray scratch file
    // once inflated the suite from 53 to 57 and was committed in a release.
    exclude: ['test/**/_*.test.ts', 'node_modules/**'],
  },
});
