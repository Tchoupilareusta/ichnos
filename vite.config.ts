import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { estCleSecrete } from './src/supabase/clePublique.ts'

// Le site est publié sur https://tchoupilareusta.github.io/ichnos/
const BASE = '/ichnos/'

export default defineConfig(({ mode }) => {
  // Garde-fou : la compilation s'arrête si une clé secrète Supabase a été mise à la place de la clé publique.
  if (estCleSecrete(loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY contient une clé secrète. Seule la clé publique (sb_publishable_…) peut entrer dans l’appli.',
    )
  }

  return {
    base: BASE,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // L'appli installée prend la nouvelle version d'elle-même, sans manipulation.
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: BASE,
          name: 'Ichnos',
          short_name: 'Ichnos',
          description: 'Ma bibliothèque personnelle de lecture.',
          lang: 'fr',
          dir: 'ltr',
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          orientation: 'any',
          background_color: '#F5EFE6',
          theme_color: '#F5EFE6',
          icons: [
            { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      css: false,
    },
  }
})
