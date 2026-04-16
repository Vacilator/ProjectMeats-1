/**
 * Report Bug Button Component
 * 
 * Reusable button that opens GitHub issues with pre-filled error details.
 * 
 * Extracted from: AdminErrorBoundary.tsx (handleReportBug method)
 * Created: 2026-02-19
 * 
 * Features:
 * - Auto-fills GitHub issue template with error details
 * - Includes page URL, userAgent, timestamp, and logged-in user
 * - Supports optional error prop (Error object or string)
 * - Follows ProjectMeats design system styling
 * - Can be used standalone or within error boundaries
 */

import React from 'react';
import styled from 'styled-components';
import { Bug } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ReportBugButtonProps {
  /** Error object or error message string (optional) */
  error?: Error | string | null;
  
  /** Button variant style */
  variant?: 'primary' | 'secondary' | 'floating';
  
  /** Custom button text (default: "Report Bug") */
  label?: string;
  
  /** Show icon (default: true) */
  showIcon?: boolean;
  
  /** Additional context to include in bug report */
  context?: string;
  
  /** Custom className for styling */
  className?: string;
  
  /** GitHub assignee username (default: "copilot") */
  assignee?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user info from localStorage or auth context
 */
const getCurrentUser = (): string => {
  try {
    // Try to get user from localStorage (adjust based on your auth implementation)
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.email || user.username || 'Unknown User';
    }
  } catch (e) {
    console.error('Failed to get current user:', e);
  }
  return 'Not logged in';
};

/**
 * Generate detailed bug report body
 */
const generateBugReportBody = (
  error: Error | string | null | undefined,
  context?: string
): string => {
  const timestamp = new Date().toISOString();
  const pageUrl = window.location.href;
  const userAgent = navigator.userAgent;
  const currentUser = getCurrentUser();
  
  let errorMessage = 'No error provided';
  let errorStack = 'No stack trace available';
  
  if (error) {
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack || 'No stack trace available';
    }
  }
  
  // Build markdown template
  const body = `
## Bug Report

**Timestamp:** ${timestamp}  
**Reported by:** ${currentUser}  
**Page URL:** ${pageUrl}  
**User Agent:** ${userAgent}

---

### Error Details

**Message:**
\`\`\`
${errorMessage}
\`\`\`

**Stack Trace:**
\`\`\`
${errorStack}
\`\`\`

${context ? `### Additional Context\n\n${context}\n\n---\n` : ''}

### Steps to Reproduce

1. Navigate to the page where error occurred
2. [Add specific steps that triggered the error]

### Expected Behavior

[Describe what should have happened]

### Actual Behavior

[Describe what actually happened - error was thrown]

---

**Auto-generated bug report from ProjectMeats application**
`.trim();
  
  return body;
};

/**
 * Generate GitHub issue URL with pre-filled data
 */
const generateGitHubIssueUrl = (
  error: Error | string | null | undefined,
  context?: string,
  assignee: string = 'copilot'
): string => {
  const errorMessage = error
    ? (typeof error === 'string' ? error : error.message)
    : 'Application Error';
  
  const title = `Bug: ${errorMessage.substring(0, 80)}${errorMessage.length > 80 ? '...' : ''}`;
  const body = generateBugReportBody(error, context);
  
  const params = new URLSearchParams({
    title,
    body,
    labels: 'bug,needs-triage',
    assignees: assignee,
  });
  
  return `https://github.com/Meats-Central/ProjectMeats/issues/new?${params.toString()}`;
};

// ============================================================================
// Component
// ============================================================================

export const ReportBugButton: React.FC<ReportBugButtonProps> = ({
  error,
  variant = 'secondary',
  label = 'Report Bug',
  showIcon = true,
  context,
  className,
  assignee = 'copilot',
}) => {
  const handleClick = () => {
    const url = generateGitHubIssueUrl(error, context, assignee);
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  // Render based on variant
  if (variant === 'floating') {
    return (
      <FloatingButton
        onClick={handleClick}
        className={className}
        title="Report a bug"
        aria-label="Report a bug"
      >
        <Bug size={20} />
      </FloatingButton>
    );
  }
  
  const ButtonComponent = variant === 'primary' ? PrimaryButton : SecondaryButton;
  
  return (
    <ButtonComponent onClick={handleClick} className={className}>
      {showIcon && <Bug size={18} />}
      <span>{label}</span>
    </ButtonComponent>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const BaseButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:not(:disabled):active {
    transform: translateY(0);
  }
`;

const PrimaryButton = styled(BaseButton)`
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  
  &:not(:disabled):hover {
    background: rgb(var(--color-primary-dark));
    transform: translateY(-1px);
  }
`;

const SecondaryButton = styled(BaseButton)`
  background: transparent;
  color: rgb(var(--color-text-primary));
  border: 1px solid rgb(var(--color-border));
  
  &:not(:disabled):hover {
    background: rgb(var(--color-bg-tertiary));
    border-color: rgb(var(--color-primary));
  }
`;

const FloatingButton = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgb(var(--color-primary));
  color: rgb(var(--color-primary-foreground));
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-float);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1000;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-float-hover);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  /* Responsive: smaller on mobile */
  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
    bottom: 16px;
    right: 16px;
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

// Default export for convenience
export default ReportBugButton;
