/**
 * Rating Field Component
 * A star rating input for forms (1-5 stars)
 */

import React, { useState } from 'react';
import styled from 'styled-components';

const RatingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Star = styled.button<{ $filled: boolean; $hovered: boolean }>`
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  transition: transform 0.1s ease, color 0.15s ease;
  color: ${props => props.$filled || props.$hovered ? 'rgb(var(--color-warning))' : 'rgb(var(--color-border))'};
  transform: ${props => props.$hovered ? 'scale(1.15)' : 'scale(1)'};
  padding: 2px;

  &:hover {
    transform: scale(1.15);
  }

  &:focus {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const RatingLabel = styled.span`
  margin-left: 12px;
  font-size: 14px;
  color: rgb(var(--color-text-muted));
  min-width: 60px;
`;

interface RatingFieldProps {
  value: number;
  onChange: (value: number) => void;
  maxRating?: number;
  disabled?: boolean;
  hasError?: boolean;
  ariaProps?: Record<string, any>;
}

export const RatingField: React.FC<RatingFieldProps> = ({
  value,
  onChange,
  maxRating = 5,
  disabled = false,
  hasError: _hasError,  // Reserved for future error state styling
  ariaProps = {},
}) => {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const getRatingLabel = (rating: number) => {
    if (rating === 0) return 'No rating';
    if (rating === 1) return 'Poor';
    if (rating === 2) return 'Fair';
    if (rating === 3) return 'Good';
    if (rating === 4) return 'Very Good';
    if (rating === 5) return 'Excellent';
    return `${rating} stars`;
  };

  return (
    <RatingContainer
      role="radiogroup"
      aria-label="Rating"
      {...ariaProps}
    >
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          $filled={star <= value}
          $hovered={hoveredStar !== null && star <= hoveredStar}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHoveredStar(star)}
          onMouseLeave={() => setHoveredStar(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' && star < maxRating) {
              onChange(star + 1);
            } else if (e.key === 'ArrowLeft' && star > 1) {
              onChange(star - 1);
            }
          }}
          disabled={disabled}
          tabIndex={star === (value || 1) ? 0 : -1}
        >
          ★
        </Star>
      ))}
      <RatingLabel aria-live="polite">
        {getRatingLabel(hoveredStar ?? value)}
      </RatingLabel>
    </RatingContainer>
  );
};

export default RatingField;
