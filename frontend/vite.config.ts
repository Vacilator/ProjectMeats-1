import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
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
    },
  },
  
  // Build configuration
  build: {
    outDir: 'build',
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
          if (id.includes('/node_modules/axios/') || id.includes('/node_modules/styled-components/')) {
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
