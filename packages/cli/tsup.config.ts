import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/migrate.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
