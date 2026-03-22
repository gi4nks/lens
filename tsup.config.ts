import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  bundle: true,
  minify: false,
  sourcemap: true,
  external: ['@lydell/node-pty'] // node-pty is a native module, better to keep it external or configure it carefully
});
