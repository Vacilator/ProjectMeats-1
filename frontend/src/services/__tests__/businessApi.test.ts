import { describe, it, expect } from 'vitest';

// Test that businessApi exports the expected interface
describe('businessApi', () => {
  it('exports businessApi with standard HTTP methods', async () => {
    const { businessApi } = await import('../businessApi');
    expect(businessApi).toBeDefined();
    expect(typeof businessApi.get).toBe('function');
    expect(typeof businessApi.post).toBe('function');
    expect(typeof businessApi.put).toBe('function');
    expect(typeof businessApi.delete).toBe('function');
  });
});
