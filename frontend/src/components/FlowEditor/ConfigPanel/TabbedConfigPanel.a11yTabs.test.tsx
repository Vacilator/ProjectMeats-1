import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const MotionDiv = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    // Strip animation-only props so React doesn't warn about unknown DOM attrs.
    const { initial, animate, exit, transition, ...rest } = props;
    return <div ref={ref} {...rest} />;
  });

  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: MotionDiv,
    },
  };
});

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

describe('TabbedConfigPanel a11y tabs', () => {
  async function renderPanel(nodeType: string) {
    vi.resetModules();
    const { TabbedConfigPanel } = await import('./TabbedConfigPanel');

    const node: any = {
      id: 'n1',
      type: nodeType,
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

    return { node };
  }

  it('renders ARIA tablist/tabs and a tabpanel with stable data-testids', async () => {
    await renderPanel('form');

    const tablist = screen.getByRole('tablist', { name: 'Node configuration' });
    expect(tablist).toHaveAttribute('data-testid', 'flow-config-tablist');

    const general = screen.getByRole('tab', { name: 'General' });
    const fields = screen.getByRole('tab', { name: 'Fields' });
    const advanced = screen.getByRole('tab', { name: 'Advanced' });
    const preview = screen.getByRole('tab', { name: 'Preview' });

    expect(general).toHaveAttribute('data-testid', 'flow-config-tab-general');
    expect(fields).toHaveAttribute('data-testid', 'flow-config-tab-fields');
    expect(advanced).toHaveAttribute('data-testid', 'flow-config-tab-advanced');
    expect(preview).toHaveAttribute('data-testid', 'flow-config-tab-preview');

    expect(general).toHaveAttribute('aria-selected', 'true');
    expect(fields).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('data-testid', 'flow-config-tabpanel-general');

    const panelId = panel.getAttribute('id');
    expect(panelId).toBeTruthy();

    const tabId = general.getAttribute('id');
    expect(tabId).toBeTruthy();

    expect(general).toHaveAttribute('aria-controls', panelId as string);
    expect(panel).toHaveAttribute('aria-labelledby', tabId as string);
  });

  it('supports keyboard navigation: arrows move focus; Enter activates', async () => {
    await renderPanel('form');

    const general = screen.getByRole('tab', { name: 'General' });
    const fields = screen.getByRole('tab', { name: 'Fields' });

    general.focus();
    expect(general).toHaveFocus();
    expect(general).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(general, { key: 'ArrowRight' });
    expect(fields).toHaveFocus();
    // Manual activation: selection does not change on arrow
    expect(general).toHaveAttribute('aria-selected', 'true');
    expect(fields).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(fields, { key: 'Enter' });
    expect(fields).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByTestId('flow-config-tabpanel-fields')).toBeInTheDocument();
  });

  it('hides Fields/Preview for non-form nodes', async () => {
    await renderPanel('action');

    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Advanced' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Fields' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument();
  });
});
