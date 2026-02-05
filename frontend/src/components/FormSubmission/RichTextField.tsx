/**
 * Rich Text Field Component
 * A simple rich text editor with formatting toolbar
 */

import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';

const RichTextContainer = styled.div<{ $hasError?: boolean }>`
  border: 1px solid ${props => props.$hasError ? '#ef4444' : '#d1d5db'};
  border-radius: 8px;
  overflow: hidden;
  background: white;
  transition: border-color 0.2s ease;
  
  &:focus-within {
    border-color: ${props => props.$hasError ? '#ef4444' : '#3b82f6'};
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
`;

const ToolbarGroup = styled.div`
  display: flex;
  gap: 2px;
  
  &:not(:last-child)::after {
    content: '';
    width: 1px;
    background: #d1d5db;
    margin: 0 6px;
  }
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: ${props => props.$active ? '#e5e7eb' : 'transparent'};
  color: ${props => props.$active ? '#1f2937' : '#4b5563'};
  cursor: pointer;
  font-size: 14px;
  font-weight: ${props => props.$active ? '600' : '400'};
  transition: all 0.15s ease;
  
  &:hover {
    background: #e5e7eb;
    color: #1f2937;
  }
  
  &:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }
`;

const EditorArea = styled.div`
  min-height: 150px;
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  
  &:focus {
    outline: none;
  }
  
  &[contenteditable="true"]:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }
  
  /* Rich text styles */
  strong, b {
    font-weight: 600;
  }
  
  em, i {
    font-style: italic;
  }
  
  u {
    text-decoration: underline;
  }
  
  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }
  
  li {
    margin: 4px 0;
  }
  
  a {
    color: #3b82f6;
    text-decoration: underline;
  }
`;

const CharCount = styled.div`
  padding: 6px 12px;
  font-size: 12px;
  color: #9ca3af;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  text-align: right;
`;

interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  hasError?: boolean;
  ariaProps?: Record<string, any>;
}

export const RichTextField: React.FC<RichTextFieldProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  maxLength,
  disabled = false,
  hasError,
  ariaProps = {},
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
  }, []);

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('insertUnorderedList')) formats.add('ul');
    if (document.queryCommandState('insertOrderedList')) formats.add('ol');
    setActiveFormats(formats);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Clean up content
      const cleaned = html === '<br>' ? '' : html;
      onChange(cleaned);
    }
    updateActiveFormats();
  }, [onChange, updateActiveFormats]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
      }
    }
  }, [execCommand]);

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  }, [execCommand]);

  const getCharCount = () => {
    if (!editorRef.current) return 0;
    return editorRef.current.innerText.length;
  };

  return (
    <RichTextContainer $hasError={hasError}>
      <Toolbar role="toolbar" aria-label="Formatting options">
        <ToolbarGroup>
          <ToolbarButton
            type="button"
            $active={activeFormats.has('bold')}
            onClick={() => execCommand('bold')}
            title="Bold (Ctrl+B)"
            aria-pressed={activeFormats.has('bold')}
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            type="button"
            $active={activeFormats.has('italic')}
            onClick={() => execCommand('italic')}
            title="Italic (Ctrl+I)"
            aria-pressed={activeFormats.has('italic')}
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            type="button"
            $active={activeFormats.has('underline')}
            onClick={() => execCommand('underline')}
            title="Underline (Ctrl+U)"
            aria-pressed={activeFormats.has('underline')}
          >
            <u>U</u>
          </ToolbarButton>
        </ToolbarGroup>
        
        <ToolbarGroup>
          <ToolbarButton
            type="button"
            $active={activeFormats.has('ul')}
            onClick={() => execCommand('insertUnorderedList')}
            title="Bullet list"
            aria-pressed={activeFormats.has('ul')}
          >
            •
          </ToolbarButton>
          <ToolbarButton
            type="button"
            $active={activeFormats.has('ol')}
            onClick={() => execCommand('insertOrderedList')}
            title="Numbered list"
            aria-pressed={activeFormats.has('ol')}
          >
            1.
          </ToolbarButton>
        </ToolbarGroup>
        
        <ToolbarGroup>
          <ToolbarButton
            type="button"
            onClick={insertLink}
            title="Insert link"
          >
            🔗
          </ToolbarButton>
        </ToolbarGroup>
      </Toolbar>
      
      <EditorArea
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onSelect={updateActiveFormats}
        dangerouslySetInnerHTML={{ __html: value }}
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text editor"
        {...ariaProps}
      />
      
      {maxLength && (
        <CharCount>
          {getCharCount()} / {maxLength}
        </CharCount>
      )}
    </RichTextContainer>
  );
};

export default RichTextField;
