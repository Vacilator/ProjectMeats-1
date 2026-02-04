/**
 * Flow Templates Library
 * Phase 2.5 - Templates Library
 * Created: 2026-02-04
 */

import { Node, Edge } from '@xyflow/react';

export type TemplateCategory = 
  | 'forms'
  | 'approvals'
  | 'onboarding'
  | 'orders'
  | 'documents';

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  estimatedSetupTime: string;
  thumbnail: string;
  tags: string[];
  popularity: number;
  nodes: Node[];
  edges: Edge[];
  variables: TemplateVariable[];
  optionalExtensions: string[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  // ========================================
  // FORMS (5 templates)
  // ========================================
  {
    id: 'simple-contact-form',
    name: 'Simple Contact Form',
    description: 'Basic contact form with email notification',
    category: 'forms',
    difficulty: 'beginner',
    estimatedSetupTime: '2 minutes',
    thumbnail: '📝',
    tags: ['contact', 'email', 'simple'],
    popularity: 950,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Form Submitted', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Contact Information',
          config: {
            fields: [
              { name: 'name', label: 'Full Name', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'phone', label: 'Phone', type: 'tel', required: false },
              { name: 'message', label: 'Message', type: 'textarea', required: true },
            ],
          },
        },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 350 },
        data: {
          label: 'Send Notification',
          config: {
            to: 'admin@example.com',
            subject: 'New Contact Form Submission',
            template: 'contact_notification',
          },
        },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 500 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-email' },
      { id: 'e3', source: 'node-email', target: 'node-end' },
    ],
    variables: [
      { key: 'admin_email', label: 'Admin Email', type: 'email', required: true, placeholder: 'admin@example.com' },
    ],
    optionalExtensions: ['Add SMS notification', 'Save to database', 'Send auto-reply'],
  },
  {
    id: 'multi-step-survey',
    name: 'Multi-Step Survey',
    description: 'Survey with multiple pages and conditional logic',
    category: 'forms',
    difficulty: 'beginner',
    estimatedSetupTime: '5 minutes',
    thumbnail: '📋',
    tags: ['survey', 'multi-step', 'feedback'],
    popularity: 820,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Start Survey', config: {} },
      },
      {
        id: 'node-step1',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Basic Information',
          config: {
            fields: [
              { name: 'age_range', label: 'Age Range', type: 'select', required: true, options: ['18-24', '25-34', '35-44', '45+'] },
              { name: 'occupation', label: 'Occupation', type: 'text', required: false },
            ],
          },
        },
      },
      {
        id: 'node-step2',
        type: 'formStep',
        position: { x: 100, y: 350 },
        data: {
          label: 'Feedback',
          config: {
            fields: [
              { name: 'satisfaction', label: 'Overall Satisfaction', type: 'rating', required: true, max: 5 },
              { name: 'comments', label: 'Additional Comments', type: 'textarea', required: false },
            ],
          },
        },
      },
      {
        id: 'node-save',
        type: 'actionCreateRecord',
        position: { x: 100, y: 500 },
        data: { label: 'Save Response', config: { entity: 'SurveyResponse' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 650 },
        data: { label: 'Thank You', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-step1' },
      { id: 'e2', source: 'node-step1', target: 'node-step2' },
      { id: 'e3', source: 'node-step2', target: 'node-save' },
      { id: 'e4', source: 'node-save', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Add branching questions', 'Email results', 'Analytics dashboard'],
  },
  {
    id: 'customer-feedback-rating',
    name: 'Customer Feedback with Rating',
    description: 'Collect customer feedback with star rating',
    category: 'forms',
    difficulty: 'beginner',
    estimatedSetupTime: '3 minutes',
    thumbnail: '⭐',
    tags: ['feedback', 'rating', 'customer'],
    popularity: 730,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Start Feedback', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Feedback Form',
          config: {
            fields: [
              { name: 'rating', label: 'Rate Your Experience', type: 'rating', required: true, max: 5 },
              { name: 'feedback', label: 'Tell us more', type: 'textarea', required: false },
            ],
          },
        },
      },
      {
        id: 'node-condition',
        type: 'conditionIf',
        position: { x: 100, y: 350 },
        data: {
          label: 'Check Rating',
          config: { condition: 'rating <= 2' },
        },
      },
      {
        id: 'node-notify',
        type: 'actionNotify',
        position: { x: 250, y: 500 },
        data: { label: 'Alert Manager', config: { urgency: 'high', role: 'manager' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 650 },
        data: { label: 'Thank You', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-condition' },
      { id: 'e3', source: 'node-condition', target: 'node-notify', label: 'Low Rating' },
      { id: 'e4', source: 'node-condition', target: 'node-end', label: 'Good Rating' },
      { id: 'e5', source: 'node-notify', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Follow-up email', 'CRM integration', 'Sentiment analysis'],
  },
  {
    id: 'job-application-upload',
    name: 'Job Application with File Upload',
    description: 'Job application form with resume upload',
    category: 'forms',
    difficulty: 'intermediate',
    estimatedSetupTime: '10 minutes',
    thumbnail: '💼',
    tags: ['hr', 'recruitment', 'upload'],
    popularity: 650,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Start Application', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Application Form',
          config: {
            fields: [
              { name: 'name', label: 'Full Name', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'phone', label: 'Phone', type: 'tel', required: true },
              { name: 'position', label: 'Position', type: 'select', required: true },
              { name: 'resume', label: 'Resume (PDF)', type: 'file', required: true },
              { name: 'cover_letter', label: 'Cover Letter', type: 'textarea', required: false },
            ],
          },
        },
      },
      {
        id: 'node-save',
        type: 'actionCreateRecord',
        position: { x: 100, y: 400 },
        data: { label: 'Save Application', config: { entity: 'JobApplication' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 550 },
        data: {
          label: 'Send Confirmation',
          config: { to: '{{email}}', subject: 'Application Received', template: 'application_confirmation' },
        },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 700 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-save' },
      { id: 'e3', source: 'node-save', target: 'node-email' },
      { id: 'e4', source: 'node-email', target: 'node-end' },
    ],
    variables: [
      { key: 'hr_email', label: 'HR Email', type: 'email', required: true, placeholder: 'hr@example.com' },
    ],
    optionalExtensions: ['Notify HR team', 'Schedule interview', 'ATS integration'],
  },
  {
    id: 'dynamic-quote-request',
    name: 'Dynamic Quote Request',
    description: 'Quote request with dynamic pricing calculation',
    category: 'forms',
    difficulty: 'intermediate',
    estimatedSetupTime: '15 minutes',
    thumbnail: '💰',
    tags: ['sales', 'quote', 'pricing'],
    popularity: 580,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Request Quote', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Quote Details',
          config: {
            fields: [
              { name: 'product', label: 'Product', type: 'select', required: true },
              { name: 'quantity', label: 'Quantity', type: 'number', required: true },
              { name: 'delivery_date', label: 'Delivery Date', type: 'date', required: true },
            ],
          },
        },
      },
      {
        id: 'node-transform',
        type: 'dataTransform',
        position: { x: 100, y: 350 },
        data: {
          label: 'Calculate Price',
          config: { expression: 'quantity * product.unit_price' },
        },
      },
      {
        id: 'node-document',
        type: 'documentGenerate',
        position: { x: 100, y: 500 },
        data: { label: 'Generate Quote', config: { template: 'quote_template' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 650 },
        data: {
          label: 'Send Quote',
          config: { to: '{{customer.email}}', subject: 'Your Quote', attachments: ['quote.pdf'] },
        },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 800 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-transform' },
      { id: 'e3', source: 'node-transform', target: 'node-document' },
      { id: 'e4', source: 'node-document', target: 'node-email' },
      { id: 'e5', source: 'node-email', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Volume discounts', 'Approval workflow', 'CRM integration'],
  },

  // ========================================
  // APPROVALS (4 templates)
  // ========================================
  {
    id: 'single-level-approval',
    name: 'Single-Level Approval',
    description: 'Simple one-person approval workflow',
    category: 'approvals',
    difficulty: 'beginner',
    estimatedSetupTime: '5 minutes',
    thumbnail: '✅',
    tags: ['approval', 'simple', 'manager'],
    popularity: 890,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Submit Request', config: {} },
      },
      {
        id: 'node-approval',
        type: 'pendingApproval',
        position: { x: 100, y: 250 },
        data: {
          label: 'Manager Approval',
          config: { assignTo: 'manager', sla: '2 business days' },
        },
      },
      {
        id: 'node-approved',
        type: 'actionNotify',
        position: { x: 250, y: 400 },
        data: { label: 'Notify Approved', config: { to: 'submitter' } },
      },
      {
        id: 'node-rejected',
        type: 'actionNotify',
        position: { x: -50, y: 400 },
        data: { label: 'Notify Rejected', config: { to: 'submitter' } },
      },
      {
        id: 'node-end-approved',
        type: 'endSuccess',
        position: { x: 250, y: 550 },
        data: { label: 'Approved', config: {} },
      },
      {
        id: 'node-end-rejected',
        type: 'endCancel',
        position: { x: -50, y: 550 },
        data: { label: 'Rejected', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-approval' },
      { id: 'e2', source: 'node-approval', target: 'node-approved', label: 'Approved' },
      { id: 'e3', source: 'node-approval', target: 'node-rejected', label: 'Rejected' },
      { id: 'e4', source: 'node-approved', target: 'node-end-approved' },
      { id: 'e5', source: 'node-rejected', target: 'node-end-rejected' },
    ],
    variables: [],
    optionalExtensions: ['Add comments', 'Escalation rules', 'Email notifications'],
  },
  {
    id: 'sequential-approval',
    name: 'Sequential Multi-Level Approval',
    description: 'Multiple approvers in sequence (Manager → Director → VP)',
    category: 'approvals',
    difficulty: 'intermediate',
    estimatedSetupTime: '10 minutes',
    thumbnail: '🔁',
    tags: ['approval', 'multi-level', 'sequential'],
    popularity: 710,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Submit Request', config: {} },
      },
      {
        id: 'node-manager',
        type: 'pendingApproval',
        position: { x: 100, y: 250 },
        data: { label: 'Manager Approval', config: { assignTo: 'manager' } },
      },
      {
        id: 'node-director',
        type: 'pendingApproval',
        position: { x: 100, y: 400 },
        data: { label: 'Director Approval', config: { assignTo: 'director' } },
      },
      {
        id: 'node-vp',
        type: 'pendingApproval',
        position: { x: 100, y: 550 },
        data: { label: 'VP Approval', config: { assignTo: 'vp' } },
      },
      {
        id: 'node-approved',
        type: 'actionNotify',
        position: { x: 100, y: 700 },
        data: { label: 'Notify All Approved', config: {} },
      },
      {
        id: 'node-rejected',
        type: 'actionNotify',
        position: { x: -100, y: 400 },
        data: { label: 'Notify Rejected', config: {} },
      },
      {
        id: 'node-end-approved',
        type: 'endSuccess',
        position: { x: 100, y: 850 },
        data: { label: 'Approved', config: {} },
      },
      {
        id: 'node-end-rejected',
        type: 'endCancel',
        position: { x: -100, y: 550 },
        data: { label: 'Rejected', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-manager' },
      { id: 'e2', source: 'node-manager', target: 'node-director', label: 'Approved' },
      { id: 'e3', source: 'node-manager', target: 'node-rejected', label: 'Rejected' },
      { id: 'e4', source: 'node-director', target: 'node-vp', label: 'Approved' },
      { id: 'e5', source: 'node-director', target: 'node-rejected', label: 'Rejected' },
      { id: 'e6', source: 'node-vp', target: 'node-approved', label: 'Approved' },
      { id: 'e7', source: 'node-vp', target: 'node-rejected', label: 'Rejected' },
      { id: 'e8', source: 'node-approved', target: 'node-end-approved' },
      { id: 'e9', source: 'node-rejected', target: 'node-end-rejected' },
    ],
    variables: [],
    optionalExtensions: ['Skip level based on amount', 'Delegate authority', 'Audit trail'],
  },
  {
    id: 'parallel-approval',
    name: 'Parallel Approval (Multiple Approvers)',
    description: 'All approvers review simultaneously',
    category: 'approvals',
    difficulty: 'intermediate',
    estimatedSetupTime: '15 minutes',
    thumbnail: '⚡',
    tags: ['approval', 'parallel', 'committee'],
    popularity: 620,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 200, y: 100 },
        data: { label: 'Submit for Committee Review', config: {} },
      },
      {
        id: 'node-finance',
        type: 'pendingApproval',
        position: { x: 50, y: 250 },
        data: { label: 'Finance Approval', config: { assignTo: 'finance_team' } },
      },
      {
        id: 'node-legal',
        type: 'pendingApproval',
        position: { x: 200, y: 250 },
        data: { label: 'Legal Approval', config: { assignTo: 'legal_team' } },
      },
      {
        id: 'node-operations',
        type: 'pendingApproval',
        position: { x: 350, y: 250 },
        data: { label: 'Operations Approval', config: { assignTo: 'ops_team' } },
      },
      {
        id: 'node-merge',
        type: 'dataMerge',
        position: { x: 200, y: 400 },
        data: { label: 'Check All Approved', config: {} },
      },
      {
        id: 'node-approved',
        type: 'actionNotify',
        position: { x: 200, y: 550 },
        data: { label: 'Notify Approved', config: {} },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 200, y: 700 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-finance' },
      { id: 'e2', source: 'node-start', target: 'node-legal' },
      { id: 'e3', source: 'node-start', target: 'node-operations' },
      { id: 'e4', source: 'node-finance', target: 'node-merge' },
      { id: 'e5', source: 'node-legal', target: 'node-merge' },
      { id: 'e6', source: 'node-operations', target: 'node-merge' },
      { id: 'e7', source: 'node-merge', target: 'node-approved' },
      { id: 'e8', source: 'node-approved', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Majority rule', 'Veto power', 'Weighted voting'],
  },
  {
    id: 'conditional-approval',
    name: 'Conditional Approval (Amount-Based Routing)',
    description: 'Approval path depends on request amount',
    category: 'approvals',
    difficulty: 'advanced',
    estimatedSetupTime: '20 minutes',
    thumbnail: '🔀',
    tags: ['approval', 'conditional', 'routing'],
    popularity: 540,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 200, y: 100 },
        data: { label: 'Submit Request', config: {} },
      },
      {
        id: 'node-switch',
        type: 'conditionSwitch',
        position: { x: 200, y: 250 },
        data: {
          label: 'Route by Amount',
          config: {
            cases: [
              { condition: 'amount < 1000', label: 'Low' },
              { condition: 'amount < 10000', label: 'Medium' },
              { condition: 'amount >= 10000', label: 'High' },
            ],
          },
        },
      },
      {
        id: 'node-manager',
        type: 'pendingApproval',
        position: { x: 50, y: 400 },
        data: { label: 'Manager', config: { assignTo: 'manager' } },
      },
      {
        id: 'node-director',
        type: 'pendingApproval',
        position: { x: 200, y: 400 },
        data: { label: 'Director', config: { assignTo: 'director' } },
      },
      {
        id: 'node-cfo',
        type: 'pendingApproval',
        position: { x: 350, y: 400 },
        data: { label: 'CFO', config: { assignTo: 'cfo' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 200, y: 550 },
        data: { label: 'Approved', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-switch' },
      { id: 'e2', source: 'node-switch', target: 'node-manager', label: '< $1K' },
      { id: 'e3', source: 'node-switch', target: 'node-director', label: '$1K-$10K' },
      { id: 'e4', source: 'node-switch', target: 'node-cfo', label: '> $10K' },
      { id: 'e5', source: 'node-manager', target: 'node-end' },
      { id: 'e6', source: 'node-director', target: 'node-end' },
      { id: 'e7', source: 'node-cfo', target: 'node-end' },
    ],
    variables: [
      { key: 'low_threshold', label: 'Low Threshold', type: 'number', required: true, placeholder: '1000' },
      { key: 'high_threshold', label: 'High Threshold', type: 'number', required: true, placeholder: '10000' },
    ],
    optionalExtensions: ['Budget codes', 'Department routing', 'Urgent flag'],
  },

  // ========================================
  // ONBOARDING (3 templates)
  // ========================================
  {
    id: 'customer-onboarding',
    name: 'New Customer Onboarding',
    description: 'Complete customer onboarding workflow',
    category: 'onboarding',
    difficulty: 'intermediate',
    estimatedSetupTime: '15 minutes',
    thumbnail: '🎉',
    tags: ['customer', 'onboarding', 'crm'],
    popularity: 690,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'New Customer Signup', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Company Information',
          config: {
            fields: [
              { name: 'company_name', label: 'Company Name', type: 'text', required: true },
              { name: 'contact_name', label: 'Contact Name', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'phone', label: 'Phone', type: 'tel', required: true },
            ],
          },
        },
      },
      {
        id: 'node-create',
        type: 'actionCreateRecord',
        position: { x: 100, y: 350 },
        data: { label: 'Create Customer', config: { entity: 'Customer' } },
      },
      {
        id: 'node-welcome',
        type: 'actionEmail',
        position: { x: 100, y: 500 },
        data: {
          label: 'Send Welcome Email',
          config: { template: 'customer_welcome' },
        },
      },
      {
        id: 'node-notify',
        type: 'actionNotify',
        position: { x: 100, y: 650 },
        data: { label: 'Notify Sales Team', config: { role: 'sales' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 800 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-create' },
      { id: 'e3', source: 'node-create', target: 'node-welcome' },
      { id: 'e4', source: 'node-welcome', target: 'node-notify' },
      { id: 'e5', source: 'node-notify', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Credit check', 'Account setup', 'Assign sales rep'],
  },
  {
    id: 'supplier-onboarding',
    name: 'New Supplier Onboarding with Documents',
    description: 'Supplier registration with document collection',
    category: 'onboarding',
    difficulty: 'intermediate',
    estimatedSetupTime: '20 minutes',
    thumbnail: '📦',
    tags: ['supplier', 'onboarding', 'documents'],
    popularity: 610,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'New Supplier Registration', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Supplier Information',
          config: {
            fields: [
              { name: 'company_name', label: 'Company Name', type: 'text', required: true },
              { name: 'tax_id', label: 'Tax ID', type: 'text', required: true },
              { name: 'w9', label: 'W-9 Form', type: 'file', required: true },
              { name: 'certificate', label: 'Insurance Certificate', type: 'file', required: true },
            ],
          },
        },
      },
      {
        id: 'node-create',
        type: 'actionCreateRecord',
        position: { x: 100, y: 350 },
        data: { label: 'Create Supplier', config: { entity: 'Supplier' } },
      },
      {
        id: 'node-approval',
        type: 'pendingApproval',
        position: { x: 100, y: 500 },
        data: { label: 'Compliance Review', config: { assignTo: 'compliance_team' } },
      },
      {
        id: 'node-approved',
        type: 'actionEmail',
        position: { x: 250, y: 650 },
        data: { label: 'Welcome Email', config: { template: 'supplier_welcome' } },
      },
      {
        id: 'node-rejected',
        type: 'actionEmail',
        position: { x: -50, y: 650 },
        data: { label: 'Rejection Notice', config: { template: 'supplier_rejected' } },
      },
      {
        id: 'node-end-approved',
        type: 'endSuccess',
        position: { x: 250, y: 800 },
        data: { label: 'Approved', config: {} },
      },
      {
        id: 'node-end-rejected',
        type: 'endCancel',
        position: { x: -50, y: 800 },
        data: { label: 'Rejected', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-create' },
      { id: 'e3', source: 'node-create', target: 'node-approval' },
      { id: 'e4', source: 'node-approval', target: 'node-approved', label: 'Approved' },
      { id: 'e5', source: 'node-approval', target: 'node-rejected', label: 'Rejected' },
      { id: 'e6', source: 'node-approved', target: 'node-end-approved' },
      { id: 'e7', source: 'node-rejected', target: 'node-end-rejected' },
    ],
    variables: [],
    optionalExtensions: ['Payment terms setup', 'Portal access', 'Contract generation'],
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding Checklist',
    description: 'Complete new hire onboarding workflow',
    category: 'onboarding',
    difficulty: 'advanced',
    estimatedSetupTime: '30 minutes',
    thumbnail: '👤',
    tags: ['hr', 'employee', 'onboarding'],
    popularity: 520,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerEvent',
        position: { x: 100, y: 100 },
        data: { label: 'New Hire Created', config: { entity: 'Employee', event: 'created' } },
      },
      {
        id: 'node-it',
        type: 'pendingDocument',
        position: { x: 100, y: 250 },
        data: { label: 'IT Setup', config: { assignTo: 'it_team', documents: ['laptop', 'phone', 'access_badge'] } },
      },
      {
        id: 'node-hr',
        type: 'pendingDocument',
        position: { x: 100, y: 400 },
        data: { label: 'HR Documents', config: { assignTo: 'hr_team', documents: ['i9', 'w4', 'handbook'] } },
      },
      {
        id: 'node-training',
        type: 'pendingResponse',
        position: { x: 100, y: 550 },
        data: { label: 'Complete Training', config: { assignTo: 'employee', deadline: '7 days' } },
      },
      {
        id: 'node-notify',
        type: 'actionNotify',
        position: { x: 100, y: 700 },
        data: { label: 'Notify Manager', config: { message: 'Onboarding complete' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 850 },
        data: { label: 'Onboarding Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-it' },
      { id: 'e2', source: 'node-it', target: 'node-hr' },
      { id: 'e3', source: 'node-hr', target: 'node-training' },
      { id: 'e4', source: 'node-training', target: 'node-notify' },
      { id: 'e5', source: 'node-notify', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Benefits enrollment', 'Department intro', '30/60/90 check-ins'],
  },

  // ========================================
  // ORDERS (4 templates)
  // ========================================
  {
    id: 'purchase-order-approval',
    name: 'Purchase Order Request & Approval',
    description: 'PO creation with approval workflow',
    category: 'orders',
    difficulty: 'intermediate',
    estimatedSetupTime: '15 minutes',
    thumbnail: '📝',
    tags: ['purchase', 'approval', 'procurement'],
    popularity: 780,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Create PO Request', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'PO Details',
          config: {
            fields: [
              { name: 'supplier', label: 'Supplier', type: 'select', required: true },
              { name: 'items', label: 'Items', type: 'table', required: true },
              { name: 'total', label: 'Total Amount', type: 'number', required: true },
              { name: 'delivery_date', label: 'Required By', type: 'date', required: true },
            ],
          },
        },
      },
      {
        id: 'node-create',
        type: 'actionCreateRecord',
        position: { x: 100, y: 350 },
        data: { label: 'Create PO Draft', config: { entity: 'PurchaseOrder', status: 'pending' } },
      },
      {
        id: 'node-approval',
        type: 'pendingApproval',
        position: { x: 100, y: 500 },
        data: { label: 'Manager Approval', config: { assignTo: 'manager' } },
      },
      {
        id: 'node-approved',
        type: 'actionUpdateRecord',
        position: { x: 250, y: 650 },
        data: { label: 'Approve PO', config: { status: 'approved' } },
      },
      {
        id: 'node-rejected',
        type: 'actionUpdateRecord',
        position: { x: -50, y: 650 },
        data: { label: 'Reject PO', config: { status: 'rejected' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 250, y: 800 },
        data: { label: 'Send to Supplier', config: { template: 'po_approved' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 250, y: 950 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-create' },
      { id: 'e3', source: 'node-create', target: 'node-approval' },
      { id: 'e4', source: 'node-approval', target: 'node-approved', label: 'Approved' },
      { id: 'e5', source: 'node-approval', target: 'node-rejected', label: 'Rejected' },
      { id: 'e6', source: 'node-approved', target: 'node-email' },
      { id: 'e7', source: 'node-email', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Budget check', 'Three bids required', 'Inventory check'],
  },
  {
    id: 'quote-to-sales-order',
    name: 'Quote to Sales Order Conversion',
    description: 'Quote approval and SO creation',
    category: 'orders',
    difficulty: 'intermediate',
    estimatedSetupTime: '20 minutes',
    thumbnail: '💼',
    tags: ['sales', 'quote', 'order'],
    popularity: 670,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Quote Accepted', config: {} },
      },
      {
        id: 'node-create',
        type: 'actionCreateRecord',
        position: { x: 100, y: 250 },
        data: { label: 'Create Sales Order', config: { entity: 'SalesOrder', source: 'quote' } },
      },
      {
        id: 'node-document',
        type: 'documentGenerate',
        position: { x: 100, y: 400 },
        data: { label: 'Generate SO Confirmation', config: { template: 'so_confirmation' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 550 },
        data: { label: 'Send to Customer', config: { template: 'so_confirmation' } },
      },
      {
        id: 'node-notify',
        type: 'actionNotify',
        position: { x: 100, y: 700 },
        data: { label: 'Notify Fulfillment', config: { role: 'fulfillment_team' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 850 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-create' },
      { id: 'e2', source: 'node-create', target: 'node-document' },
      { id: 'e3', source: 'node-document', target: 'node-email' },
      { id: 'e4', source: 'node-email', target: 'node-notify' },
      { id: 'e5', source: 'node-notify', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Credit check', 'Inventory allocation', 'Shipping schedule'],
  },
  {
    id: 'order-fulfillment',
    name: 'Order Fulfillment Workflow',
    description: 'Complete order processing from pick to ship',
    category: 'orders',
    difficulty: 'advanced',
    estimatedSetupTime: '25 minutes',
    thumbnail: '🚚',
    tags: ['fulfillment', 'shipping', 'operations'],
    popularity: 590,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerEvent',
        position: { x: 100, y: 100 },
        data: { label: 'SO Approved', config: { entity: 'SalesOrder', event: 'status_changed', status: 'approved' } },
      },
      {
        id: 'node-pick',
        type: 'pendingResponse',
        position: { x: 100, y: 250 },
        data: { label: 'Pick Items', config: { assignTo: 'warehouse_team' } },
      },
      {
        id: 'node-pack',
        type: 'pendingResponse',
        position: { x: 100, y: 400 },
        data: { label: 'Pack & Label', config: { assignTo: 'warehouse_team' } },
      },
      {
        id: 'node-ship',
        type: 'actionUpdateRecord',
        position: { x: 100, y: 550 },
        data: { label: 'Ship Order', config: { status: 'shipped' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 700 },
        data: { label: 'Shipping Notification', config: { template: 'shipped_notification' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 850 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-pick' },
      { id: 'e2', source: 'node-pick', target: 'node-pack' },
      { id: 'e3', source: 'node-pack', target: 'node-ship' },
      { id: 'e4', source: 'node-ship', target: 'node-email' },
      { id: 'e5', source: 'node-email', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['QC inspection', 'Carrier integration', 'Delivery tracking'],
  },
  {
    id: 'return-refund',
    name: 'Return/Refund Processing',
    description: 'Handle customer returns and refunds',
    category: 'orders',
    difficulty: 'advanced',
    estimatedSetupTime: '20 minutes',
    thumbnail: '↩️',
    tags: ['returns', 'refund', 'customer service'],
    popularity: 480,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Return Request', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Return Details',
          config: {
            fields: [
              { name: 'order_number', label: 'Order Number', type: 'text', required: true },
              { name: 'reason', label: 'Reason', type: 'select', required: true },
              { name: 'photos', label: 'Photos', type: 'file', required: false },
            ],
          },
        },
      },
      {
        id: 'node-approval',
        type: 'pendingApproval',
        position: { x: 100, y: 350 },
        data: { label: 'CS Review', config: { assignTo: 'customer_service' } },
      },
      {
        id: 'node-approved',
        type: 'actionCreateRecord',
        position: { x: 250, y: 500 },
        data: { label: 'Create RMA', config: { entity: 'ReturnMerchandiseAuth' } },
      },
      {
        id: 'node-rejected',
        type: 'actionEmail',
        position: { x: -50, y: 500 },
        data: { label: 'Rejection Notice', config: { template: 'return_rejected' } },
      },
      {
        id: 'node-receive',
        type: 'pendingDocument',
        position: { x: 250, y: 650 },
        data: { label: 'Receive Return', config: { assignTo: 'warehouse' } },
      },
      {
        id: 'node-refund',
        type: 'actionHTTP',
        position: { x: 250, y: 800 },
        data: { label: 'Process Refund', config: { endpoint: '/payment/refund' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 250, y: 950 },
        data: { label: 'Refund Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-approval' },
      { id: 'e3', source: 'node-approval', target: 'node-approved', label: 'Approved' },
      { id: 'e4', source: 'node-approval', target: 'node-rejected', label: 'Rejected' },
      { id: 'e5', source: 'node-approved', target: 'node-receive' },
      { id: 'e6', source: 'node-receive', target: 'node-refund' },
      { id: 'e7', source: 'node-refund', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Restocking fee', 'Exchange option', 'Store credit'],
  },

  // ========================================
  // DOCUMENTS (4 templates)
  // ========================================
  {
    id: 'auto-invoice',
    name: 'Auto-Generate Invoice from Order',
    description: 'Create and email PDF invoice automatically',
    category: 'documents',
    difficulty: 'intermediate',
    estimatedSetupTime: '10 minutes',
    thumbnail: '🧾',
    tags: ['invoice', 'pdf', 'automation'],
    popularity: 850,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerEvent',
        position: { x: 100, y: 100 },
        data: { label: 'Order Shipped', config: { entity: 'SalesOrder', event: 'status_changed', status: 'shipped' } },
      },
      {
        id: 'node-document',
        type: 'documentGenerate',
        position: { x: 100, y: 250 },
        data: { label: 'Generate Invoice PDF', config: { template: 'invoice_template' } },
      },
      {
        id: 'node-save',
        type: 'documentStore',
        position: { x: 100, y: 400 },
        data: { label: 'Save to Order', config: { attach_to: 'SalesOrder' } },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 550 },
        data: { label: 'Email Invoice', config: { template: 'invoice_email', attachments: ['invoice.pdf'] } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 700 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-document' },
      { id: 'e2', source: 'node-document', target: 'node-save' },
      { id: 'e3', source: 'node-save', target: 'node-email' },
      { id: 'e4', source: 'node-email', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Payment link', 'Accounting sync', 'Reminders'],
  },
  {
    id: 'contract-signature',
    name: 'Contract Generation & Signature',
    description: 'Generate contract and collect e-signature',
    category: 'documents',
    difficulty: 'advanced',
    estimatedSetupTime: '25 minutes',
    thumbnail: '✍️',
    tags: ['contract', 'signature', 'legal'],
    popularity: 720,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Create Contract', config: {} },
      },
      {
        id: 'node-form',
        type: 'formStep',
        position: { x: 100, y: 200 },
        data: {
          label: 'Contract Details',
          config: {
            fields: [
              { name: 'party', label: 'Other Party', type: 'select', required: true },
              { name: 'type', label: 'Contract Type', type: 'select', required: true },
              { name: 'terms', label: 'Special Terms', type: 'textarea', required: false },
            ],
          },
        },
      },
      {
        id: 'node-document',
        type: 'documentGenerate',
        position: { x: 100, y: 350 },
        data: { label: 'Generate Contract', config: { template: 'contract_template' } },
      },
      {
        id: 'node-sign-internal',
        type: 'documentSign',
        position: { x: 100, y: 500 },
        data: { label: 'Internal Signature', config: { assignTo: 'manager' } },
      },
      {
        id: 'node-sign-external',
        type: 'documentSign',
        position: { x: 100, y: 650 },
        data: { label: 'External Signature', config: { assignTo: '{{party.contact_email}}' } },
      },
      {
        id: 'node-save',
        type: 'documentStore',
        position: { x: 100, y: 800 },
        data: { label: 'Save Signed Contract', config: { storage: 's3' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 950 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-form' },
      { id: 'e2', source: 'node-form', target: 'node-document' },
      { id: 'e3', source: 'node-document', target: 'node-sign-internal' },
      { id: 'e4', source: 'node-sign-internal', target: 'node-sign-external' },
      { id: 'e5', source: 'node-sign-external', target: 'node-save' },
      { id: 'e6', source: 'node-save', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Legal review', 'Expiration dates', 'Version control'],
  },
  {
    id: 'bulk-document-collection',
    name: 'Bulk Document Collection',
    description: 'Collect multiple documents from external party',
    category: 'documents',
    difficulty: 'intermediate',
    estimatedSetupTime: '15 minutes',
    thumbnail: '📎',
    tags: ['documents', 'collection', 'external'],
    popularity: 560,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerManual',
        position: { x: 100, y: 100 },
        data: { label: 'Request Documents', config: {} },
      },
      {
        id: 'node-email',
        type: 'actionEmail',
        position: { x: 100, y: 250 },
        data: { label: 'Send Request', config: { template: 'document_request' } },
      },
      {
        id: 'node-pending',
        type: 'pendingDocument',
        position: { x: 100, y: 400 },
        data: {
          label: 'Wait for Upload',
          config: {
            assignTo: '{{external_party.email}}',
            documents: ['w9', 'insurance', 'license'],
            deadline: '7 days',
          },
        },
      },
      {
        id: 'node-review',
        type: 'pendingApproval',
        position: { x: 100, y: 550 },
        data: { label: 'Review Documents', config: { assignTo: 'compliance' } },
      },
      {
        id: 'node-approved',
        type: 'actionNotify',
        position: { x: 250, y: 700 },
        data: { label: 'Notify Approved', config: {} },
      },
      {
        id: 'node-rejected',
        type: 'actionEmail',
        position: { x: -50, y: 700 },
        data: { label: 'Request Resubmission', config: { template: 'resubmit_request' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 250, y: 850 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-email' },
      { id: 'e2', source: 'node-email', target: 'node-pending' },
      { id: 'e3', source: 'node-pending', target: 'node-review' },
      { id: 'e4', source: 'node-review', target: 'node-approved', label: 'Approved' },
      { id: 'e5', source: 'node-review', target: 'node-rejected', label: 'Rejected' },
      { id: 'e6', source: 'node-approved', target: 'node-end' },
      { id: 'e7', source: 'node-rejected', target: 'node-pending' },
    ],
    variables: [
      { key: 'external_party', label: 'External Party', type: 'select', required: true },
    ],
    optionalExtensions: ['Reminders', 'Expiration tracking', 'Archive completed'],
  },
  {
    id: 'compliance-document-checklist',
    name: 'Compliance Document Checklist',
    description: 'Track and verify compliance documents',
    category: 'documents',
    difficulty: 'advanced',
    estimatedSetupTime: '30 minutes',
    thumbnail: '✅',
    tags: ['compliance', 'audit', 'tracking'],
    popularity: 490,
    nodes: [
      {
        id: 'node-start',
        type: 'triggerSchedule',
        position: { x: 100, y: 100 },
        data: { label: 'Annual Review', config: { schedule: '0 0 1 1 *' } },
      },
      {
        id: 'node-loop',
        type: 'loopForEach',
        position: { x: 100, y: 250 },
        data: { label: 'For Each Supplier', config: { collection: 'suppliers' } },
      },
      {
        id: 'node-check',
        type: 'conditionIf',
        position: { x: 100, y: 400 },
        data: { label: 'Documents Expired?', config: { condition: 'expiration_date < now()' } },
      },
      {
        id: 'node-request',
        type: 'actionEmail',
        position: { x: 250, y: 550 },
        data: { label: 'Request Update', config: { template: 'document_renewal' } },
      },
      {
        id: 'node-pending',
        type: 'pendingDocument',
        position: { x: 250, y: 700 },
        data: { label: 'Wait for Upload', config: { deadline: '30 days' } },
      },
      {
        id: 'node-merge',
        type: 'dataMerge',
        position: { x: 100, y: 850 },
        data: { label: 'Continue Loop', config: {} },
      },
      {
        id: 'node-report',
        type: 'documentGenerate',
        position: { x: 100, y: 1000 },
        data: { label: 'Generate Report', config: { template: 'compliance_report' } },
      },
      {
        id: 'node-end',
        type: 'endSuccess',
        position: { x: 100, y: 1150 },
        data: { label: 'Complete', config: {} },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-start', target: 'node-loop' },
      { id: 'e2', source: 'node-loop', target: 'node-check' },
      { id: 'e3', source: 'node-check', target: 'node-request', label: 'Expired' },
      { id: 'e4', source: 'node-check', target: 'node-merge', label: 'Current' },
      { id: 'e5', source: 'node-request', target: 'node-pending' },
      { id: 'e6', source: 'node-pending', target: 'node-merge' },
      { id: 'e7', source: 'node-merge', target: 'node-loop' },
      { id: 'e8', source: 'node-loop', target: 'node-report', label: 'Done' },
      { id: 'e9', source: 'node-report', target: 'node-end' },
    ],
    variables: [],
    optionalExtensions: ['Escalation to manager', 'Dashboard view', 'Audit trail'],
  },
];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  forms: 'Forms & Data Collection',
  approvals: 'Approval Workflows',
  onboarding: 'Onboarding Processes',
  orders: 'Order Management',
  documents: 'Document Generation',
};

export const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  forms: '📝',
  approvals: '✅',
  onboarding: '🎉',
  orders: '📦',
  documents: '📄',
};
