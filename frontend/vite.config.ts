import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for React 19
      fastRefresh: true,
    }),
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
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: (chunkInfo) => {
          // Studio app gets its own entry
          if (chunkInfo.name === 'studio') {
            return 'studio/[name]-[hash].js';
          }
          return 'js/[name]-[hash].js';
        },
        manualChunks: {
          // Vendor chunk for React and related
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Vendor chunk for Ant Design
          'vendor-antd': ['antd', '@ant-design/icons'],
          // Vendor chunk for utilities
          'vendor-utils': ['axios', 'styled-components'],
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
    pool: 'forks', // Use forks instead of threads for stability
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
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
