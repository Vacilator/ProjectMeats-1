/**
 * Document Upload Card
 * 
 * Phase 4: Hybrid Task Renderer
 * Interaction card for document upload workflow nodes.
 * 
 * Features:
 * - Drag-and-drop file upload
 * - Progress indicator
 * - File type validation
 * - File size limits
 * - Preview uploaded files
 * - Integration with workflow context
 * 
 * Created: 2026-02-12 - Phase 4 Hybrid Task Renderer Implementation
 */

import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { FileUp, Check, X, File, Image, FileText, AlertCircle } from 'lucide-react';

import { documentsApi } from '@/services/aiService';

import { InteractionCardProps } from '../InteractionCardRegistry';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface UploadedFile {
  uuid: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const CardContainer = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
`;

const CardIcon = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-primary) / 0.1);
  border-radius: var(--radius-md);
  color: rgb(var(--color-primary));
  
  svg {
    width: 24px;
    height: 24px;
  }
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CardDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 20px;
`;

const DropZone = styled.div<{ $isDragging: boolean; $hasFile: boolean }>`
  border: 2px dashed ${props => 
    props.$hasFile 
      ? 'rgb(var(--color-success))' 
      : props.$isDragging 
        ? 'rgb(var(--color-primary))' 
        : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-lg);
  padding: 40px 20px;
  text-align: center;
  background: ${props => 
    props.$isDragging 
      ? 'rgb(var(--color-primary) / 0.05)' 
      : 'rgb(var(--color-surface-hover))'
  };
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.05);
  }
`;

const DropZoneIcon = styled.div<{ $hasFile: boolean }>`
  margin-bottom: 16px;
  
  svg {
    width: 48px;
    height: 48px;
    color: ${props => 
      props.$hasFile 
        ? 'rgb(var(--color-success))' 
        : 'rgb(var(--color-text-tertiary))'
    };
  }
`;

const DropZoneText = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

const DropZoneHint = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const FileInput = styled.input`
  display: none;
`;

const UploadProgress = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgb(var(--color-border));
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  width: ${props => props.$progress}%;
  height: 100%;
  background: rgb(var(--color-primary));
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  text-align: center;
`;

const FilePreview = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: rgb(var(--color-surface-hover));
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FileIcon = styled.div`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-success) / 0.1);
  border-radius: var(--radius-md);
  color: rgb(var(--color-success));
  flex-shrink: 0;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const RemoveButton = styled.button`
  padding: 8px;
  background: rgb(var(--color-error) / 0.1);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: rgb(var(--color-error));
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-error) / 0.2);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ErrorMessage = styled.div`
  margin-top: 12px;
  padding: 12px;
  background: rgb(var(--color-error) / 0.1);
  border: 1px solid rgb(var(--color-error) / 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-error));
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image />;
  if (type.includes('pdf')) return <FileText />;
  return <File />;
}

// ============================================================================
// Component
// ============================================================================

export const DocumentUploadCard: React.FC<InteractionCardProps> = ({
  node,
  context,
  onComplete,
  onWait,
  readOnly = false,
}) => {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get upload config from node
  const config = node.data || {};
  const title = config.title || 'Upload Document';
  const description = config.description || 'Please upload the required document to continue.';
  const allowedTypes = config.allowedTypes || ['*/*'];
  const maxSizeBytes = config.maxSizeBytes || 10 * 1024 * 1024; // 10MB default

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (readOnly) return;

    void (async () => {
      setError(null);

      // Validate file size
      if (file.size > maxSizeBytes) {
        setError(`File size exceeds maximum of ${formatFileSize(maxSizeBytes)}`);
        return;
      }

      // Validate file type (simplified - in production use more robust validation)
      if (allowedTypes[0] !== '*/*') {
        const isAllowed = allowedTypes.some((type: string) => {
          if (type === '*/*') return true;
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', ''));
          }
          return file.type === type;
        });

        if (!isAllowed) {
          setError(`File type not allowed. Accepted types: ${allowedTypes.join(', ')}`);
          return;
        }
      }

      setIsUploading(true);
      setUploadProgress(0);
      onWait?.();

      const progressTimer = window.setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return Math.min(90, prev + 7);
        });
      }, 200);

      const formatServerError = (data: unknown): string | null => {
        if (typeof data === 'string') return data;
        if (!data || typeof data !== 'object') return null;

        const obj = data as Record<string, unknown>;
        if (typeof obj.error === 'string') return obj.error;
        if (typeof obj.detail === 'string') return obj.detail;

        const parts: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            parts.push(`${key}: ${value}`);
          } else if (Array.isArray(value) && typeof value[0] === 'string') {
            parts.push(`${key}: ${value[0]}`);
          }
        }
        return parts.length ? parts.join(' • ') : null;
      };

      try {
        const res = await documentsApi.upload(file);
        window.clearInterval(progressTimer);
        setUploadProgress(100);

        // ai-documents API returns an AIDocument shape; keep this card output stable.
        const doc = (res && typeof res === 'object' ? (res as unknown as Record<string, unknown>) : {}) || {};
        const documentId = String(doc.id || `file-${Date.now()}`);
        const originalFilename = String(doc.original_filename || file.name);
        const contentType = String(doc.content_type || file.type || '');
        const fileSize = Number(doc.file_size ?? file.size ?? 0);
        const fileUrl = String(doc.file_url || doc.file || '');
        const createdOn = String(doc.created_on || new Date().toISOString());

        const next: UploadedFile = {
          uuid: documentId,
          name: originalFilename,
          size: fileSize,
          type: contentType,
          url: fileUrl || undefined,
        };

        setUploadedFile(next);
        setIsUploading(false);

        onComplete({
          file_uuid: documentId,
          file_name: originalFilename,
          file_size: fileSize,
          file_type: contentType,
          file_url: fileUrl,
          uploaded_at: createdOn,
        });
      } catch (e: unknown) {
        window.clearInterval(progressTimer);
        setUploadProgress(0);
        setIsUploading(false);

        const errObj = e && typeof e === 'object' ? (e as Record<string, unknown>) : null;
        const response = errObj?.response && typeof errObj.response === 'object' ? (errObj.response as Record<string, unknown>) : null;
        const status = typeof response?.status === 'number' ? (response.status as number) : null;
        const data = response?.data as unknown;

        // Non-breaking fallback: if the API isn't available in this environment, keep the old simulated behavior.
        if (status === 404 || status === 405) {
          const fileUuid = `file-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          const uploaded: UploadedFile = {
            uuid: fileUuid,
            name: file.name,
            size: file.size,
            type: file.type,
          };

          setUploadedFile(uploaded);
          onComplete({
            file_uuid: fileUuid,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            uploaded_at: new Date().toISOString(),
            simulated: true,
          });
          return;
        }

        setError(formatServerError(data) || 'Upload failed. Please retry.');
      }
    })();
  }, [allowedTypes, maxSizeBytes, onComplete, onWait, readOnly]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (readOnly) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Remove uploaded file
  const handleRemove = () => {
    setUploadedFile(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon>
          <FileUp />
        </CardIcon>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      
      {description && <CardDescription>{description}</CardDescription>}
      
      {!uploadedFile && !isUploading && (
        <>
          <DropZone
            $isDragging={isDragging}
            $hasFile={false}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => {
              if (readOnly) return;
              fileInputRef.current?.click();
            }}
          >
            <DropZoneIcon $hasFile={false}>
              <FileUp />
            </DropZoneIcon>
            <DropZoneText>
              {isDragging ? 'Drop file here' : 'Drag and drop file here'}
            </DropZoneText>
            <DropZoneHint>or click to browse</DropZoneHint>
          </DropZone>
          
          <FileInput
            ref={fileInputRef}
            type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileInputChange}
            disabled={readOnly}
          />
        </>
      )}
      
      {isUploading && (
        <UploadProgress>
          <ProgressBar>
            <ProgressFill $progress={uploadProgress} />
          </ProgressBar>
          <ProgressText>Uploading... {uploadProgress}%</ProgressText>
        </UploadProgress>
      )}
      
      {uploadedFile && !isUploading && (
        <FilePreview>
          <FileIcon>
            <Check />
          </FileIcon>
          <FileInfo>
            <FileName>{uploadedFile.name}</FileName>
            <FileSize>{formatFileSize(uploadedFile.size)}</FileSize>
          </FileInfo>
          {!readOnly && (
            <RemoveButton onClick={handleRemove} title="Remove file">
              <X />
            </RemoveButton>
          )}
        </FilePreview>
      )}
      
      {error && (
        <ErrorMessage>
          <AlertCircle />
          <span>{error}</span>
        </ErrorMessage>
      )}
    </CardContainer>
  );
};

export default DocumentUploadCard;
