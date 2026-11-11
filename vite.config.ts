/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content-Security-Policy als <meta http-equiv> (GitHub Pages kann keine Header setzen).
 * Nur im Produktions-Build, damit der Dev-Server (HMR, Inline-Skripte von react-refresh) unberührt bleibt.
 * Das Inline-Skript in index.html (Theme vor dem ersten Rendern, verhindert Aufblitzen) wird
 * per SHA-256-Hash freigegeben statt über 'unsafe-inline'.
 */
function cspPlugin(): Plugin {
  const policy = (scriptHashes: string[]) =>
    [
      "default-src 'self'",
      `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
      // Kein <style> zur Laufzeit nötig (die App hat nur die gebaute CSS-Datei). `motion` setzt
      // Inline-style-Attribute (Animationen) – dafür genügt style-src-attr.
      "style-src 'self'",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com",
      "worker-src 'self' blob:",
      'frame-src https://login.microsoftonline.com',
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      // Trusted Types: DOM-XSS-Senken nur noch über die Default-Policy (src/security/trustedTypes.ts).
      "require-trusted-types-for 'script'",
    ].join('; ');

  return {
    name: 'mdm-doctor:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
        );
        const meta = `    <meta http-equiv="Content-Security-Policy" content="${policy(hashes)}" />\n`;
        // Möglichst früh im <head> (nach charset), damit die Richtlinie vor allen Ressourcen gilt.
        return html.replace(/(<meta charset=[^>]*>\s*\n)/i, `$1${meta}`);
      },
    },
  };
}

export default defineConfig({
  // Unterpfad-Hosting (GitHub Pages: /intune-device-doctor/); lokal und in Tests '/'.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), cspPlugin()],
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      output: {
        // Vendor-Bibliotheken getrennt cachebar; MSAL/Graph bleiben dank dynamischem Import
        // (src/app/lazyGraphProvider.ts, React.lazy in src/App.tsx) im Live-Chunk.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 2,
            },
            {
              name: 'motion',
              test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
              priority: 2,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // Tests unabhängig von einer lokalen .env.local (Live-Konfiguration) halten
    env: { VITE_APP_MODE: 'demo', VITE_MSAL_CLIENT_ID: '', VITE_MSAL_TENANT_ID: '' },
  },
});
