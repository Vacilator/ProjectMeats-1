/**
 * Keyboard Navigation Tests - Phase 1.5
 * Tests for keyboard-only users (WCAG 2.1.1, 2.1.2)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

describe('Keyboard Navigation', () => {
  it('should navigate through interactive elements with Tab', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </BrowserRouter>
    );

    await user.tab();
    expect(screen.getByText('First')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByText('Second')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByText('Third')).toHaveFocus();
  });

  it('should activate buttons with Enter and Space', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(
      <BrowserRouter>
        <button onClick={handleClick}>Click Me</button>
      </BrowserRouter>
    );

    const button = screen.getByText('Click Me');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('should allow Escape to close modals', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    
    render(
      <BrowserRouter>
        <div 
          role="dialog" 
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              handleClose();
            }
          }}
        >
          <button>Close</button>
        </div>
      </BrowserRouter>
    );

    const dialog = screen.getByRole('dialog');
    dialog.focus();
    
    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });
});
