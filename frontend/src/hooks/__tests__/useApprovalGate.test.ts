import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/hooks/useAIPreferences', () => ({
  useAIPreferences: () => ({
    preferences: { require_external_approval: true },
    isLoading: false,
    updatePreferences: vi.fn(),
  }),
}));

vi.mock('@/services/aiService', () => ({
  approvalQueueApi: {
    create: vi.fn().mockResolvedValue({ data: { id: 'test-id', status: 'pending' } }),
  },
}));

describe('useApprovalGate', () => {
  it('exports a hook function', async () => {
    const mod = await import('../useApprovalGate');
    expect(mod.useApprovalGate).toBeDefined();
    expect(typeof mod.useApprovalGate).toBe('function');
  });
});
