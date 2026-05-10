import React, { useMemo, useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Modal as AntModal } from 'antd';
import { useLocation } from 'react-router-dom';
import { useCockpitNavigation } from '@/contexts/CockpitNavigationContext';
import { buildAIPageContext } from '@/services/aiContext';

interface OmniboxProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (command: string) => void;
}

const Omnibox: React.FC<OmniboxProps> = ({ isOpen, onClose, onSubmit }) => {
  const location = useLocation();
  const cockpitNav = useCockpitNavigation();

  const pageContext = useMemo(
    () => buildAIPageContext({ pathname: location.pathname, search: location.search }, cockpitNav.path),
    [location.pathname, location.search, cockpitNav.path]
  );

  const [command, setCommand] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleCommands = [
    'Create a purchase order for ABC Meats',
    'Show me supplier performance for this month',
    'Generate a customer report',
    'Set pricing rule for premium cuts',
    'Update inventory levels',
    'Send payment reminder to overdue customers',
    'Schedule delivery for order #12345',
    'Compare supplier prices for beef products',
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (command.length > 2) {
      const filtered = sampleCommands.filter((cmd) =>
        cmd.toLowerCase().includes(command.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
    setSelectedSuggestionIndex(-1);
  }, [command]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0) {
        handleSubmit(suggestions[selectedSuggestionIndex]);
      } else if (command.trim()) {
        handleSubmit(command);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSubmit = (commandToSubmit: string) => {
    // Always route Omnibox submissions into the global AI widget so it has
    // consistent auth/tenant behavior and can render streaming responses.
    window.dispatchEvent(new CustomEvent('pm:ai-toggle'));
    window.dispatchEvent(
      new CustomEvent('pm:ai-send', {
        detail: {
          message: commandToSubmit,
          context: {
            ui_source: 'Omnibox',
            ...pageContext,
            // Explicit active entity included for backend tool context (defense-in-depth)
            activeEntity: pageContext.activeEntity ?? null,
          },
        },
      })
    );

    // Backward-compatible callback (legacy behavior).
    onSubmit(commandToSubmit);

    setCommand('');
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    onClose();
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(suggestion);
  };

  return (
    <AntModal
      open={isOpen}
      onCancel={onClose}
      title="AI Command Center"
      footer={null}
      width={700}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <OmniboxContainer>
        <CommandInput
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your command (e.g., 'Create purchase order for ABC Meats')"
        />

        {suggestions.length > 0 && (
          <SuggestionsList>
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={suggestion}
                isSelected={index === selectedSuggestionIndex}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <SuggestionIcon>💡</SuggestionIcon>
                <SuggestionText>{suggestion}</SuggestionText>
              </SuggestionItem>
            ))}
          </SuggestionsList>
        )}

        <HelpText>
          <HelpTitle>🤖 AI Assistant Commands</HelpTitle>
          <HelpSection>
            <HelpSubtitle>Sample Commands:</HelpSubtitle>
            <HelpList>
              <HelpItem>"Create purchase order for [supplier name]"</HelpItem>
              <HelpItem>"Show supplier performance for [time period]"</HelpItem>
              <HelpItem>"Set pricing rule for [product type]"</HelpItem>
              <HelpItem>"Generate report for [entity type]"</HelpItem>
            </HelpList>
          </HelpSection>
          <TipText>💡 Tip: Use natural language - the AI will interpret your intent</TipText>
        </HelpText>
      </OmniboxContainer>
    </AntModal>
  );
};

const OmniboxContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const CommandInput = styled.input`
  width: 100%;
  padding: 16px 20px;
  border: 2px solid rgb(var(--color-border));
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  transition: border-color 0.2s;
  background: rgb(var(--color-surface-hover));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-info));
    background: rgb(var(--color-surface));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }

  &::placeholder {
    color: rgb(var(--color-text-muted));
  }
`;

const SuggestionsList = styled.div`
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  background: rgb(var(--color-surface));
  box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.1);
  overflow: hidden;
`;

const SuggestionItem = styled.div<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  background: ${(props) =>
    props.isSelected ? 'rgb(var(--color-primary) / 0.10)' : 'rgb(var(--color-surface))'};
  border-bottom: 1px solid rgb(var(--color-border));
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const SuggestionIcon = styled.span`
  font-size: 16px;
  opacity: 0.7;
`;

const SuggestionText = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const HelpText = styled.div`
  background: rgb(var(--color-surface-hover));
  border-radius: 8px;
  padding: 20px;
  margin-top: 10px;
`;

const HelpTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 18px;
  color: rgb(var(--color-text-primary));
`;

const HelpSection = styled.div`
  margin-bottom: 16px;
`;

const HelpSubtitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
`;

const HelpList = styled.ul`
  margin: 0;
  padding-left: 20px;
`;

const HelpItem = styled.li`
  font-size: 13px;
  color: rgb(var(--color-text-muted));
  margin-bottom: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const TipText = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-muted));
  font-style: italic;
  padding: 12px;
  background: rgba(var(--color-primary), 0.1);
  border-radius: 6px;
  border-left: 3px solid rgb(var(--color-info));
`;

export default Omnibox;
