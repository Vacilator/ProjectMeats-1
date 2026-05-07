/**
 * MSW Server Setup for Vitest
 *
 * Creates and exports the MSW server instance for use in test setup.
 * Import this in vitest setup file to enable API mocking globally.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
