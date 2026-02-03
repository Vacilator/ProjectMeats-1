/**
 * CommandBar Component
 * 
 * A search bar that integrates with the CommandPalette for universal search.
 * Shows keyboard shortcut hint and opens CommandPalette on focus/click.
 * 
 * Created: 2026-02-03 - Phase 4.2 Forms & Flows Enhancement
 * 
 * Features:
 * - Search input that opens CommandPalette on focus
 * - Keyboard shortcut hint (⌘K / Ctrl+K)
 * - Compact and expanded display modes
 * - Theme-compliant styling
 */
import React, { useCallback, useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Search, Command } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface CommandBarProps {
  /** Callback to open the CommandPalette */
  onOpenPalette: () => void;
  /** Whether the CommandPalette is currently open */
  isPaletteOpen?: boolean;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Compact mode shows just icon on mobile */
  compact?: boolean;
  /** Additional class name for styling */
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div<{ $compact?: boolean }>`
  position: relative;
  width: ${props => props.$compact ? 'auto' : '100%'};
  max-width: 400px;
`;

const SearchInputWrapper = styled.button<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: ${props => props.$compact ? '8px' : '10px 14px'};
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 10px);
  cursor: text;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary) / 0.5);
    background: rgb(var(--color-surface));
  }
  
  &:focus-within {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
    outline: none;
  }
`;

const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
  flex-shrink: 0;
`;

const SearchPlaceholder = styled.span<{ $compact?: boolean }>`
  flex: 1;
  text-align: left;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 640px) {
    display: ${props => props.$compact ? 'none' : 'block'};
  }
`;

const ShortcutBadge = styled.kbd`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  white-space: nowrap;
  
  @media (max-width: 640px) {
    display: none;
  }
`;

const CommandKey = styled.span`
  font-size: 13px;
  line-height: 1;
`;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Detect if user is on Mac for proper keyboard shortcut display
 */
const isMac = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform?.toLowerCase().includes('mac') || 
         navigator.userAgent?.toLowerCase().includes('mac');
};

// ============================================================================
// Component
// ============================================================================

export const CommandBar: React.FC<CommandBarProps> = ({
  onOpenPalette,
  isPaletteOpen = false,
  placeholder = 'Search anything...',
  compact = false,
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);
  const [showMacKey, setShowMacKey] = useState(true);

  // Detect platform on mount
  useEffect(() => {
    setShowMacKey(isMac());
  }, []);

  const handleClick = useCallback(() => {
    onOpenPalette();
  }, [onOpenPalette]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Enter or Space opens palette
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenPalette();
    }
  }, [onOpenPalette]);

  return (
    <Container $compact={compact} className={className}>
      <SearchInputWrapper
        ref={inputRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        $compact={compact}
        role="button"
        aria-label="Open search (press Command+K or Control+K)"
        aria-expanded={isPaletteOpen}
        aria-haspopup="dialog"
      >
        <SearchIcon>
          <Search size={18} />
        </SearchIcon>
        
        <SearchPlaceholder $compact={compact}>
          {placeholder}
        </SearchPlaceholder>
        
        <ShortcutBadge>
          {showMacKey ? (
            <>
              <CommandKey>⌘</CommandKey>
              <span>K</span>
            </>
          ) : (
            <>
              <span>Ctrl</span>
              <span>K</span>
            </>
          )}
        </ShortcutBadge>
      </SearchInputWrapper>
    </Container>
  );
};

export default CommandBar;
