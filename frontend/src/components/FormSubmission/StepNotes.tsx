/**
 * StepNotes Component
 * 
 * Collapsible notes panel for form steps.
 * Integrates with ActivityLog API for persistent notes.
 */
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService';

interface Note {
  id: number;
  content: string;
  title?: string;
  created_by_name: string;
  created_on: string;
  is_pinned: boolean;
}

interface StepNotesProps {
  submissionId: string;
  stepId: string;
  stepName: string;
  disabled?: boolean;
}

const NotesContainer = styled.div`
  margin-top: 1rem;
  border-top: 1px solid var(--border-color, #dee2e6);
  padding-top: 1rem;
`;

const NotesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0.5rem 0;
  user-select: none;
  
  &:hover {
    opacity: 0.8;
  }
`;

const NotesTitle = styled.h4`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #6c757d);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NotesCount = styled.span`
  background: var(--bg-tertiary, #e9ecef);
  color: var(--text-secondary, #6c757d);
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const CollapseIcon = styled.span<{ isExpanded: boolean }>`
  font-size: 0.75rem;
  transition: transform 0.2s ease;
  transform: ${({ isExpanded }) => isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
`;

const NotesContent = styled.div<{ isExpanded: boolean }>`
  max-height: ${({ isExpanded }) => isExpanded ? '500px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const NotesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 0;
  max-height: 300px;
  overflow-y: auto;
`;

const NoteItem = styled.div<{ isPinned?: boolean }>`
  background: var(--bg-secondary, #f8f9fa);
  border: 1px solid var(--border-color, #dee2e6);
  border-radius: 0.375rem;
  padding: 0.75rem;
  
  ${({ isPinned }) => isPinned && `
    border-left: 3px solid var(--color-primary, #0d6efd);
    background: var(--bg-primary-subtle, #e7f1ff);
  `}
`;

const NoteHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
`;

const NoteAuthor = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary, #1a1a2e);
`;

const NoteTime = styled.span`
  font-size: 0.688rem;
  color: var(--text-secondary, #6c757d);
`;

const NoteText = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-primary, #1a1a2e);
  white-space: pre-wrap;
  word-break: break-word;
`;

const AddNoteForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color, #dee2e6);
`;

const NoteTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 0.625rem;
  border: 1px solid var(--border-color, #dee2e6);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  background: var(--input-bg, #ffffff);
  color: var(--text-primary, #1a1a2e);
  
  &:focus {
    outline: none;
    border-color: var(--color-primary, #0d6efd);
    box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.1);
  }
  
  &::placeholder {
    color: var(--text-tertiary, #adb5bd);
  }
  
  &:disabled {
    background: var(--bg-tertiary, #e9ecef);
    cursor: not-allowed;
  }
`;

const AddNoteActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${({ variant }) => variant === 'secondary' ? `
    background: var(--bg-secondary, #f8f9fa);
    color: var(--text-primary, #1a1a2e);
    border-color: var(--border-color, #dee2e6);
    &:hover:not(:disabled) {
      background: var(--bg-tertiary, #e9ecef);
    }
  ` : `
    background: var(--color-primary, #0d6efd);
    color: white;
    &:hover:not(:disabled) {
      background: var(--color-primary-dark, #0b5ed7);
    }
  `}
  
  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const EmptyNotes = styled.p`
  color: var(--text-tertiary, #adb5bd);
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem 0;
  margin: 0;
`;

const LoadingSpinner = styled.span`
  display: inline-block;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export const StepNotes: React.FC<StepNotesProps> = ({
  submissionId,
  stepId,
  stepName,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notes when expanded
  useEffect(() => {
    if (isExpanded && notes.length === 0 && !isLoading) {
      loadNotes();
    }
  }, [isExpanded]);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Query activity logs for this step submission
      const response = await apiClient.get('/api/cockpit/activity-logs/', {
        params: {
          entity_type: 'form_step_submission',
          entity_id: `${submissionId}_${stepId}`,
          ordering: '-created_on',
        },
      });
      setNotes(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to load step notes:', err);
      setError('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [submissionId, stepId]);

  const handleAddNote = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || isAdding || disabled) return;

    setIsAdding(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/cockpit/activity-logs/', {
        entity_type: 'form_step_submission',
        entity_id: `${submissionId}_${stepId}`,
        content: newNote.trim(),
        title: `Note on ${stepName}`,
      });
      
      setNotes(prev => [response.data, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
      setError('Failed to add note');
    } finally {
      setIsAdding(false);
    }
  }, [newNote, isAdding, disabled, submissionId, stepId, stepName]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <NotesContainer>
      <NotesHeader onClick={() => setIsExpanded(prev => !prev)}>
        <NotesTitle>
          📝 Step Notes
          {notes.length > 0 && <NotesCount>{notes.length}</NotesCount>}
        </NotesTitle>
        <CollapseIcon isExpanded={isExpanded}>▼</CollapseIcon>
      </NotesHeader>
      
      <NotesContent isExpanded={isExpanded}>
        {isLoading ? (
          <EmptyNotes>
            <LoadingSpinner>⏳</LoadingSpinner> Loading notes...
          </EmptyNotes>
        ) : error ? (
          <EmptyNotes style={{ color: 'var(--color-error, #dc3545)' }}>
            {error}
            <Button variant="secondary" onClick={loadNotes} style={{ marginLeft: '0.5rem' }}>
              Retry
            </Button>
          </EmptyNotes>
        ) : (
          <>
            {notes.length > 0 ? (
              <NotesList>
                {notes.map(note => (
                  <NoteItem key={note.id} isPinned={note.is_pinned}>
                    <NoteHeader>
                      <NoteAuthor>{note.created_by_name || 'Unknown'}</NoteAuthor>
                      <NoteTime>{formatDate(note.created_on)}</NoteTime>
                    </NoteHeader>
                    <NoteText>{note.content}</NoteText>
                  </NoteItem>
                ))}
              </NotesList>
            ) : (
              <EmptyNotes>No notes yet. Add one below.</EmptyNotes>
            )}
            
            {!disabled && (
              <AddNoteForm onSubmit={handleAddNote}>
                <NoteTextarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this step..."
                  disabled={isAdding || disabled}
                />
                <AddNoteActions>
                  {newNote.trim() && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setNewNote('')}
                      disabled={isAdding}
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={!newNote.trim() || isAdding}
                  >
                    {isAdding ? 'Adding...' : '+ Add Note'}
                  </Button>
                </AddNoteActions>
              </AddNoteForm>
            )}
          </>
        )}
      </NotesContent>
    </NotesContainer>
  );
};

export default StepNotes;
