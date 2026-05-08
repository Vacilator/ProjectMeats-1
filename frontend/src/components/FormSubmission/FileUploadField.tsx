/**
 * FileUploadField Component
 *
 * Handles file and image uploads in form submissions with:
 * - Drag and drop support
 * - File preview (images show thumbnails, others show icon)
 * - Progress indicator during upload
 * - Remove button
 * - File size/type validation
 */
import React, { useState, useRef, useCallback } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { formSubmissionService } from '../../services/quickActionsService';

interface FileUploadFieldProps {
  submissionId: string;
  fieldKey: string;
  label: string;
  value?: FileValue | FileValue[];
  onChange: (value: FileValue | FileValue[] | null) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  isImage?: boolean;
  hasError?: boolean;
}

interface FileValue {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const Container = styled.div`
  width: 100%;
`;

const DropZone = styled.div<{ $isDragActive: boolean; $hasError?: boolean }>`
  border: 2px dashed ${props => props.$isDragActive ? 'rgb(var(--color-primary))' : props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$isDragActive ? 'rgba(var(--color-primary), 0.10)' : props.$hasError ? 'rgba(var(--color-error), 0.14)' : 'rgb(var(--color-surface))'};

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-surface));
  }
`;

const DropZoneContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const DropIcon = styled.div<{ $isImage?: boolean }>`
  font-size: 40px;
  color: ${props => props.$isImage ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-muted))'};
`;

const DropText = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));

  strong {
    color: rgb(var(--color-primary));
  }
`;

const DropHint = styled.p`
  margin: 0;
  font-size: 12px;
  color: rgb(var(--color-text-muted));
`;

const FileInput = styled.input`
  display: none;
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const FileItem = styled.div<{ $isUploading?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;

  ${props => props.$isUploading && css`
    animation: ${pulse} 1.5s ease-in-out infinite;
    border-color: rgb(var(--color-primary));
  `}
`;

const FileThumbnail = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: rgb(var(--color-surface-hover));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const FileIcon = styled.span`
  font-size: 24px;
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.p`
  margin: 0;
  font-size: 12px;
  color: rgb(var(--color-text-muted));
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgb(var(--color-border));
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${props => props.$progress}%;
  background: linear-gradient(90deg, rgb(var(--color-primary)), rgb(var(--color-info)));
  transition: width 0.3s ease;
`;

const RemoveButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(var(--color-error), 0.14);
  color: rgb(var(--color-error));
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;

  &:hover {
    background: rgba(var(--color-error), 0.20);
  }
`;

const ErrorText = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  color: rgb(var(--color-error));
`;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (type: string): string => {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('zip') || type.includes('archive')) return '📦';
  return '📎';
};

const FileUploadField: React.FC<FileUploadFieldProps> = ({
  submissionId,
  fieldKey,
  label: _label, // Unused but kept for API consistency
  value,
  onChange,
  accept,
  multiple = false,
  maxSizeMB = 10,
  isImage = false,
  hasError = false,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = Array.isArray(value) ? value : value ? [value] : [];

  const validateFile = (file: File): string | null => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File too large. Maximum size is ${maxSizeMB}MB`;
    }

    if (isImage && !file.type.startsWith('image/')) {
      return 'Please select an image file';
    }

    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
      const fileType = file.type.toLowerCase();
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) return type === fileExt;
        if (type.endsWith('/*')) return fileType.startsWith(type.replace('/*', '/'));
        return type === fileType;
      });

      if (!isAccepted) {
        return `Invalid file type. Accepted: ${accept}`;
      }
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<FileValue | null> => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));
    setError(null);

    try {
      // Create a simulated progress update
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [tempId]: Math.min((prev[tempId] || 0) + 10, 90),
        }));
      }, 200);

      const result = await formSubmissionService.uploadFile(submissionId, fieldKey, file);

      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));

      // Clean up progress after animation
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[tempId];
          return newProgress;
        });
      }, 500);

      return {
        id: result.id,
        name: result.name || file.name,
        url: result.url,
        size: file.size,
        type: file.type,
      };
    } catch (err: any) {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[tempId];
        return newProgress;
      });
      setError(err.response?.data?.error || 'Failed to upload file');
      return null;
    }
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    const filesToUpload = Array.from(fileList);

    if (!multiple && filesToUpload.length > 1) {
      setError('Only one file allowed');
      return;
    }

    if (multiple) {
      const uploaded: FileValue[] = [];
      for (const file of filesToUpload) {
        const result = await uploadFile(file);
        if (result) uploaded.push(result);
      }
      if (uploaded.length > 0) {
        onChange([...files, ...uploaded]);
      }
    } else {
      const result = await uploadFile(filesToUpload[0]);
      if (result) {
        onChange(result);
      }
    }
  }, [files, multiple, onChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemove = (fileId: string) => {
    if (multiple) {
      const newFiles = files.filter(f => f.id !== fileId);
      onChange(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange(null);
    }
  };

  const acceptAttr = accept || (isImage ? 'image/*' : undefined);

  return (
    <Container>
      <DropZone
        $isDragActive={isDragActive}
        $hasError={hasError}
        onClick={handleClick}
        onDrag={handleDrag}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <FileInput
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          onChange={handleInputChange}
        />
        <DropZoneContent>
          <DropIcon $isImage={isImage}>
            {isImage ? '📷' : '📁'}
          </DropIcon>
          <DropText>
            <strong>Click to upload</strong> or drag and drop
          </DropText>
          <DropHint>
            {isImage ? 'PNG, JPG, GIF up to' : 'Any file up to'} {maxSizeMB}MB
            {accept && ` (${accept})`}
          </DropHint>
        </DropZoneContent>
      </DropZone>

      {error && <ErrorText>⚠️ {error}</ErrorText>}

      {/* Uploading files */}
      {Object.entries(uploadProgress).length > 0 && (
        <FileList>
          {Object.entries(uploadProgress).map(([id, progress]) => (
            <FileItem key={id} $isUploading>
              <FileThumbnail>
                <FileIcon>⏳</FileIcon>
              </FileThumbnail>
              <FileInfo>
                <FileName>Uploading...</FileName>
                <ProgressBar>
                  <ProgressFill $progress={progress} />
                </ProgressBar>
              </FileInfo>
            </FileItem>
          ))}
        </FileList>
      )}

      {/* Uploaded files */}
      {files.length > 0 && (
        <FileList>
          {files.map(file => (
            <FileItem key={file.id}>
              <FileThumbnail>
                {file.type.startsWith('image/') ? (
                  <img src={file.url} alt={file.name} />
                ) : (
                  <FileIcon>{getFileIcon(file.type)}</FileIcon>
                )}
              </FileThumbnail>
              <FileInfo>
                <FileName title={file.name}>{file.name}</FileName>
                <FileSize>{formatFileSize(file.size)}</FileSize>
              </FileInfo>
              <RemoveButton
                type="button"
                onClick={() => handleRemove(file.id)}
                title="Remove file"
              >
                ✕
              </RemoveButton>
            </FileItem>
          ))}
        </FileList>
      )}
    </Container>
  );
};

export default FileUploadField;
