/**
 * Lighthouse CI Configuration
 *
 * Performance budgets for critical pages.
 * Runs on PRs to prevent performance regressions.
 */
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',                    // Dashboard
        'http://localhost:3000/process-cockpit',     // Process Cockpit
        'http://localhost:3000/records/customer/1',  // Entity Detail
        'http://localhost:3000/workflow-editor',     // Workflow Editor
        'http://localhost:3000/templates',           // Template Library
      ],
      numberOfRuns: 3,
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.7 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'interactive': ['error', { maxNumericValue: 4000 }],
        'total-byte-weight': ['warn', { maxNumericValue: 512000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
