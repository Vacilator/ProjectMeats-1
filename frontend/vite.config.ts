import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Enable importing SVGs as React components
    svgr(),
    // Enable tsconfig path mapping
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'favicon-dev.svg',
        'favicon-prod.svg',
        'favicon-uat.svg',
      ],
      manifest: {
        id: '/',
        name: 'Meats Central',
        short_name: 'Meats Central',
        description: 'AI-powered meat market operations management',
        theme_color: '#DC2626',
        background_color: '#FFFFFF',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon-prod.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/media\//, /^\/static\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['env-config.js', 'js/UnifiedFlowEditor-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/env-config.js',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'runtime-config',
              networkTimeoutSeconds: 2,
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API requests to Django backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  // Build configuration
  build: {
    outDir: 'build',
    manifest: true,
    sourcemap: true,
    // Split chunks for better caching
    rollupOptions: {
      input: {
        // Main app entry point
        main: path.resolve(__dirname, 'index.html'),
        // Admin Studio entry point for Django integration
        studio: path.resolve(__dirname, 'studio.html'),
      },
      output: {
        // Different output directories for different apps
        assetFileNames: (assetInfo) => {
          // Vite 8/Rolldown can pass assets without a stable name; guard accordingly.
          const name = assetInfo.name ?? '';
          if (name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: (chunkInfo) => {
          // Studio app gets its own entry
          if (chunkInfo.name === 'studio') {
            return 'studio/[name]-[hash].js';
          }
          return 'js/[name]-[hash].js';
        },
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;

          // Keep chunking stable across builds while avoiding Rolldown's object-form restriction.
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/antd/') || id.includes('/node_modules/@ant-design/')) {
            return 'vendor-antd';
          }
          if (
            id.includes('/node_modules/axios/') ||
            id.includes('/node_modules/styled-components/')
          ) {
            return 'vendor-utils';
          }

          return;
        },
      },
    },
  },

  // Define environment variable prefix
  envPrefix: 'VITE_',

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      'axios',
      'styled-components',
    ],
  },

  // Preview server configuration (for production build preview)
  preview: {
    port: 3000,
    open: true,
  },

  // Test configuration for Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: true,
    // Prevent any individual test from hanging forever (was previously unbounded).
    testTimeout: 15000,
    hookTimeout: 10000,
    // E2E specs are Playwright tests and must not be collected by Vitest.
    // NOTE: Setting exclude overrides Vitest defaults; keep the standard exclusions.
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'e2e/**',
      // Quarantine: this spec currently hangs under Vitest/JSDOM (tracked separately)
      'src/components/FlowEditor/__tests__/UnifiedFlowEditor.integration.test.tsx',
    ],
    pool: 'forks', // Use forks instead of threads for stability
    // Coverage + parallel file execution can intermittently miss V8 coverage shard files.
    // Disable file-level parallelism for deterministic CI runs.
    fileParallelism: false,
    passWithNoTests: true,
    bail: 1, // Stop on first failure for faster feedback
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/stories/',
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.test.ts',
      ],
    },
  },
});
