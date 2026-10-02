import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.COLLECTION_BASE || '/LEGO-Collection/', build: { chunkSizeWarningLimit: 800, rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } } } });
