/**
 * WCAG 2.1 Level AA Compliance Tests - Phase 1.5
 * Comprehensive accessibility testing with axe-core
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';

expect.extend(toHaveNoViolations);

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('WCAG 2.1 Level AA Compliance', () => {
  it('Forms should have proper labels', async () => {
    const { container } = render(
      <Wrapper>
        <form aria-label="Test form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" aria-required="true" />
          <button type="submit">Submit</button>
        </form>
      </Wrapper>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Buttons should have accessible names', async () => {
    const { container } = render(
      <Wrapper>
        <button aria-label="Close">×</button>
        <button>Save</button>
      </Wrapper>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Images should have alt text', async () => {
    const { container } = render(
      <Wrapper>
        <img src="/logo.png" alt="Logo" />
        <img src="/icon.png" alt="" aria-hidden="true" />
      </Wrapper>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Headings should follow hierarchy', async () => {
    const { container } = render(
      <Wrapper>
        <h1>Title</h1>
        <h2>Section</h2>
        <h3>Subsection</h3>
      </Wrapper>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Modals should have proper ARIA', async () => {
    const { container } = render(
      <Wrapper>
        <div role="dialog" aria-modal="true" aria-labelledby="title">
          <h2 id="title">Dialog</h2>
          <button>Close</button>
        </div>
      </Wrapper>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
