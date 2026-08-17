import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The extractors call `new DOMParser()`. jsdom would work, but @xmldom is
    // what the MCP server ships with, so tests exercise the same parser the
    // Node consumer actually uses (see test/setup.ts).
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
});
