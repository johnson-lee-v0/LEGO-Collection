import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.COLLECTION_BASE || '/LEGO-Collection/', server: { proxy: { '/api': 'http://127.0.0.1:4173' } }, build: { chunkSizeWarningLimit: 800, rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } } } });
