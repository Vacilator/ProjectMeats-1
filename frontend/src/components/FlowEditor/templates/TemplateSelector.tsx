/**
 * Template Selector Modal
 * 
 * Netflix-style template browsing UI for workflow templates
 * Phase 2.5 - Templates Library
 * Created: 2026-02-04
 */

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { X, Search, Star, Clock, Zap } from 'lucide-react';
import { 
  FLOW_TEMPLATES, 
  FlowTemplate, 
  TemplateCategory,
  TemplateDifficulty,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getPopularTemplates,
  getFeaturedTemplate,
  searchTemplates,
  getTemplatesByCategory
} from './flowTemplates';

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-overlay), 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface));
  border-radius: 12px;
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(var(--color-overlay), 0.3);
`;

const Header = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background: rgb(var(--color-surface));
  }
`;

const SearchContainer = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SearchBar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 12px;
  color: rgb(var(--color-text-secondary));
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  font-size: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const TemplateCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.1);
  }
`;

const TemplateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const TemplateThumbnail = styled.div`
  font-size: 32px;
  line-height: 1;
`;

const DifficultyBadge = styled.span<{ $difficulty: TemplateDifficulty }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.$difficulty) {
      case 'beginner': return 'rgb(34 197 94 / 0.1)';
      case 'intermediate': return 'rgb(234 179 8 / 0.1)';
      case 'advanced': return 'rgb(239 68 68 / 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$difficulty) {
      case 'beginner': return 'rgb(34 197 94)';
      case 'intermediate': return 'rgb(234 179 8)';
      case 'advanced': return 'rgb(239 68 68)';
    }
  }};
`;

const TemplateName = styled.h4`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const TemplateDescription = styled.p`
  margin: 0 0 12px 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.5;
`;

const TemplateFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid rgb(var(--color-border));
`;

const TemplateInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const InfoItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyStateText = styled.p`
  margin: 0;
  font-size: 16px;
`;

const StartBlankButton = styled.button`
  background: rgb(var(--color-surface));
  border: 2px dashed rgb(var(--color-border));
  border-radius: 8px;
  padding: 32px;
  width: 100%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-background));
  }
`;

const StartBlankIcon = styled.div`
  font-size: 48px;
`;

const StartBlankText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const StartBlankSubtext = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Component
// ============================================================================

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: FlowTemplate) => void;
  onStartBlank: () => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onStartBlank,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Get templates
  const featuredTemplate = useMemo(() => getFeaturedTemplate(), []);
  const popularTemplates = useMemo(() => getPopularTemplates(5), []);

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return null; // Show categories when no search
    }
    return searchTemplates(searchQuery);
  }, [searchQuery]);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const categories: TemplateCategory[] = ['forms', 'approvals', 'onboarding', 'orders', 'documents'];
    return categories.map(category => ({
      category,
      templates: getTemplatesByCategory(category),
    })).filter(group => group.templates.length > 0);
  }, []);

  if (!isOpen) return null;

  const handleTemplateClick = (template: FlowTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  const handleBlankClick = () => {
    onStartBlank();
    onClose();
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Choose a Template</Title>
          <CloseButton onClick={onClose}>
            <X size={24} />
          </CloseButton>
        </Header>

        <SearchContainer>
          <SearchBar>
            <SearchIcon size={18} />
            <SearchInput
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchBar>
        </SearchContainer>

        <Content>
          {/* Start from Scratch Option */}
          <Section>
            <StartBlankButton onClick={handleBlankClick}>
              <StartBlankIcon>✨</StartBlankIcon>
              <StartBlankText>Start from Scratch</StartBlankText>
              <StartBlankSubtext>Build a custom workflow from the ground up</StartBlankSubtext>
            </StartBlankButton>
          </Section>

          {/* Search Results */}
          {filteredTemplates !== null ? (
            <Section>
              <SectionHeader>
                <SectionTitle>
                  Search Results ({filteredTemplates.length})
                </SectionTitle>
              </SectionHeader>
              {filteredTemplates.length > 0 ? (
                <TemplateGrid>
                  {filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} onClick={() => handleTemplateClick(template)}>
                      <TemplateHeader>
                        <TemplateThumbnail>{template.thumbnail}</TemplateThumbnail>
                        <DifficultyBadge $difficulty={template.difficulty}>
                          {template.difficulty}
                        </DifficultyBadge>
                      </TemplateHeader>
                      <TemplateName>{template.name}</TemplateName>
                      <TemplateDescription>{template.description}</TemplateDescription>
                      <TemplateFooter>
                        <TemplateInfo>
                          <InfoItem>
                            <Clock size={12} />
                            {template.estimatedSetupTime}
                          </InfoItem>
                          <InfoItem>
                            <Star size={12} />
                            {template.popularity}
                          </InfoItem>
                        </TemplateInfo>
                      </TemplateFooter>
                    </TemplateCard>
                  ))}
                </TemplateGrid>
              ) : (
                <EmptyState>
                  <EmptyStateIcon>🔍</EmptyStateIcon>
                  <EmptyStateText>No templates found for "{searchQuery}"</EmptyStateText>
                </EmptyState>
              )}
            </Section>
          ) : (
            <>
              {/* Featured Template */}
              <Section>
                <SectionHeader>
                  <SectionTitle>
                    <Zap size={20} />
                    Featured Template
                  </SectionTitle>
                </SectionHeader>
                <TemplateGrid>
                  <TemplateCard onClick={() => handleTemplateClick(featuredTemplate)}>
                    <TemplateHeader>
                      <TemplateThumbnail>{featuredTemplate.thumbnail}</TemplateThumbnail>
                      <DifficultyBadge $difficulty={featuredTemplate.difficulty}>
                        {featuredTemplate.difficulty}
                      </DifficultyBadge>
                    </TemplateHeader>
                    <TemplateName>{featuredTemplate.name}</TemplateName>
                    <TemplateDescription>{featuredTemplate.description}</TemplateDescription>
                    <TemplateFooter>
                      <TemplateInfo>
                        <InfoItem>
                          <Clock size={12} />
                          {featuredTemplate.estimatedSetupTime}
                        </InfoItem>
                        <InfoItem>
                          <Star size={12} />
                          {featuredTemplate.popularity}
                        </InfoItem>
                      </TemplateInfo>
                    </TemplateFooter>
                  </TemplateCard>
                </TemplateGrid>
              </Section>

              {/* Popular Templates */}
              <Section>
                <SectionHeader>
                  <SectionTitle>
                    <Star size={20} />
                    Most Popular
                  </SectionTitle>
                </SectionHeader>
                <TemplateGrid>
                  {popularTemplates.map((template) => (
                    <TemplateCard key={template.id} onClick={() => handleTemplateClick(template)}>
                      <TemplateHeader>
                        <TemplateThumbnail>{template.thumbnail}</TemplateThumbnail>
                        <DifficultyBadge $difficulty={template.difficulty}>
                          {template.difficulty}
                        </DifficultyBadge>
                      </TemplateHeader>
                      <TemplateName>{template.name}</TemplateName>
                      <TemplateDescription>{template.description}</TemplateDescription>
                      <TemplateFooter>
                        <TemplateInfo>
                          <InfoItem>
                            <Clock size={12} />
                            {template.estimatedSetupTime}
                          </InfoItem>
                          <InfoItem>
                            <Star size={12} />
                            {template.popularity}
                          </InfoItem>
                        </TemplateInfo>
                      </TemplateFooter>
                    </TemplateCard>
                  ))}
                </TemplateGrid>
              </Section>

              {/* Templates by Category */}
              {templatesByCategory.map(({ category, templates }) => (
                <Section key={category}>
                  <SectionHeader>
                    <SectionTitle>
                      {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
                    </SectionTitle>
                  </SectionHeader>
                  <TemplateGrid>
                    {templates.map((template) => (
                      <TemplateCard key={template.id} onClick={() => handleTemplateClick(template)}>
                        <TemplateHeader>
                          <TemplateThumbnail>{template.thumbnail}</TemplateThumbnail>
                          <DifficultyBadge $difficulty={template.difficulty}>
                            {template.difficulty}
                          </DifficultyBadge>
                        </TemplateHeader>
                        <TemplateName>{template.name}</TemplateName>
                        <TemplateDescription>{template.description}</TemplateDescription>
                        <TemplateFooter>
                          <TemplateInfo>
                            <InfoItem>
                              <Clock size={12} />
                              {template.estimatedSetupTime}
                            </InfoItem>
                            <InfoItem>
                              <Star size={12} />
                              {template.popularity}
                            </InfoItem>
                          </TemplateInfo>
                        </TemplateFooter>
                      </TemplateCard>
                    ))}
                  </TemplateGrid>
                </Section>
              ))}
            </>
          )}
        </Content>
      </Modal>
    </Overlay>
  );
};
