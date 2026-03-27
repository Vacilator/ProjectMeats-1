/**
 * IconPicker Component
 * 
 * A visual icon picker for selecting icons from the available Lucide icon set.
 * Supports search, categories, and keyboard navigation.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import styled from 'styled-components';
import Icon, { AVAILABLE_ICONS, ICON_CATEGORIES } from './Icon';

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
  disabled?: boolean;
}

const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  label,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when opened
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    return AVAILABLE_ICONS.filter(icon => {
      const matchesSearch = !searchQuery || 
        icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        icon.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || icon.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Group icons by category for display
  const iconsByCategory = useMemo(() => {
    const grouped: Record<string, typeof AVAILABLE_ICONS> = {};
    filteredIcons.forEach(icon => {
      if (!grouped[icon.category]) {
        grouped[icon.category] = [];
      }
      grouped[icon.category].push(icon);
    });
    return grouped;
  }, [filteredIcons]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedCategory(null);
  };

  // Get display value
  const currentIcon = AVAILABLE_ICONS.find(i => i.name === value);
  const displayLabel = currentIcon?.label || value || 'Select icon';

  return (
    <Container ref={containerRef}>
      {label && <Label>{label}</Label>}
      
      <Trigger 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        $disabled={disabled}
        $isOpen={isOpen}
      >
        <IconPreview>
          <Icon name={value || 'file-text'} size={20} />
        </IconPreview>
        <TriggerLabel>{displayLabel}</TriggerLabel>
        <ChevronIcon $isOpen={isOpen}>
          <Icon name="chevron-down" size={16} />
        </ChevronIcon>
      </Trigger>

      {isOpen && (
        <Dropdown>
          {/* Search */}
          <SearchSection>
            <SearchInput
              ref={searchInputRef}
              type="text"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchSection>

          {/* Category Tabs */}
          <CategoryTabs>
            <CategoryTab
              $active={!selectedCategory}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </CategoryTab>
            {ICON_CATEGORIES.map(cat => (
              <CategoryTab
                key={cat.id}
                $active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                title={cat.label}
              >
                {cat.label.split(' ')[0]}
              </CategoryTab>
            ))}
          </CategoryTabs>

          {/* Icon Grid */}
          <IconGrid>
            {Object.entries(iconsByCategory).map(([category, icons]) => (
              <CategorySection key={category}>
                <CategoryHeader>
                  {ICON_CATEGORIES.find(c => c.id === category)?.label || category}
                </CategoryHeader>
                <IconList>
                  {icons.map(icon => (
                    <IconButton
                      key={icon.name}
                      $selected={value === icon.name}
                      onClick={() => handleSelect(icon.name)}
                      title={icon.label}
                    >
                      <Icon name={icon.name} size={20} />
                    </IconButton>
                  ))}
                </IconList>
              </CategorySection>
            ))}
            
            {filteredIcons.length === 0 && (
              <EmptyState>No icons found matching "{searchQuery}"</EmptyState>
            )}
          </IconGrid>
        </Dropdown>
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  position: relative;
  width: 100%;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 6px;
`;

const Trigger = styled.button<{ $disabled: boolean; $isOpen: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: ${p => p.$disabled ? 'rgb(var(--color-surface-hover))' : 'white'};
  border: 1px solid ${p => p.$isOpen ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: 8px;
  cursor: ${p => p.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  
  &:hover {
    border-color: ${p => !p.$disabled && 'rgb(var(--color-primary))'};
  }
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const IconPreview = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgb(var(--color-surface-hover));
  border-radius: 6px;
  color: rgb(var(--color-text-secondary));
`;

const TriggerLabel = styled.span`
  flex: 1;
  text-align: left;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const ChevronIcon = styled.span<{ $isOpen: boolean }>`
  color: rgb(var(--color-text-muted));
  transition: transform 0.2s;
  transform: ${p => p.$isOpen ? 'rotate(180deg)' : 'rotate(0)'};
  display: flex;
  align-items: center;
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid rgb(var(--color-border));
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SearchSection = styled.div`
  padding: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-muted));
  }
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgb(var(--color-border));
  overflow-x: auto;
  flex-shrink: 0;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgb(var(--color-surface-hover));
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgb(var(--color-border));
    border-radius: 2px;
  }
`;

const CategoryTab = styled.button<{ $active: boolean }>`
  padding: 6px 10px;
  background: ${p => p.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${p => p.$active ? 'white' : 'rgb(var(--color-text-muted))'};
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  
  &:hover {
    background: ${p => p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface-hover))'};
  }
`;

const IconGrid = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
`;

const CategorySection = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const CategoryHeader = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-muted));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-left: 4px;
`;

const IconList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 6px;
`;

const IconButton = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${p => p.$selected ? 'rgb(var(--color-primary))' : 'transparent'};
  background: ${p => p.$selected ? 'rgba(var(--color-primary), 0.10)' : 'transparent'};
  border-radius: 6px;
  color: ${p => p.$selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  transition: all 0.15s;
  
  &:hover {
    background: ${p => p.$selected ? 'rgba(var(--color-primary), 0.10)' : 'rgb(var(--color-surface-hover))'};
    border-color: ${p => p.$selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px;
  color: rgb(var(--color-text-muted));
  font-size: 14px;
`;

export default IconPicker;
