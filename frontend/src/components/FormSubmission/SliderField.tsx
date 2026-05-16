/**
 * Slider Field Component
 * A range slider input with visual feedback
 */

import React from 'react';
import styled from 'styled-components';

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const SliderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SliderValue = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface-hover));
  padding: 4px 12px;
  border-radius: 6px;
  min-width: 60px;
  text-align: center;
`;

const SliderTrack = styled.div`
  position: relative;
  height: 8px;
  background: rgb(var(--color-border));
  border-radius: 4px;
  overflow: visible;
`;

const SliderFill = styled.div<{ $percent: number }>`
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, rgb(var(--color-primary)), rgb(var(--color-info)));
  border-radius: 4px;
  width: ${props => props.$percent}%;
  transition: width 0.1s ease;
`;

const SliderInput = styled.input`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  
  &:focus + .slider-thumb {
    box-shadow: 0 0 0 4px rgba(var(--color-primary), 0.3);
  }
`;

const SliderThumb = styled.div<{ $percent: number }>`
  position: absolute;
  top: 50%;
  left: ${props => props.$percent}%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: rgb(var(--color-bg-primary));
  border: 3px solid rgb(var(--color-primary));
  border-radius: 50%;
  pointer-events: none;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
  box-shadow: 0 2px 6px rgba(var(--color-overlay), 0.15);
  
  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }
`;

const SliderLabels = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgb(var(--color-text-muted));
`;

interface SliderFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showLabels?: boolean;
  unit?: string;
  hasError?: boolean;
  ariaProps?: Record<string, unknown>;
}

const EMPTY_ARIA_PROPS: Record<string, unknown> = {};

export const SliderField: React.FC<SliderFieldProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showLabels = true,
  unit = '',
  hasError: _hasError,  // Reserved for future error state styling
  ariaProps = EMPTY_ARIA_PROPS,
}) => {
  const percent = ((value - min) / (max - min)) * 100;
  
  const formatValue = (val: number) => {
    if (unit) return `${val}${unit}`;
    return val.toString();
  };

  return (
    <SliderContainer>
      <SliderHeader>
        <SliderValue aria-live="polite">
          {formatValue(value)}
        </SliderValue>
      </SliderHeader>
      
      <SliderTrack>
        <SliderFill $percent={percent} />
        <SliderInput
          {...ariaProps}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue(value)}
        />
        <SliderThumb className="slider-thumb" $percent={percent} />
      </SliderTrack>
      
      {showLabels && (
        <SliderLabels>
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </SliderLabels>
      )}
    </SliderContainer>
  );
};

export default SliderField;
