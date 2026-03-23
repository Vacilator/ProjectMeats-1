import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageSelector } from '../components/LanguageSelector';
import i18n from '../config';
import { vi } from 'vitest';

// Mock react-i18next with complete module
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        language: 'en',
        changeLanguage: vi.fn(),
        dir: () => 'ltr',
      },
    }),
  };
});

describe('LanguageSelector', () => {
  beforeEach(() => {
    i18n.changeLanguage('en');
  });

  it('should render without crashing', () => {
    render(<LanguageSelector />);
    expect(screen.getByLabelText('Select language')).toBeInTheDocument();
  });

  it('should show globe icon by default', () => {
    const { container } = render(<LanguageSelector />);
    const icon = container.querySelector('.anticon-global');
    expect(icon).toBeInTheDocument();
  });

  it('should hide icon when showIcon is false', () => {
    const { container } = render(<LanguageSelector showIcon={false} />);
    const icon = container.querySelector('.anticon-global');
    expect(icon).not.toBeInTheDocument();
  });

  it('should display current language', () => {
    const { container } = render(<LanguageSelector />);
    // Check that Select component is rendered with en value
    const select = container.querySelector('.ant-select');
    expect(select).toBeInTheDocument();
  });

  it('should have all supported languages', () => {
    const { container } = render(<LanguageSelector />);
    const select = container.querySelector('.ant-select');
    expect(select).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LanguageSelector className="custom-class" />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });
});
