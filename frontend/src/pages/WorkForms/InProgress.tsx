/**
 * Forms & Flows In Progress Page
 * 
 * View and manage active form submissions.
 * Implements Phase 1 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * Updated: Phase 5 - Added real-time polling and cancel functionality
 * 
 * Features:
 * - Card grid of active submissions
 * - Progress indicators
 * - Quick resume action
 * - Filter by form type
 * - Real-time updates (10-second polling)
 * - Cancel workflow with confirmation
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Play, Clock, Filter, RefreshCw, FileText, X } from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import { WorkflowExecution } from '../../types/workflows';

// ============================================================================
// Types
// ============================================================================

interface FormSubmission {
  id: string;
  form_name: string;
  form_icon?: string;
  status: string;
  current_step: number;
  total_steps: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div``;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
  
  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  
  @media (max-width: 640px) {
    width: 100%;
  }
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  width: 280px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
  
  @media (max-width: 640px) {
    width: 100%;
    flex: 1;
  }
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-text-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 640px) {
    position: absolute;
    right: 0;
    top: 0;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const CardIcon = styled.div`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary) / 0.1);
  font-size: 22px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  background: ${({ $status }) => 
    $status === 'in_progress' ? 'rgb(59, 130, 246, 0.1)' :
    $status === 'draft' ? 'rgb(var(--color-text-tertiary) / 0.1)' :
    'rgb(234, 179, 8, 0.1)'
  };
  color: ${({ $status }) => 
    $status === 'in_progress' ? 'rgb(59, 130, 246)' :
    $status === 'draft' ? 'rgb(var(--color-text-secondary))' :
    'rgb(234, 179, 8)'
  };
`;

const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px;
`;

const CardMeta = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 16px;
`;

const ProgressBar = styled.div`
  height: 6px;
  background: rgb(var(--color-border));
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: rgb(var(--color-primary));
  border-radius: 3px;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-bottom: 16px;
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ResumeButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-primary));
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: rgb(var(--color-text-tertiary));
`;

const EmptyIcon = styled.div`
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px;
`;

const EmptyMessage = styled.p`
  margin: 0;
  font-size: 14px;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgb(var(--color-text-secondary));
`;

const LastUpdated = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-left: 8px;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
  }
`;

const CancelButton = styled.button`
  padding: 10px 16px;
  background: transparent;
  color: rgb(239, 68, 68);
  border: 1px solid rgb(239, 68, 68);
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Modal = styled.div<{ $isOpen: boolean }>`
  display: ${({ $isOpen }) => $isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  max-width: 400px;
  width: 90%;
`;

const ModalTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 12px;
`;

const ModalText = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 20px;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const ModalButton = styled.button<{ $variant?: 'danger' }>`
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
  
  background: ${({ $variant }) => 
    $variant === 'danger' ? 'rgb(239, 68, 68)' : 'rgb(var(--color-border))'
  };
  color: ${({ $variant }) => 
    $variant === 'danger' ? 'white' : 'rgb(var(--color-text-primary))'
  };
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsInProgress: React.FC = () => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'team'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const { resumeSubmission } = useQuickActions();
  
  // Fetch in-progress submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params: any = { status: 'in_progress,draft' };
      
      // Apply filter mode
      if (filterMode === 'my') {
        params.assigned_to = 'me';
      }
      
      const response = await apiClient.get('/workflows/form-submissions/', { params });
      setSubmissions(response.data.results || response.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchSubmissions();
  }, [filterMode]);
  
  // Real-time polling (10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubmissions();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [filterMode]);
  
  // Handle cancel confirmation
  const handleCancelClick = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setShowCancelModal(true);
  };
  
  // Handle cancel workflow
  const handleCancelConfirm = async () => {
    if (!selectedSubmission) return;
    
    setCancelingId(selectedSubmission.id);
    try {
      await workflowExecutionService.cancelExecution(selectedSubmission.id, {
        reason: 'Cancelled by user',
      });
      
      // Update UI immediately
      setSubmissions(prev => prev.filter(s => s.id !== selectedSubmission.id));
      setShowCancelModal(false);
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      alert('Failed to cancel workflow. Please try again.');
    } finally {
      setCancelingId(null);
    }
  };
  
  // Filter submissions by search query
  const filteredSubmissions = submissions.filter(sub =>
    sub.form_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle resume action
  const handleResume = (submission: FormSubmission) => {
    resumeSubmission(submission.id);
  };
  
  // Format relative time
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <Container role="region" aria-label="In Progress Forms">
      <Toolbar>
        <ToolbarLeft>
          <SearchInput
            type="search"
            placeholder="Search in-progress forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search in-progress forms"
          />
          <FilterSelect
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            aria-label="Filter workflows"
          >
            <option value="all">All Workflows</option>
            <option value="my">My Workflows</option>
            <option value="team">Team Workflows</option>
          </FilterSelect>
        </ToolbarLeft>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LastUpdated>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </LastUpdated>
          <RefreshButton 
            onClick={fetchSubmissions} 
            disabled={loading}
            aria-label={loading ? 'Loading...' : 'Refresh list'}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </RefreshButton>
        </div>
      </Toolbar>
      
      {loading ? (
        <LoadingState role="status" aria-live="polite">Loading submissions...</LoadingState>
      ) : filteredSubmissions.length === 0 ? (
        <EmptyState role="status" aria-live="polite">
          <EmptyIcon aria-hidden="true">
            <Clock size={48} />
          </EmptyIcon>
          <EmptyTitle>No forms in progress</EmptyTitle>
          <EmptyMessage>
            {searchQuery 
              ? 'No matching forms found. Try a different search term.'
              : 'You have no active form submissions or workflow executions running right now. Start a new one from the Catalog.'}
          </EmptyMessage>
        </EmptyState>
      ) : (
        <CardGrid role="list" aria-label={`${filteredSubmissions.length} forms in progress`}>
          {filteredSubmissions.map((submission) => {
            const progress = submission.total_steps > 0 
              ? Math.round((submission.current_step / submission.total_steps) * 100)
              : 0;
            
            return (
              <Card key={submission.id} role="listitem" aria-label={`${submission.form_name}, ${progress}% complete`}>
                <CardHeader>
                  <CardIcon aria-hidden="true">
                    {submission.form_icon || <FileText size={22} />}
                  </CardIcon>
                  <StatusBadge $status={submission.status}>
                    <Clock size={12} aria-hidden="true" />
                    {submission.status === 'in_progress' ? 'In Progress' : 'Draft'}
                  </StatusBadge>
                </CardHeader>
                
                <CardTitle>{submission.form_name}</CardTitle>
                <CardMeta>
                  Updated {formatTimeAgo(submission.updated_at)}
                  {submission.created_by_name && ` • By ${submission.created_by_name}`}
                </CardMeta>
                
                <ProgressBar role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress: ${progress}%`}>
                  <ProgressFill $percent={progress} />
                </ProgressBar>
                <ProgressText>
                  <span>Step {submission.current_step} of {submission.total_steps}</span>
                  <span>{progress}% complete</span>
                </ProgressText>
                
                <CardActions>
                  <ResumeButton 
                    onClick={() => handleResume(submission)}
                    aria-label={`Resume ${submission.form_name}`}
                  >
                    <Play size={16} aria-hidden="true" />
                    Resume
                  </ResumeButton>
                  <CancelButton
                    onClick={() => handleCancelClick(submission)}
                    aria-label={`Cancel ${submission.form_name}`}
                  >
                    <X size={16} />
                  </CancelButton>
                </CardActions>
              </Card>
            );
          })}
        </CardGrid>
      )}
      
      {/* Cancel Confirmation Modal */}
      <Modal $isOpen={showCancelModal} onClick={() => setShowCancelModal(false)}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalTitle>Cancel Workflow?</ModalTitle>
          <ModalText>
            Are you sure you want to cancel "{selectedSubmission?.form_name}"? 
            This action cannot be undone.
          </ModalText>
          <ModalActions>
            <ModalButton onClick={() => setShowCancelModal(false)}>
              Keep Working
            </ModalButton>
            <ModalButton
              $variant="danger"
              onClick={handleCancelConfirm}
              disabled={!!cancelingId}
            >
              {cancelingId ? 'Cancelling...' : 'Yes, Cancel'}
            </ModalButton>
          </ModalActions>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default FormsFlowsInProgress;
