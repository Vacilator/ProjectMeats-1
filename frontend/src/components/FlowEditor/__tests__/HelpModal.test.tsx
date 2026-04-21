import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { HelpModal } from '../HelpModal';

describe('HelpModal', () => {
  it('does not render when closed', () => {
    render(<HelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape when open', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click but not on modal click', () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen={true} onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement;
    expect(overlay).toBeTruthy();

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(0);

    fireEvent.click(overlay as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
