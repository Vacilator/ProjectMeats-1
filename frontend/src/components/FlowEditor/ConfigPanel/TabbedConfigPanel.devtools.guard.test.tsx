import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./DynamicConfigPanel', () => ({
  DynamicConfigPanel: () => <div data-testid="dynamic-config" />,
}));

vi.mock('./VisualFormBuilderPanel', () => ({
  VisualFormBuilderPanel: () => <div data-testid="visual-form-builder" />,
}));

vi.mock('./LiveFormPreview', () => ({
  LiveFormPreview: () => <div data-testid="live-form-preview" />,
}));

vi.mock('./DeveloperJsonEditor', () => ({
  __esModule: true,
  default: () => <div>Developer JSON</div>,
}));

async function renderPanel() {
  vi.resetModules();
  const { TabbedConfigPanel } = await import('./TabbedConfigPanel');

  const node: any = {
    id: 'n1',
    type: 'action',
    data: { label: 'Test' },
    position: { x: 0, y: 0 },
  };

  render(
    <TabbedConfigPanel
      node={node}
      nodes={[node]}
      edges={[]}
      onUpdateNode={vi.fn()}
      onClose={vi.fn()}
    />
  );

  fireEvent.click(screen.getByText('Advanced'));
}

describe('TabbedConfigPanel devtools guardrails', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not render DeveloperJsonEditor in prod build even if localStorage enables devMode', async () => {
    window.localStorage.setItem('pm.floweditor.devMode', 'true');

    await renderPanel();

    expect(screen.queryByText('Developer Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Developer JSON')).not.toBeInTheDocument();
  });
});
