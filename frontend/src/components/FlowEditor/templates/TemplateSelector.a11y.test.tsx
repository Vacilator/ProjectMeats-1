import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { TemplateSelector } from './TemplateSelector';

describe('TemplateSelector a11y', () => {
  it('renders a dialog with an accessible name and focuses search input on open', async () => {
    const onClose = vi.fn();

    const opener = document.createElement('button');
    opener.textContent = 'Open Template Selector';
    document.body.appendChild(opener);
    opener.focus();

    render(
      <TemplateSelector
        isOpen
        onClose={onClose}
        onSelectTemplate={vi.fn()}
        onStartBlank={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /choose a template/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /search templates/i })).toHaveFocus();
    });

    // Cleanup
    opener.remove();
  });

  it('closes on Escape and restores focus to opener', async () => {
    const onClose = vi.fn();

    const opener = document.createElement('button');
    opener.textContent = 'Open Template Selector';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <TemplateSelector
        isOpen
        onClose={onClose}
        onSelectTemplate={vi.fn()}
        onStartBlank={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /choose a template/i });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();

    await waitFor(() => {
      expect(opener).toHaveFocus();
    });

    opener.remove();
  });
});
