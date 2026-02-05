/**
 * Signature Field Component
 * A canvas-based signature pad for capturing signatures
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

const SignatureContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CanvasWrapper = styled.div<{ $hasError?: boolean; $hasSignature: boolean }>`
  position: relative;
  border: 2px ${props => props.$hasSignature ? 'solid' : 'dashed'} ${props => props.$hasError ? '#ef4444' : '#d1d5db'};
  border-radius: 8px;
  background: ${props => props.$hasSignature ? '#fff' : '#fafafa'};
  overflow: hidden;
  transition: border-color 0.2s ease, background 0.2s ease;
  
  &:hover {
    border-color: ${props => props.$hasError ? '#ef4444' : '#9ca3af'};
  }
  
  &:focus-within {
    border-color: ${props => props.$hasError ? '#ef4444' : '#3b82f6'};
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 150px;
  cursor: crosshair;
  touch-action: none;
`;

const Placeholder = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #9ca3af;
  font-size: 14px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const PlaceholderIcon = styled.span`
  font-size: 24px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &.primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
    
    &:hover:not(:disabled) {
      background: #2563eb;
    }
  }
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 150px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
`;

interface SignatureFieldProps {
  value: string; // Base64 data URL
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  ariaProps?: Record<string, any>;
}

export const SignatureField: React.FC<SignatureFieldProps> = ({
  value,
  onChange,
  disabled = false,
  hasError,
  ariaProps = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!value);
  const lastPos = useRef({ x: 0, y: 0 });

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Style
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Load existing signature if present
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, []);

  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const pos = getPosition(e);
    lastPos.current = pos;
    setIsDrawing(true);
  }, [disabled, getPosition]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    const pos = getPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    lastPos.current = pos;
    setHasSignature(true);
  }, [isDrawing, disabled, getPosition]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Save signature
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [isDrawing, hasSignature, onChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onChange('');
  }, [onChange]);

  // Show preview mode if disabled and has value
  if (disabled && value) {
    return (
      <SignatureContainer>
        <PreviewImage src={value} alt="Signature" />
      </SignatureContainer>
    );
  }

  return (
    <SignatureContainer>
      <CanvasWrapper $hasError={hasError} $hasSignature={hasSignature}>
        <Canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          role="img"
          aria-label="Signature pad - draw your signature"
          tabIndex={0}
          {...ariaProps}
        />
        {!hasSignature && (
          <Placeholder>
            <PlaceholderIcon>✍️</PlaceholderIcon>
            <span>Draw your signature here</span>
          </Placeholder>
        )}
      </CanvasWrapper>
      
      <ButtonRow>
        <ActionButton
          type="button"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
        >
          🗑️ Clear
        </ActionButton>
      </ButtonRow>
    </SignatureContainer>
  );
};

export default SignatureField;
