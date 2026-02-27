import React from 'react';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from '../hooks';
import { supportedLanguages, languageNames, type SupportedLanguage } from '../config';
import styled from 'styled-components';

const LanguageSelectorWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const StyledSelect = styled(Select)`
  min-width: 120px;
`;

interface LanguageSelectorProps {
  className?: string;
  showIcon?: boolean;
}

/**
 * Language selector component for switching between supported languages.
 * 
 * Features:
 * - Dropdown with all supported languages
 * - Persists selection to localStorage
 * - Updates all UI elements reactively
 * - Optional globe icon
 * 
 * @example
 * <LanguageSelector />
 * <LanguageSelector showIcon={false} />
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
  showIcon = true,
}) => {
  const { currentLanguage, changeLanguage } = useTranslation();

  const handleChange = (value: SupportedLanguage) => {
    changeLanguage(value);
  };

  const options = supportedLanguages.map((lang) => ({
    value: lang,
    label: languageNames[lang],
  }));

  return (
    <LanguageSelectorWrapper className={className}>
      {showIcon && <GlobalOutlined />}
      <StyledSelect
        value={currentLanguage}
        onChange={handleChange}
        options={options}
        aria-label="Select language"
      />
    </LanguageSelectorWrapper>
  );
};
