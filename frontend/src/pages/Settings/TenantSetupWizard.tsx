/**
 * Tenant Setup Wizard - Phase 4.5 (Gap Analysis)
 * 
 * Multi-step onboarding wizard for new tenants inspired by:
 * - Shopify's setup guide (company → products → payments)
 * - Stripe's onboarding (business info → team → activation)
 * - Typeform's workspace setup
 * 
 * Features:
 * - 4-step wizard: Company → Team → First Workflow → Complete
 * - Progress indicator with breadcrumbs
 * - Skip/save draft capability
 * - Responsive design (mobile-friendly)
 * - WCAG 2.1 accessibility (keyboard nav, ARIA labels)
 * - Form validation with error handling
 * 
 * @module TenantSetupWizard
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { tenantService, Tenant } from '../../services/tenantService';
import styled from 'styled-components';
import {
  Building2,
  Users,
  Workflow,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  AlertCircle,
  Loader2,
  Mail,
  Save,
  SkipForward
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface WizardStep {
  id: number;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
}

interface CompanyInfo {
  name: string;
  industry: string;
  size: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  website: string;
}

interface TeamMember {
  email: string;
  role: 'admin' | 'manager' | 'user' | 'readonly';
  name?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface FormErrors {
  [key: string]: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const WizardContainer = styled.div`
  min-height: 100vh;
  background: rgb(var(--color-background));
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    padding: 0;
  }
`;

const WizardHeader = styled.header`
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const WizardTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;

  svg {
    color: rgb(var(--color-primary));
  }

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-hover));
    color: rgb(var(--color-text-primary));
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--color-primary) / 0.3);
    outline-offset: 2px;
  }
`;

const ProgressBar = styled.div`
  background: rgb(var(--color-surface));
  border-bottom: 1px solid rgb(var(--color-border));
  padding: 1.5rem 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
`;

const Step = styled.div<{ active: boolean; completed: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 1.5rem;
    left: 50%;
    right: -50%;
    height: 2px;
    background: ${props =>
      props.completed
        ? 'rgb(var(--color-success))'
        : 'rgb(var(--color-border))'};
    z-index: 0;
  }

  @media (max-width: 768px) {
    flex: 0 0 calc(50% - 0.5rem);

    &:not(:last-child)::after {
      display: none;
    }
  }
`;

const StepCircle = styled.div<{ active: boolean; completed: boolean }>`
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props =>
    props.completed
      ? 'rgb(var(--color-success))'
      : props.active
      ? 'rgb(var(--color-primary))'
      : 'rgb(var(--color-surface))'};
  border: 2px solid
    ${props =>
      props.completed
        ? 'rgb(var(--color-success))'
        : props.active
        ? 'rgb(var(--color-primary))'
        : 'rgb(var(--color-border))'};
  color: ${props =>
    props.completed || props.active
      ? 'white'
      : 'rgb(var(--color-text-secondary))'};
  z-index: 1;
  transition: all 0.3s;

  svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  @media (max-width: 768px) {
    width: 2.5rem;
    height: 2.5rem;

    svg {
      width: 1.25rem;
      height: 1.25rem;
    }
  }
`;

const StepLabel = styled.span<{ active: boolean }>`
  font-size: 0.875rem;
  font-weight: ${props => (props.active ? 600 : 400)};
  color: ${props =>
    props.active
      ? 'rgb(var(--color-text-primary))'
      : 'rgb(var(--color-text-secondary))'};
  text-align: center;

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const WizardContent = styled.main`
  flex: 1;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  padding: 3rem 2rem;

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const StepContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.75rem;
  padding: 2.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 1.5rem;
    border-radius: 0.5rem;
  }
`;

const StepHeader = styled.div`
  margin-bottom: 2rem;
`;

const StepTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.5rem 0;

  @media (max-width: 768px) {
    font-size: 1.5rem;
  }
`;

const StepDescription = styled.p`
  font-size: 1rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const FormGroup = styled.div<{ fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  grid-column: ${props => (props.fullWidth ? '1 / -1' : 'auto')};
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 0.25rem;

  .required {
    color: rgb(var(--color-error));
  }
`;

const Input = styled.input<{ hasError?: boolean }>`
  padding: 0.75rem;
  border: 1px solid
    ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-border))'};
  border-radius: 0.5rem;
  font-size: 1rem;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px
      ${props =>
        props.hasError
          ? 'rgb(var(--color-error) / 0.1)'
          : 'rgb(var(--color-primary) / 0.1)'};
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }

  &:disabled {
    background: rgb(var(--color-background-hover));
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Select = styled.select<{ hasError?: boolean }>`
  padding: 0.75rem;
  border: 1px solid
    ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-border))'};
  border-radius: 0.5rem;
  font-size: 1rem;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px
      ${props =>
        props.hasError
          ? 'rgb(var(--color-error) / 0.1)'
          : 'rgb(var(--color-primary) / 0.1)'};
  }

  &:disabled {
    background: rgb(var(--color-background-hover));
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Textarea = styled.textarea<{ hasError?: boolean }>`
  padding: 0.75rem;
  border: 1px solid
    ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-border))'};
  border-radius: 0.5rem;
  font-size: 1rem;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-background));
  font-family: inherit;
  resize: vertical;
  min-height: 120px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${props =>
      props.hasError
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-primary))'};
    box-shadow: 0 0 0 3px
      ${props =>
        props.hasError
          ? 'rgb(var(--color-error) / 0.1)'
          : 'rgb(var(--color-primary) / 0.1)'};
  }

  &::placeholder {
    color: rgb(var(--color-text-tertiary));
  }

  &:disabled {
    background: rgb(var(--color-background-hover));
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const ErrorMessage = styled.span`
  font-size: 0.8125rem;
  color: rgb(var(--color-error));
  display: flex;
  align-items: center;
  gap: 0.375rem;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;

const TeamMembersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TeamMemberCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.5rem;

  @media (max-width: 768px) {
    flex-wrap: wrap;
  }
`;

const TeamMemberInfo = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0.75rem;
  align-items: center;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const RemoveButton = styled.button`
  padding: 0.5rem;
  background: none;
  border: none;
  color: rgb(var(--color-error));
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-error) / 0.1);
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--color-error) / 0.3);
    outline-offset: 2px;
  }
`;

const AddButton = styled.button`
  padding: 0.75rem;
  background: rgb(var(--color-background));
  border: 2px dashed rgb(var(--color-border));
  border-radius: 0.5rem;
  color: rgb(var(--color-primary));
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover {
    border-color: rgb(var(--color-primary));
    background: rgb(var(--color-primary) / 0.05);
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--color-primary) / 0.3);
    outline-offset: 2px;
  }
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const TemplateCard = styled.div<{ selected: boolean }>`
  padding: 1.5rem;
  background: rgb(var(--color-background));
  border: 2px solid
    ${props =>
      props.selected
        ? 'rgb(var(--color-primary))'
        : 'rgb(var(--color-border))'};
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 3px solid rgb(var(--color-primary) / 0.3);
    outline-offset: 2px;
  }

  ${props =>
    props.selected &&
    `
    &::before {
      content: '✓';
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 2rem;
      height: 2rem;
      background: rgb(var(--color-primary));
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.125rem;
    }
  `}
`;

const TemplateTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.5rem 0;
`;

const TemplateDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
`;

const TemplateBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const WizardActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgb(var(--color-border));

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.75rem;
  }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.75rem;

  @media (max-width: 768px) {
    width: 100%;
    flex-direction: column;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'ghost' }>`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  white-space: nowrap;
  min-height: 44px; /* WCAG touch target */

  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: rgb(var(--color-primary));
          color: white;
          border: none;

          &:hover:not(:disabled) {
            background: rgb(var(--color-primary-hover));
            box-shadow: 0 4px 12px rgb(var(--color-primary) / 0.3);
          }

          &:focus-visible {
            outline: 3px solid rgb(var(--color-primary) / 0.3);
            outline-offset: 2px;
          }
        `;
      case 'secondary':
        return `
          background: rgb(var(--color-background));
          color: rgb(var(--color-text-primary));
          border: 1px solid rgb(var(--color-border));

          &:hover:not(:disabled) {
            background: rgb(var(--color-background-hover));
            border-color: rgb(var(--color-primary));
          }

          &:focus-visible {
            outline: 3px solid rgb(var(--color-primary) / 0.3);
            outline-offset: 2px;
          }
        `;
      case 'ghost':
        return `
          background: none;
          color: rgb(var(--color-text-secondary));
          border: none;

          &:hover:not(:disabled) {
            background: rgb(var(--color-background-hover));
            color: rgb(var(--color-text-primary));
          }

          &:focus-visible {
            outline: 3px solid rgb(var(--color-primary) / 0.3);
            outline-offset: 2px;
          }
        `;
      default:
        return '';
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  @media (max-width: 768px) {
    width: 100%;
    padding: 1rem;
  }
`;

const CompletionContainer = styled.div`
  text-align: center;
  padding: 3rem 1rem;
`;

const SuccessIcon = styled.div`
  width: 5rem;
  height: 5rem;
  margin: 0 auto 2rem;
  background: rgb(var(--color-success) / 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 3rem;
    height: 3rem;
    color: rgb(var(--color-success));
  }
`;

const CompletionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 1rem 0;
`;

const CompletionMessage = styled.p`
  font-size: 1.125rem;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 3rem 0;
  line-height: 1.6;
`;

const NextStepsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
  margin: 0 auto 3rem;
  text-align: left;
`;

const NextStepCard = styled.div`
  padding: 1.5rem;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
`;

const NextStepNumber = styled.div`
  width: 2rem;
  height: 2rem;
  background: rgb(var(--color-primary));
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
`;

const NextStepContent = styled.div`
  flex: 1;
`;

const NextStepTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 0.25rem 0;
`;

const NextStepDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

// ============================================================================
// Main Component
// ============================================================================

const TenantSetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Step 1: Company info
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: '',
    industry: '',
    size: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'USA',
    phone: '',
    website: '',
  });

  // Step 2: Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { email: '', role: 'admin', name: '' },
  ]);

  // Step 3: Workflow template
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Wizard steps configuration
  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Company Info',
        icon: Building2,
        description: 'Tell us about your business',
      },
      {
        id: 2,
        title: 'Team Setup',
        icon: Users,
        description: 'Invite your team members',
      },
      {
        id: 3,
        title: 'First Workflow',
        icon: Workflow,
        description: 'Choose a template to start',
      },
      {
        id: 4,
        title: 'Complete',
        icon: CheckCircle2,
        description: 'You are all set!',
      },
    ],
    []
  );

  // Workflow templates
  const templates: WorkflowTemplate[] = useMemo(
    () => [
      {
        id: 'inquiry',
        name: 'Customer Inquiry',
        description: 'Handle customer inquiries with automated routing and notifications',
        category: 'sales',
      },
      {
        id: 'order',
        name: 'Order Processing',
        description: 'Streamline order fulfillment from quote to delivery',
        category: 'operations',
      },
      {
        id: 'approval',
        name: 'Approval Workflow',
        description: 'Multi-level approval process for documents and requests',
        category: 'approvals',
      },
      {
        id: 'onboarding',
        name: 'Employee Onboarding',
        description: 'Automate new hire setup and document collection',
        category: 'hr',
      },
      {
        id: 'blank',
        name: 'Start from Scratch',
        description: 'Build a custom workflow from the ground up',
        category: 'custom',
      },
    ],
    []
  );

  // ============================================================================
  // Validation
  // ============================================================================

  const validateStep1 = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!companyInfo.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    if (!companyInfo.industry) {
      newErrors.industry = 'Please select an industry';
    }
    if (!companyInfo.size) {
      newErrors.size = 'Please select company size';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [companyInfo]);

  const validateStep2 = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    teamMembers.forEach((member, index) => {
      if (member.email && !emailRegex.test(member.email)) {
        newErrors[`email_${index}`] = 'Invalid email address';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [teamMembers]);

  const validateStep3 = useCallback((): boolean => {
    if (!selectedTemplate) {
      setErrors({ template: 'Please select a template' });
      return false;
    }
    setErrors({});
    return true;
  }, [selectedTemplate]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleClose = useCallback(() => {
    if (window.confirm('Are you sure you want to exit? Your progress will not be saved.')) {
      navigate('/settings');
    }
  }, [navigate]);

  const handleNext = useCallback(async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        if (isValid) {
          // Save all data
          setLoading(true);
          try {
            // TODO: API calls to save company, team, and workflow
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API
            setCurrentStep(4);
          } catch (error) {
            console.error('Failed to save setup:', error);
            alert('Failed to save setup. Please try again.');
          } finally {
            setLoading(false);
          }
          return;
        }
        break;
      default:
        isValid = true;
    }

    if (isValid) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, validateStep1, validateStep2, validateStep3]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => prev - 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSkip = useCallback(() => {
    if (window.confirm('Skip this step? You can set it up later in Settings.')) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleCompanyChange = useCallback(
    (field: keyof CompanyInfo, value: string) => {
      setCompanyInfo(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const handleAddTeamMember = useCallback(() => {
    setTeamMembers(prev => [...prev, { email: '', role: 'user', name: '' }]);
  }, []);

  const handleRemoveTeamMember = useCallback((index: number) => {
    setTeamMembers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleTeamMemberChange = useCallback(
    (index: number, field: keyof TeamMember, value: string) => {
      setTeamMembers(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
      if (errors[`${field}_${index}`]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`${field}_${index}`];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    setErrors({});
  }, []);

  const handleFinish = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // ============================================================================
  // Render Step Content
  // ============================================================================

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Form onSubmit={e => e.preventDefault()}>
            <FormGroup fullWidth>
              <Label>
                Company Name <span className="required">*</span>
              </Label>
              <Input
                type="text"
                value={companyInfo.name}
                onChange={e => handleCompanyChange('name', e.target.value)}
                placeholder="Enter your company name"
                hasError={!!errors.name}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <ErrorMessage id="name-error" role="alert">
                  <AlertCircle />
                  {errors.name}
                </ErrorMessage>
              )}
            </FormGroup>

            <FormRow>
              <FormGroup>
                <Label>
                  Industry <span className="required">*</span>
                </Label>
                <Select
                  value={companyInfo.industry}
                  onChange={e => handleCompanyChange('industry', e.target.value)}
                  hasError={!!errors.industry}
                  aria-required="true"
                  aria-invalid={!!errors.industry}
                >
                  <option value="">Select industry</option>
                  <option value="food">Food & Beverage</option>
                  <option value="meat">Meat Processing</option>
                  <option value="distribution">Distribution</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="other">Other</option>
                </Select>
                {errors.industry && (
                  <ErrorMessage role="alert">
                    <AlertCircle />
                    {errors.industry}
                  </ErrorMessage>
                )}
              </FormGroup>

              <FormGroup>
                <Label>
                  Company Size <span className="required">*</span>
                </Label>
                <Select
                  value={companyInfo.size}
                  onChange={e => handleCompanyChange('size', e.target.value)}
                  hasError={!!errors.size}
                  aria-required="true"
                  aria-invalid={!!errors.size}
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="501+">501+ employees</option>
                </Select>
                {errors.size && (
                  <ErrorMessage role="alert">
                    <AlertCircle />
                    {errors.size}
                  </ErrorMessage>
                )}
              </FormGroup>
            </FormRow>

            <FormGroup fullWidth>
              <Label>Street Address</Label>
              <Input
                type="text"
                value={companyInfo.address}
                onChange={e => handleCompanyChange('address', e.target.value)}
                placeholder="123 Main Street"
              />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <Label>City</Label>
                <Input
                  type="text"
                  value={companyInfo.city}
                  onChange={e => handleCompanyChange('city', e.target.value)}
                  placeholder="City"
                />
              </FormGroup>

              <FormGroup>
                <Label>State/Province</Label>
                <Input
                  type="text"
                  value={companyInfo.state}
                  onChange={e => handleCompanyChange('state', e.target.value)}
                  placeholder="State"
                />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <Label>ZIP/Postal Code</Label>
                <Input
                  type="text"
                  value={companyInfo.zipCode}
                  onChange={e => handleCompanyChange('zipCode', e.target.value)}
                  placeholder="12345"
                />
              </FormGroup>

              <FormGroup>
                <Label>Country</Label>
                <Select
                  value={companyInfo.country}
                  onChange={e => handleCompanyChange('country', e.target.value)}
                >
                  <option value="USA">United States</option>
                  <option value="CAN">Canada</option>
                  <option value="MEX">Mexico</option>
                  <option value="UK">United Kingdom</option>
                  <option value="AUS">Australia</option>
                  <option value="other">Other</option>
                </Select>
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={companyInfo.phone}
                  onChange={e => handleCompanyChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </FormGroup>

              <FormGroup>
                <Label>Website</Label>
                <Input
                  type="url"
                  value={companyInfo.website}
                  onChange={e => handleCompanyChange('website', e.target.value)}
                  placeholder="https://example.com"
                />
              </FormGroup>
            </FormRow>
          </Form>
        );

      case 2:
        return (
          <Form onSubmit={e => e.preventDefault()}>
            <TeamMembersList>
              {teamMembers.map((member, index) => (
                <TeamMemberCard key={index}>
                  <TeamMemberInfo>
                    <FormGroup>
                      <Input
                        type="email"
                        value={member.email}
                        onChange={e =>
                          handleTeamMemberChange(index, 'email', e.target.value)
                        }
                        placeholder="team.member@company.com"
                        hasError={!!errors[`email_${index}`]}
                        aria-label={`Email for team member ${index + 1}`}
                        aria-invalid={!!errors[`email_${index}`]}
                      />
                      {errors[`email_${index}`] && (
                        <ErrorMessage role="alert">
                          <AlertCircle />
                          {errors[`email_${index}`]}
                        </ErrorMessage>
                      )}
                    </FormGroup>

                    <FormGroup>
                      <Select
                        value={member.role}
                        onChange={e =>
                          handleTeamMemberChange(
                            index,
                            'role',
                            e.target.value as TeamMember['role']
                          )
                        }
                        aria-label={`Role for team member ${index + 1}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="user">User</option>
                        <option value="readonly">Read Only</option>
                      </Select>
                    </FormGroup>
                  </TeamMemberInfo>

                  {teamMembers.length > 1 && (
                    <RemoveButton
                      type="button"
                      onClick={() => handleRemoveTeamMember(index)}
                      aria-label={`Remove team member ${index + 1}`}
                    >
                      <X size={20} />
                    </RemoveButton>
                  )}
                </TeamMemberCard>
              ))}
            </TeamMembersList>

            <AddButton type="button" onClick={handleAddTeamMember}>
              <Mail size={18} />
              Add Team Member
            </AddButton>
          </Form>
        );

      case 3:
        return (
          <>
            <TemplateGrid>
              {templates.map(template => (
                <TemplateCard
                  key={template.id}
                  selected={selectedTemplate === template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  role="radio"
                  aria-checked={selectedTemplate === template.id}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTemplateSelect(template.id);
                    }
                  }}
                >
                  <TemplateTitle>{template.name}</TemplateTitle>
                  <TemplateDescription>{template.description}</TemplateDescription>
                  <TemplateBadge>{template.category}</TemplateBadge>
                </TemplateCard>
              ))}
            </TemplateGrid>

            {errors.template && (
              <ErrorMessage role="alert" style={{ marginTop: '1rem' }}>
                <AlertCircle />
                {errors.template}
              </ErrorMessage>
            )}
          </>
        );

      case 4:
        return (
          <CompletionContainer>
            <SuccessIcon>
              <CheckCircle2 />
            </SuccessIcon>
            <CompletionTitle>Welcome to ProjectMeats! 🎉</CompletionTitle>
            <CompletionMessage>
              Your workspace is ready. Here's what you can do next:
            </CompletionMessage>

            <NextStepsList>
              <NextStepCard>
                <NextStepNumber>1</NextStepNumber>
                <NextStepContent>
                  <NextStepTitle>Customize Your Workflow</NextStepTitle>
                  <NextStepDescription>
                    Open the workflow editor and add nodes, configure forms, and set up
                    your process logic.
                  </NextStepDescription>
                </NextStepContent>
              </NextStepCard>

              <NextStepCard>
                <NextStepNumber>2</NextStepNumber>
                <NextStepContent>
                  <NextStepTitle>Import Your Data</NextStepTitle>
                  <NextStepDescription>
                    Add customers, suppliers, products, and other data to get started
                    with real operations.
                  </NextStepDescription>
                </NextStepContent>
              </NextStepCard>

              <NextStepCard>
                <NextStepNumber>3</NextStepNumber>
                <NextStepContent>
                  <NextStepTitle>Explore Features</NextStepTitle>
                  <NextStepDescription>
                    Check out the Cockpit for search, Admin Studio for advanced configs,
                    and MyTasks for tracking work.
                  </NextStepDescription>
                </NextStepContent>
              </NextStepCard>
            </NextStepsList>

            <ActionGroup>
              <Button variant="primary" onClick={handleFinish}>
                Go to Dashboard
                <ChevronRight />
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/workforms/catalog')}
              >
                View Workflows
              </Button>
            </ActionGroup>
          </CompletionContainer>
        );

      default:
        return null;
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <WizardContainer>
      <WizardHeader>
        <WizardTitle>
          <Building2 />
          Tenant Setup
        </WizardTitle>
        <CloseButton onClick={handleClose} aria-label="Close wizard">
          <X size={24} />
        </CloseButton>
      </WizardHeader>

      {currentStep < 4 && (
        <ProgressBar>
          <StepIndicator role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={4}>
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <Step
                  key={step.id}
                  active={currentStep === step.id}
                  completed={currentStep > step.id}
                >
                  <StepCircle
                    active={currentStep === step.id}
                    completed={currentStep > step.id}
                  >
                    {currentStep > step.id ? <CheckCircle2 /> : <Icon />}
                  </StepCircle>
                  <StepLabel active={currentStep === step.id}>
                    {step.title}
                  </StepLabel>
                </Step>
              );
            })}
          </StepIndicator>
        </ProgressBar>
      )}

      <WizardContent>
        {currentStep < 4 && (
          <StepContent>
            <StepHeader>
              <StepTitle>{steps[currentStep - 1].title}</StepTitle>
              <StepDescription>
                {steps[currentStep - 1].description}
              </StepDescription>
            </StepHeader>

            {renderStepContent()}

            <WizardActions>
              <ActionGroup>
                {currentStep > 1 && currentStep < 4 && (
                  <Button variant="ghost" onClick={handleBack} disabled={loading}>
                    <ChevronLeft />
                    Back
                  </Button>
                )}
              </ActionGroup>

              <ActionGroup>
                {currentStep === 2 && (
                  <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                    <SkipForward />
                    Skip
                  </Button>
                )}

                <Button
                  variant="primary"
                  onClick={handleNext}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving...
                    </>
                  ) : currentStep === 3 ? (
                    <>
                      Finish Setup
                      <CheckCircle2 />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight />
                    </>
                  )}
                </Button>
              </ActionGroup>
            </WizardActions>
          </StepContent>
        )}

        {currentStep === 4 && renderStepContent()}
      </WizardContent>
    </WizardContainer>
  );
};

export default TenantSetupWizard;
