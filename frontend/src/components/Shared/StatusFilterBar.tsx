import React from 'react';
import styled from 'styled-components';

export interface StatusTab {
  key: string;
  label: string;
}

interface StatusFilterBarProps {
  tabs: StatusTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  searchText: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
}

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const TabGroup = styled.div`
  display: flex;
  gap: 4px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))')};
  background: ${({ $active }) => ($active ? 'rgb(var(--color-primary))' : 'transparent')};
  color: ${({ $active }) => ($active ? '#fff' : 'rgb(var(--color-text-primary))')};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    opacity: 0.85;
  }
`;

const SearchInput = styled.input`
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 13px;
  width: 220px;
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const StatusFilterBar: React.FC<StatusFilterBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  searchText,
  onSearchChange,
  searchPlaceholder = 'Search…',
}) => (
  <FilterBar>
    <TabGroup>
      {tabs.map((tab) => (
        <Tab key={tab.key} $active={activeTab === tab.key} onClick={() => onTabChange(tab.key)}>
          {tab.label}
        </Tab>
      ))}
    </TabGroup>
    <SearchInput
      placeholder={searchPlaceholder}
      value={searchText}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  </FilterBar>
);

export default StatusFilterBar;
