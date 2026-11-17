import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Baut eine einzelne HTML-Datei (dist-standalone/index.html) ohne Server:
// Daten im Browser-Speicher statt in SQLite, Hash-Routing für file://.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('1') },
  resolve: {
    alias: [{ find: /^(\.\.?\/)+api\/client$/, replacement: path.resolve(__dirname, 'src/api/local.ts') }],
  },
  build: { outDir: 'dist-standalone', emptyOutDir: true },
});
