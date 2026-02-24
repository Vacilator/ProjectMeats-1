/**
 * Shared Styled Components for Config Panels
 * 
 * Phase E.1: Foundation - Consolidation of duplicated styled components
 * 
 * Before: 400+ lines of duplicate styled components across 21 config panel files
 * After: Single source of truth with consistent styling
 * 
 * Usage:
 * ```typescript
 * import { PanelOverlay, PanelContainer, Label, Input } from './shared/StyledComponents';
 * ```
 * 
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import styled from 'styled-components';

// ============================================================================
// Panel Structure Components
// ============================================================================

/**
 * Panel Overlay - Dark background overlay
 * Used by: All modal-style config panels (CreateRecord, FormProcess, etc.)
 */
export const PanelOverlay = styled.div<{ $isOpen?: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: ${props => props.$isOpen === false ? 'none' : 'block'};
  animation: fadeIn 0.2s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

/**
 * Panel Container - Main panel wrapper (slide-in from right)
 * Used by: CreateRecordConfigPanel, DocumentConfigPanel, etc.
 * 
 * Updated: 2026-02-24 - Fixed responsive width and overflow issues
 */
export const Panel = styled.div<{ $width?: string }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: ${props => props.$width || 'min(720px, 45vw)'};
  max-width: 900px;
  min-width: 480px;
  background: rgb(var(--color-surface));
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow-x: auto;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  @media (max-width: 1024px) {
    width: 60vw;
    min-width: 400px;
  }
  
  @media (max-width: 768px) {
    width: 100vw;
    max-width: none;
    min-width: unset;
  }
`;

/**
 * Panel Container (Simple) - Non-modal panel wrapper
 * Used by: OutlookEmailConfigPanel, FormProcessConfigPanel (inline)
 */
export const PanelContainer = styled.div<{ $padding?: string }>`
  padding: ${props => props.$padding || '16px'};
  background: rgb(var(--color-surface));
`;

/**
 * Panel Header - Title bar with close button
 * Used by: All modal panels
 */
export const PanelHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgb(var(--color-surface));
`;

/**
 * Panel Title - Main heading in panel header
 */
export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

/**
 * Close Button - X button in panel header
 */
export const CloseButton = styled.button`
  padding: 8px;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

/**
 * Panel Content - Scrollable content area
 */
export const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

/**
 * Panel Footer - Action buttons area
 */
export const PanelFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  background: rgb(var(--color-surface));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
`;

// ============================================================================
// Section Components
// ============================================================================

/**
 * Section - Logical grouping of fields
 * Used by: All config panels for organizing related fields
 */
export const Section = styled.div<{ $marginBottom?: string }>`
  margin-bottom: ${props => props.$marginBottom || '20px'};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

/**
 * Form Section - Section with border and padding
 * Used by: CreateRecordConfigPanel, FormStepConfigPanel
 */
export const FormSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

/**
 * Section Header - Header for collapsible sections
 */
export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

/**
 * Section Title - Heading for section
 */
export const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

// ============================================================================
// Form Field Components
// ============================================================================

/**
 * Form Field - Individual field wrapper
 */
export const FormField = styled.div<{ $marginBottom?: string }>`
  margin-bottom: ${props => props.$marginBottom || '16px'};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

/**
 * Field - Simple field wrapper
 */
export const Field = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

/**
 * Label - Field label
 * Used by: All config panels for form field labels
 */
export const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 6px;
`;

/**
 * Field Label - Alternative label styling
 */
export const FieldLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 8px;
`;

/**
 * Label Container - Label with inline elements (e.g., variable button)
 * Used by: OutlookEmailConfigPanel, CreateRecordConfigPanel
 */
export const LabelContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

/**
 * Required Indicator - Red asterisk
 */
export const RequiredIndicator = styled.span`
  color: rgb(var(--color-error));
  margin-left: 4px;
`;

/**
 * Field Help - Helpful hint text below field
 */
export const FieldHelp = styled.p`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin: 6px 0 0 0;
`;

/**
 * Help Text - Alternative help text styling
 */
export const HelpText = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
  font-style: italic;
`;

// ============================================================================
// Input Components
// ============================================================================

/**
 * Input - Standard text input
 * Used by: Most config panels for text fields
 */
export const Input = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

/**
 * Text Input - Alternative text input (same as Input)
 */
export const TextInput = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * TextArea - Multi-line text input
 */
export const TextArea = styled.textarea<{ $hasError?: boolean; $minHeight?: string }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  resize: vertical;
  min-height: ${props => props.$minHeight || '80px'};
  transition: all 0.2s;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

/**
 * Select - Dropdown select input
 */
export const Select = styled.select<{ $hasError?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.$hasError ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  transition: all 0.2s;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Button Components
// ============================================================================

/**
 * Button - Configurable button with variants
 * Variants: primary (blue), secondary (gray), ghost (transparent)
 */
export const Button = styled.button<{ 
  $variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; 
  $size?: 'sm' | 'md' | 'lg';
  $fullWidth?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: ${props => {
    switch (props.$size) {
      case 'sm': return '6px 12px';
      case 'lg': return '12px 24px';
      default: return '8px 16px';
    }
  }};
  font-size: ${props => {
    switch (props.$size) {
      case 'sm': return '13px';
      case 'lg': return '15px';
      default: return '14px';
    }
  }};
  font-weight: 500;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  width: ${props => props.$fullWidth ? '100%' : 'auto'};
  
  /* Variant styles */
  ${props => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: white;
          &:hover { background: rgb(var(--color-primary-dark)); }
          &:active { transform: translateY(1px); }
        `;
      case 'danger':
        return `
          background: rgb(var(--color-error));
          color: white;
          &:hover { background: rgb(239, 40, 40); }
          &:active { transform: translateY(1px); }
        `;
      case 'ghost':
        return `
          background: transparent;
          color: rgb(var(--color-text-secondary));
          &:hover { background: rgb(var(--color-background)); color: rgb(var(--color-text-primary)); }
        `;
      default: // secondary
        return `
          background: rgb(var(--color-background));
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));
          &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    &:hover { transform: none; }
  }
`;

/**
 * Primary Button - Convenience wrapper for Button with $variant="primary"
 */
export const PrimaryButton = styled(Button).attrs({ $variant: 'primary' as const })``;

/**
 * Secondary Button - Convenience wrapper for Button with $variant="secondary"
 */
export const SecondaryButton = styled(Button).attrs({ $variant: 'secondary' as const })``;

/**
 * Danger Button - Convenience wrapper for Button with $variant="danger"
 */
export const DangerButton = styled(Button).attrs({ $variant: 'danger' as const })``;

/**
 * Add Button - Button for adding items
 */
export const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--color-border));
  background: white;
  color: rgb(var(--color-text-primary));
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    color: rgb(var(--color-primary));
  }
`;

/**
 * Remove Button - Button for removing items (red)
 */
export const RemoveButton = styled.button`
  padding: 4px;
  border: none;
  background: transparent;
  color: rgb(var(--color-error));
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(var(--color-error), 0.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

// ============================================================================
// Validation & Messages
// ============================================================================

/**
 * Error Message - Validation error display
 */
export const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(var(--color-error), 0.1);
  border: 1px solid rgba(var(--color-error), 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-error));
  font-size: 14px;
  margin-bottom: 16px;
  
  svg {
    flex-shrink: 0;
  }
`;

/**
 * Warning Message - Warning display
 */
export const WarningMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(var(--color-warning), 0.1);
  border: 1px solid rgba(var(--color-warning), 0.3);
  border-radius: var(--radius-md);
  color: rgb(var(--color-warning));
  font-size: 14px;
  margin-bottom: 16px;
  
  svg {
    flex-shrink: 0;
  }
`;

// ============================================================================
// Empty State
// ============================================================================

/**
 * Empty State - Display when no data
 */
export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
`;

/**
 * Empty Icon - Large emoji/icon for empty state
 */
export const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
`;

/**
 * Empty Text - Text for empty state
 */
export const EmptyText = styled.div`
  font-weight: 500;
  margin-bottom: 8px;
  color: rgb(var(--color-text-primary));
`;

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Setting Row - Row for settings toggle/switch
 */
export const SettingRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgb(var(--color-border));
  
  &:last-child {
    border-bottom: none;
  }
`;

/**
 * Setting Info - Info column in setting row
 */
export const SettingInfo = styled.div`
  flex: 1;
`;

/**
 * Setting Label - Label in setting row
 */
export const SettingLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

/**
 * Setting Description - Description in setting row
 */
export const SettingDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;
