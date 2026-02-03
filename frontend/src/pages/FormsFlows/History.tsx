/**
 * Forms & Flows History Page
 * 
 * View completed and cancelled form submissions.
 * Implements Phase 1 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * 
 * Features:
 * - List of completed/cancelled submissions
 * - Date range filtering
 * - Search by form name
 * - View submission details (read-only)
 * - Export to CSV (future)
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  CheckCircle, XCircle, Calendar, Search, Download, 
  Eye, Filter, RefreshCw, FileText, ChevronRight 
} from 'lucide-react';
import { apiClient } from '../../services/apiService';

// ============================================================================
// Types
// ============================================================================

interface FormSubmission {
  id: string;
  form_name: string;
  form_icon?: string;
  status: 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  created_by_name?: string;
  total_steps: number;
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
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  padding: 8px 12px 8px 36px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  width: 280px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
  
  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgb(var(--color-text-tertiary));
`;

const DateFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DateInput = styled.input`
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
`;

const DateSeparator = styled.span`
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

const ActionButton = styled.button`
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
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: rgb(var(--color-surface));
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  border: 1px solid rgb(var(--color-border));
`;

const TableHead = styled.thead`
  background: rgb(var(--color-background));
`;

const TableRow = styled.tr`
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: rgb(var(--color-surface-hover));
  }
`;

const TableHeader = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgb(var(--color-text-secondary));
`;

const TableCell = styled.td`
  padding: 16px;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const FormInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FormIcon = styled.div`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 6px);
  background: rgb(var(--color-primary) / 0.1);
  font-size: 18px;
`;

const FormName = styled.div`
  font-weight: 500;
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
    $status === 'completed' ? 'rgb(34, 197, 94, 0.1)' : 'rgb(239, 68, 68, 0.1)'
  };
  color: ${({ $status }) => 
    $status === 'completed' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
  };
`;

const ViewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  cursor: pointer;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
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
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg, 12px);
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

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const PageInfo = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const PageButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const PageButton = styled.button<{ $active?: boolean }>`
  padding: 6px 12px;
  border: 1px solid ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-sm, 6px);
  background: ${({ $active }) => 
    $active ? 'rgb(var(--color-primary))' : 'transparent'
  };
  color: ${({ $active }) => 
    $active ? 'white' : 'rgb(var(--color-text-secondary))'
  };
  font-size: 14px;
  cursor: pointer;
  
  &:hover:not(:disabled) {
    border-color: rgb(var(--color-primary));
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsHistory: React.FC = () => {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;
  
  // Fetch completed/cancelled submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        status: 'completed,cancelled',
        page: String(page),
        page_size: String(pageSize),
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (searchQuery) params.search = searchQuery;
      
      const response = await apiClient.get('/workflows/submissions/', { params });
      setSubmissions(response.data.results || response.data || []);
      setTotalCount(response.data.count || 0);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSubmissions();
  }, [page, startDate, endDate]);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchSubmissions();
      } else {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Handle view details
  const handleViewDetails = (submission: FormSubmission) => {
    // Navigate to submission details page
    window.location.href = `/workflows/details/${submission.id}`;
  };
  
  // Export to CSV (placeholder)
  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon!');
  };
  
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return (
    <Container>
      <Toolbar>
        <ToolbarLeft>
          <SearchWrapper>
            <SearchIcon>
              <Search size={16} />
            </SearchIcon>
            <SearchInput
              type="text"
              placeholder="Search by form name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchWrapper>
          
          <DateFilter>
            <Calendar size={16} color="rgb(var(--color-text-tertiary))" />
            <DateInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
            />
            <DateSeparator>to</DateSeparator>
            <DateInput
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
            />
          </DateFilter>
        </ToolbarLeft>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton onClick={handleExport}>
            <Download size={16} />
            Export
          </ActionButton>
          <ActionButton onClick={fetchSubmissions} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </ActionButton>
        </div>
      </Toolbar>
      
      {loading ? (
        <LoadingState>Loading history...</LoadingState>
      ) : submissions.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <FileText size={48} />
          </EmptyIcon>
          <EmptyTitle>No history found</EmptyTitle>
          <EmptyMessage>
            {searchQuery || startDate || endDate
              ? 'No matching records found. Try adjusting your filters.'
              : 'Completed and cancelled forms will appear here.'}
          </EmptyMessage>
        </EmptyState>
      ) : (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeader>Form</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Started</TableHeader>
                <TableHeader>Completed</TableHeader>
                <TableHeader>By</TableHeader>
                <TableHeader style={{ width: '80px' }}>Actions</TableHeader>
              </tr>
            </TableHead>
            <tbody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <FormInfo>
                      <FormIcon>
                        {submission.form_icon || <FileText size={18} />}
                      </FormIcon>
                      <FormName>{submission.form_name}</FormName>
                    </FormInfo>
                  </TableCell>
                  <TableCell>
                    <StatusBadge $status={submission.status}>
                      {submission.status === 'completed' 
                        ? <><CheckCircle size={12} /> Completed</>
                        : <><XCircle size={12} /> Cancelled</>
                      }
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{formatDate(submission.created_at)}</TableCell>
                  <TableCell>{formatDate(submission.completed_at || '')}</TableCell>
                  <TableCell>{submission.created_by_name || '-'}</TableCell>
                  <TableCell>
                    <ViewButton onClick={() => handleViewDetails(submission)}>
                      <Eye size={14} />
                      View
                    </ViewButton>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
          
          {totalPages > 1 && (
            <Pagination>
              <PageInfo>
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} of {totalCount}
              </PageInfo>
              <PageButtons>
                <PageButton 
                  onClick={() => setPage(p => p - 1)} 
                  disabled={page <= 1}
                >
                  Previous
                </PageButton>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <PageButton
                      key={pageNum}
                      $active={page === pageNum}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </PageButton>
                  );
                })}
                <PageButton 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={page >= totalPages}
                >
                  Next
                </PageButton>
              </PageButtons>
            </Pagination>
          )}
        </>
      )}
    </Container>
  );
};

export default FormsFlowsHistory;
