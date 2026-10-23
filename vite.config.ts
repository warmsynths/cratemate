import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any folder, e.g. GitHub Pages at /cratemate/
  base: './',
  build: {
    outDir: 'docs',
    // docs/ also holds hand-written notes, so don't wipe it; the build script clears old assets first
    emptyOutDir: false
  }
});
