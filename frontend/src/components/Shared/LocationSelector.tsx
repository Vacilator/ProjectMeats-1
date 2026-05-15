/**
 * LocationSelector Component - RLS-Protected Location Dropdown
 * 
 * Features:
 * - Fetches locations from backend (filtered by RLS tenant isolation)
 * - Handles loading states and errors gracefully
 * - Supports optional type filtering (plant, warehouse, distribution center)
 * - Theme-aware styling
 * - Error handling for 403 Forbidden (RLS rejection) and token expiration
 * 
 * Phase 4: Frontend Integration & UX Alignment
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Theme } from '../../config/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { getErrorMessage } from '@/utils/errorHelpers';
import { Location } from '../../types/index';
import { businessApi } from '@/services/businessApi';
import { logger } from '@/utils/logger';

export interface LocationSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  type?: 'plant' | 'warehouse' | 'distribution_center' | null;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  'aria-label'?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  value,
  onChange,
  type = null,
  label = 'Location',
  required = false,
  disabled = false,
  error,
  placeholder = 'Select a location',
  'aria-label': ariaLabel,
}) => {
  const { theme } = useTheme();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const response = await businessApi.get('/locations/', {
        params: type ? { type } : undefined,
        timeout: 10000,
      });

      // Handle both paginated and non-paginated responses
      const raw = response.data as unknown;
      const data = Array.isArray(raw)
        ? (raw as Location[])
        : (() => {
            const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
            const results = obj && Array.isArray(obj.results) ? (obj.results as Location[]) : [];
            return results;
          })();

      setLocations(data);
    } catch (err: unknown) {
      type AxiosishError = {
        response?: {
          status?: unknown;
        };
        code?: unknown;
      };

      const e = err as AxiosishError;
      const status = typeof e.response?.status === 'number' ? e.response.status : null;
      const code = typeof e.code === 'string' ? e.code : null;

      // Graceful error handling for RLS and auth failures
      if (status === 403) {
        setFetchError('Access denied - insufficient permissions');
        logger.error('[LocationSelector] RLS policy rejected request:', err);
      } else if (status === 401) {
        setFetchError('Authentication required');
        logger.error('[LocationSelector] Not authenticated:', err);
      } else if (code === 'ECONNABORTED') {
        setFetchError('Request timeout - please try again');
      } else {
        setFetchError(getErrorMessage(err, 'Failed to load locations'));
        logger.error('[LocationSelector] Error fetching locations:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue === '' ? null : selectedValue);
  };

  return (
    <Container>
      {label && <Label $theme={theme}>{label}{required && ' *'}</Label>}
      
      <StyledSelect
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        required={required}
        aria-label={ariaLabel || label}
        $theme={theme}
        $hasError={!!error || !!fetchError}
      >
        <option value="" disabled hidden>
          {loading ? 'Loading locations...' : placeholder}
        </option>
        
        {!loading && !fetchError && locations.length === 0 && (
          <option value="" disabled>
            No locations available
          </option>
        )}
        
        {!loading && fetchError && (
          <option value="" disabled>
            {fetchError}
          </option>
        )}
        
        {!loading && !fetchError && locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name} - {location.location_type} ({location.city}, {location.state_province})
          </option>
        ))}
      </StyledSelect>
      
      {(error || fetchError) && (
        <ErrorMessage $theme={theme}>
          {error || fetchError}
          {fetchError && (
            <RetryButton onClick={fetchLocations} type="button">
              Retry
            </RetryButton>
          )}
        </ErrorMessage>
      )}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
`;

const Label = styled.label<{ $theme: Theme }>`
  font-size: 14px;
  font-weight: 500;
  color: ${(props) => props.$theme.colors.textPrimary};
  margin-bottom: 2px;
`;

const StyledSelect = styled.select<{ $theme: Theme; $hasError: boolean }>`
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid ${(props) => 
    props.$hasError 
      ? props.$theme.colors.danger 
      : props.$theme.colors.border
  };
  border-radius: 6px;
  background-color: ${(props) => props.$theme.colors.surface};
  color: ${(props) => props.$theme.colors.textPrimary};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${(props) => props.$theme.colors.primary};
  }

  &:focus {
    outline: none;
    border-color: ${(props) => props.$theme.colors.primary};
    box-shadow: 0 0 0 3px ${(props) => props.$theme.colors.primary}20;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: ${(props) => props.$theme.colors.surfaceHover};
  }

  option {
    background-color: ${(props) => props.$theme.colors.surface};
    color: ${(props) => props.$theme.colors.textPrimary};
    padding: 8px;
  }
`;

const ErrorMessage = styled.div<{ $theme: Theme }>`
  color: ${(props) => props.$theme.colors.danger};
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RetryButton = styled.button`
  background: none;
  border: none;
  color: rgb(var(--color-primary));
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
  padding: 0;

  &:hover {
    color: rgb(var(--color-primary-hover));
  }
`;

export default LocationSelector;
