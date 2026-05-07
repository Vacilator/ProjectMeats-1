import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { server } from './src/test/mocks/server';

// Global axios mock to prevent real XHR/network calls in tests (can cause hangs under JSDOM)
vi.mock('axios', () => {
  const createClient = () => ({
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  });

  const axiosDefault = {
    create: () => createClient(),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    isAxiosError: vi.fn(() => false),
  };

  class AxiosError extends Error {}

  return { default: axiosDefault, AxiosError };
});

// JSDOM doesn't implement pseudo-element styles (e.g. getComputedStyle(el, '::before'))
// Some UI libs call it defensively; ignore the pseudo-element argument in tests.
const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
  if (pseudoElt) {
    return originalGetComputedStyle(elt);
  }
  return originalGetComputedStyle(elt);
}) as any;

// Some components start polling/heartbeats in effects. If a test forgets to unmount a provider,
// these timers can keep the event loop alive and make Vitest hang.
const activeTimeoutIds = new Set<number>();
const activeIntervalIds = new Set<number>();

const originalSetTimeout = window.setTimeout.bind(window);
const originalClearTimeout = window.clearTimeout.bind(window);
const originalSetInterval = window.setInterval.bind(window);
const originalClearInterval = window.clearInterval.bind(window);

// Also track global timers (some code calls global setInterval directly)
const globalOriginalSetTimeout = globalThis.setTimeout.bind(globalThis);
const globalOriginalClearTimeout = globalThis.clearTimeout.bind(globalThis);
const globalOriginalSetInterval = globalThis.setInterval.bind(globalThis);
const globalOriginalClearInterval = globalThis.clearInterval.bind(globalThis);

const trackedSetTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const id = originalSetTimeout(handler, timeout as any, ...args);
  activeTimeoutIds.add(id as any);
  return id as any;
}) as any;

const trackedClearTimeout = ((id?: number) => {
  if (typeof id === 'number') {
    activeTimeoutIds.delete(id);
  }
  return originalClearTimeout(id as any);
}) as any;

const trackedSetInterval = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const id = originalSetInterval(handler, timeout as any, ...args);
  activeIntervalIds.add(id as any);
  return id as any;
}) as any;

const trackedClearInterval = ((id?: number) => {
  if (typeof id === 'number') {
    activeIntervalIds.delete(id);
  }
  return originalClearInterval(id as any);
}) as any;

window.setTimeout = trackedSetTimeout;
window.clearTimeout = trackedClearTimeout;
window.setInterval = trackedSetInterval;
window.clearInterval = trackedClearInterval;

// Mirror to global timers too
(globalThis as any).setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const id = globalOriginalSetTimeout(handler as any, timeout as any, ...args);
  activeTimeoutIds.add(id as any);
  return id as any;
}) as any;

(globalThis as any).clearTimeout = ((id?: number) => {
  if (typeof id === 'number') {
    activeTimeoutIds.delete(id);
  }
  return globalOriginalClearTimeout(id as any);
}) as any;

(globalThis as any).setInterval = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const id = globalOriginalSetInterval(handler as any, timeout as any, ...args);
  activeIntervalIds.add(id as any);
  return id as any;
}) as any;

(globalThis as any).clearInterval = ((id?: number) => {
  if (typeof id === 'number') {
    activeIntervalIds.delete(id);
  }
  return globalOriginalClearInterval(id as any);
}) as any;

// Polyfill matchMedia for AntD responsive hooks and theme preference checks
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as any;
}

// AntD/rc-* components can rely on ResizeObserver (not available in JSDOM)
if (!('ResizeObserver' in window)) {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  (window as any).ResizeObserver = ResizeObserver;
}

// Mock apiService to prevent real axios/XHR network calls (which can hang Vitest)
const apiServiceMock = vi.hoisted(() => {
  const createClient = () => ({
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  });

  return {
    apiClient: createClient(),
    adminClient: createClient(),
  };
});

// Some modules import via alias, others via relative path.
vi.mock('./src/services/apiService', () => apiServiceMock);
vi.mock('@/services/apiService', () => apiServiceMock);

// Cleanup after each test
afterEach(() => {
  for (const id of activeTimeoutIds) {
    originalClearTimeout(id);
  }
  activeTimeoutIds.clear();

  for (const id of activeIntervalIds) {
    originalClearInterval(id);
  }
  activeIntervalIds.clear();

  server.resetHandlers();
  cleanup();
});

// MSW lifecycle: start before all tests, close after all
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
