/**
 * SmartWizard Component
 * 
 * Guided action interface for the Cockpit - "What would you like to do today?"
 * Inspired by Typeform's conversational UI and HubSpot's activity prompts.
 * 
 * Features:
 * - Prominent search bar (reuses CommandBar)
 * - Action category grid with quick-start actions
 * - Dynamic quick actions from workflow forms
 * - Priority tasks display
 * - AI-powered suggestions (future)
 * 
 * Created: 2026-02-04 - Phase 1.2 Cockpit Enhancement
 */
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, CheckSquare, Zap, Plus, Edit, 
  BarChart3, FileText, Users, Package, 
  TrendingUp, Clock, AlertCircle, ArrowRight,
  Search
} from 'lucide-react';
import { CommandBar } from '../../components/Cockpit';
import { CommandPalette } from '../../components/Navigation/CommandPalette';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { useActionItems } from '../../contexts/ActionItemsContext';
import { useQuickActions } from '../../contexts/QuickActionsContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface ActionCategory {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  path?: string;
  onClick?: () => void;
}

interface QuickAction {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  min-height: calc(100vh - 180px);
  background: rgb(var(--color-background));
  padding: 32px 24px;
  
  @media (max-width: 640px) {
    padding: 24px 16px;
  }
`;

const WelcomeSection = styled.div`
  text-align: center;
  margin-bottom: 32px;
  animation: ${fadeIn} 0.4s ease;
`;

const Greeting = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px;
  
  @media (max-width: 640px) {
    font-size: 24px;
  }
`;

const Question = styled.h2`
  font-size: 18px;
  font-weight: 400;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const SearchSection = styled.div`
  max-width: 600px;
  margin: 0 auto 40px;
  animation: ${fadeIn} 0.4s ease 0.1s both;
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto 40px;
  animation: ${fadeIn} 0.4s ease 0.2s both;
`;

const ActionCard = styled.button<{ $color: string }>`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.$color};
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const ActionIcon = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md, 8px);
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  flex-shrink: 0;
`;

const ActionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px;
`;

const ActionDescription = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.4;
`;

const Section = styled.section`
  max-width: 1200px;
  margin: 0 auto 32px;
  animation: ${fadeIn} 0.4s ease 0.3s both;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionLink = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-primary));
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  
  &:hover {
    text-decoration: underline;
  }
`;

const QuickActionList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const QuickActionChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgb(var(--color-primary) / 0.1);
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

const TaskList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TaskItem = styled.button<{ $priority?: 'urgent' | 'high' | 'normal' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => props.$priority === 'urgent' && `
    border-left: 3px solid rgb(239, 68, 68);
  `}
  
  ${props => props.$priority === 'high' && `
    border-left: 3px solid rgb(234, 179, 8);
  `}
  
  &:hover {
    background: rgb(var(--color-background));
    border-color: rgb(var(--color-primary));
  }
`;

const TaskIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm, 4px);
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  flex-shrink: 0;
`;

const TaskContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const TaskName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const TaskMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const EmptyTasks = styled.div`
  padding: 24px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`;

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  min-width: 140px;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Constants
// ============================================================================

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    id: 'calls',
    icon: <Phone size={24} />,
    title: 'Make Call(s)',
    description: 'Quick dial customers or schedule callbacks',
    color: '#22c55e',
    path: '/calls',
  },
  {
    id: 'tasks',
    icon: <CheckSquare size={24} />,
    title: 'Complete My Tasks',
    description: 'View and complete your pending assignments',
    color: '#3b82f6',
    path: '/workforms/tasks',
  },
  {
    id: 'quick-actions',
    icon: <Zap size={24} />,
    title: 'Quick Actions',
    description: 'Run pre-configured workflow shortcuts',
    color: '#f59e0b',
  },
  {
    id: 'create',
    icon: <Plus size={24} />,
    title: 'Create New...',
    description: 'Start a new order, customer, or record',
    color: '#8b5cf6',
  },
  {
    id: 'update',
    icon: <Edit size={24} />,
    title: 'Update Existing...',
    description: 'Search and edit existing records',
    color: '#ec4899',
  },
  {
    id: 'reports',
    icon: <BarChart3 size={24} />,
    title: 'View Reports',
    description: 'Access analytics and performance data',
    color: '#06b6d4',
    path: '/reports',
  },
];

// ============================================================================
// Component
// ============================================================================

export const SmartWizard: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen: isPaletteOpen, open: openPalette, close: closePalette } = useCommandPalette();
  const { counts, items: actionItems } = useActionItems();
  const { forms: quickActionForms } = useQuickActions();
  
  // Get user's first name for greeting
  const [userName, setUserName] = useState<string>('');
  
  useEffect(() => {
    // Try to get user name from localStorage or context
    try {
      const userDataStr = localStorage.getItem('user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        const firstName = userData.first_name || userData.name?.split(' ')[0] || '';
        setUserName(firstName);
      }
    } catch {
      // Ignore errors
    }
  }, []);
  
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  
  // Handle action card click
  const handleActionClick = (action: ActionCategory) => {
    if (action.path) {
      navigate(action.path);
    } else if (action.onClick) {
      action.onClick();
    } else if (action.id === 'quick-actions' || action.id === 'create') {
      openPalette();
    }
  };
  
  // Get priority tasks (top 5)
  const priorityTasks = (actionItems || [])
    .filter(item => item.status !== 'completed')
    .slice(0, 5);
  
  // Get quick action forms (tenant-configured)
  const quickActions = quickActionForms?.slice(0, 6) || [];

  return (
    <Container>
      {/* Welcome Section */}
      <WelcomeSection>
        <Greeting>
          {getGreeting()}{userName ? `, ${userName}` : ''}! 👋
        </Greeting>
        <Question>What would you like to do today?</Question>
      </WelcomeSection>
      
      {/* Search Section */}
      <SearchSection>
        <SearchWrapper>
          <CommandBar 
            onOpenPalette={openPalette}
            isPaletteOpen={isPaletteOpen}
            placeholder="Search anything... (⌘K)"
          />
        </SearchWrapper>
      </SearchSection>
      
      {/* Command Palette Modal */}
      <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
      
      {/* Action Grid */}
      <ActionGrid>
        {ACTION_CATEGORIES.map((action) => (
          <ActionCard 
            key={action.id}
            $color={action.color}
            onClick={() => handleActionClick(action)}
          >
            <ActionIcon $color={action.color}>
              {action.icon}
            </ActionIcon>
            <ActionContent>
              <ActionTitle>{action.title}</ActionTitle>
              <ActionDescription>{action.description}</ActionDescription>
            </ActionContent>
          </ActionCard>
        ))}
      </ActionGrid>
      
      {/* Quick Stats */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <TrendingUp size={18} />
            Today's Overview
          </SectionTitle>
        </SectionHeader>
        <StatsRow>
          <StatCard>
            <div>
              <StatValue>{counts.total || 0}</StatValue>
              <StatLabel>Tasks Pending</StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <div>
              <StatValue style={{ color: counts.overdue > 0 ? 'rgb(239, 68, 68)' : undefined }}>
                {counts.overdue || 0}
              </StatValue>
              <StatLabel>Overdue</StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <div>
              <StatValue>{counts.due_today || 0}</StatValue>
              <StatLabel>Due Today</StatLabel>
            </div>
          </StatCard>
          <StatCard>
            <div>
              <StatValue>{counts.due_this_week || 0}</StatValue>
              <StatLabel>Due This Week</StatLabel>
            </div>
          </StatCard>
        </StatsRow>
      </Section>
      
      {/* Priority Tasks */}
      <Section>
        <SectionHeader>
          <SectionTitle>
            <AlertCircle size={18} />
            Priority Tasks
          </SectionTitle>
          <SectionLink onClick={() => navigate('/workforms/tasks')}>
            View All <ArrowRight size={14} />
          </SectionLink>
        </SectionHeader>
        <TaskList>
          {priorityTasks.length > 0 ? (
            priorityTasks.map((task) => (
              <TaskItem 
                key={task.id}
                $priority={task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : 'normal'}
                onClick={() => navigate(`/workforms/tasks`)}
              >
                <TaskIcon>
                  <FileText size={16} />
                </TaskIcon>
                <TaskContent>
                  <TaskName>{task.form_name || task.title || 'Task'}</TaskName>
                  <TaskMeta>
                    {task.current_step_name || 'Pending'} 
                    {task.due_date && ` • Due: ${new Date(task.due_date).toLocaleDateString()}`}
                  </TaskMeta>
                </TaskContent>
              </TaskItem>
            ))
          ) : (
            <EmptyTasks>
              <CheckSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>All caught up! No pending tasks.</div>
            </EmptyTasks>
          )}
        </TaskList>
      </Section>
      
      {/* Quick Actions (Tenant-Configured) */}
      {quickActions.length > 0 && (
        <Section>
          <SectionHeader>
            <SectionTitle>
              <Zap size={18} />
              Quick Actions
            </SectionTitle>
            <SectionLink onClick={() => navigate('/workforms/catalog')}>
              View All <ArrowRight size={14} />
            </SectionLink>
          </SectionHeader>
          <QuickActionList>
            {quickActions.map((action: QuickAction) => (
              <QuickActionChip 
                key={action.id}
                onClick={() => openPalette()}
              >
                {action.icon || '⚡'} {action.name}
              </QuickActionChip>
            ))}
          </QuickActionList>
        </Section>
      )}
    </Container>
  );
};

export default SmartWizard;
