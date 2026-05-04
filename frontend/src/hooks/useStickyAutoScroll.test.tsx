import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStickyAutoScroll } from './useStickyAutoScroll';

const requestAnimationFrameSpy = vi
  .spyOn(window, 'requestAnimationFrame')
  .mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });

const cancelAnimationFrameSpy = vi
  .spyOn(window, 'cancelAnimationFrame')
  .mockImplementation(() => undefined);

const StickyScrollHarness: React.FC<{ count: number }> = ({ count }) => {
  const { containerRef } = useStickyAutoScroll<HTMLDivElement>([count]);

  return (
    <div ref={containerRef} data-testid="scroller">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>Message {index + 1}</div>
      ))}
    </div>
  );
};

describe('useStickyAutoScroll', () => {
  beforeEach(() => {
    requestAnimationFrameSpy.mockClear();
    cancelAnimationFrameSpy.mockClear();
  });

  it('keeps scrolling pinned when the user is already near the bottom', () => {
    const { rerender } = render(<StickyScrollHarness count={1} />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement & {
      scrollTo: ReturnType<typeof vi.fn>;
    };

    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 160 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 40 });
    scroller.scrollTo = vi.fn();

    act(() => {
      fireEvent.scroll(scroller);
    });

    rerender(<StickyScrollHarness count={2} />);

    expect(scroller.scrollTo).toHaveBeenCalled();
  });

  it('stops forcing scroll when the user has scrolled away from the bottom', () => {
    const { rerender } = render(<StickyScrollHarness count={1} />);
    const scroller = screen.getByTestId('scroller') as HTMLDivElement & {
      scrollTo: ReturnType<typeof vi.fn>;
    };

    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 320 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 40 });
    scroller.scrollTo = vi.fn();

    act(() => {
      fireEvent.scroll(scroller);
    });

    rerender(<StickyScrollHarness count={3} />);

    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });
});
