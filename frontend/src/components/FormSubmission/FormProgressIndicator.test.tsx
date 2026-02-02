/**
 * Tests for FormProgressIndicator component.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormProgressIndicator, { FormStep } from './FormProgressIndicator';

// Sample steps for testing
const mockSteps: FormStep[] = [
  { id: '1', name: 'Basic Info', order: 1, status: 'completed' },
  { id: '2', name: 'Details', order: 2, status: 'current' },
  { id: '3', name: 'Review', order: 3, status: 'pending' },
  { id: '4', name: 'Submit', order: 4, status: 'pending' },
];

describe('FormProgressIndicator', () => {
  describe('horizontal variant', () => {
    it('renders all steps', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="horizontal"
        />
      );

      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('shows step numbers when enabled', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="horizontal"
          showStepNumbers={true}
        />
      );

      // Step 2 and 3 should show numbers (pending steps)
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('hides labels when showLabels is false', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="horizontal"
          showLabels={false}
        />
      );

      expect(screen.queryByText('Basic Info')).not.toBeInTheDocument();
      expect(screen.queryByText('Details')).not.toBeInTheDocument();
    });
  });

  describe('vertical variant', () => {
    it('renders all steps vertically', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="vertical"
        />
      );

      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('shows "In progress..." for current step', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="vertical"
        />
      );

      expect(screen.getByText('In progress...')).toBeInTheDocument();
    });

    it('shows "Completed" for completed steps', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="vertical"
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows Optional badge for optional steps', () => {
      const stepsWithOptional: FormStep[] = [
        { id: '1', name: 'Required Step', order: 1, status: 'completed' },
        { id: '2', name: 'Optional Step', order: 2, status: 'pending', isOptional: true },
      ];

      render(
        <FormProgressIndicator
          steps={stepsWithOptional}
          currentStepIndex={0}
          variant="vertical"
        />
      );

      expect(screen.getByText('Optional')).toBeInTheDocument();
    });
  });

  describe('compact variant', () => {
    it('shows step count', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="compact"
        />
      );

      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    it('shows progress percentage', () => {
      render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="compact"
        />
      );

      // 1 of 4 completed = 25%
      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    it('calculates 0% when no steps completed', () => {
      const allPending: FormStep[] = mockSteps.map(s => ({ ...s, status: 'pending' as const }));
      
      render(
        <FormProgressIndicator
          steps={allPending}
          currentStepIndex={0}
          variant="compact"
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calculates 100% when all steps completed', () => {
      const allCompleted: FormStep[] = mockSteps.map(s => ({ ...s, status: 'completed' as const }));
      
      render(
        <FormProgressIndicator
          steps={allCompleted}
          currentStepIndex={3}
          variant="compact"
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('step statuses', () => {
    it('renders checkmark for completed steps', () => {
      const { container } = render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="horizontal"
        />
      );

      // Completed step should have SVG checkmark
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('renders error icon for error steps', () => {
      const stepsWithError: FormStep[] = [
        { id: '1', name: 'Step 1', order: 1, status: 'completed' },
        { id: '2', name: 'Step 2', order: 2, status: 'error' },
      ];

      render(
        <FormProgressIndicator
          steps={stepsWithError}
          currentStepIndex={1}
          variant="horizontal"
        />
      );

      expect(screen.getByText('!')).toBeInTheDocument();
    });

    it('renders dash for skipped steps', () => {
      const stepsWithSkipped: FormStep[] = [
        { id: '1', name: 'Step 1', order: 1, status: 'completed' },
        { id: '2', name: 'Step 2', order: 2, status: 'skipped' },
      ];

      render(
        <FormProgressIndicator
          steps={stepsWithSkipped}
          currentStepIndex={1}
          variant="horizontal"
        />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('renders with custom className', () => {
      const { container } = render(
        <FormProgressIndicator
          steps={mockSteps}
          currentStepIndex={1}
          variant="horizontal"
          className="custom-class"
        />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles single step', () => {
      const singleStep: FormStep[] = [
        { id: '1', name: 'Only Step', order: 1, status: 'current' },
      ];

      render(
        <FormProgressIndicator
          steps={singleStep}
          currentStepIndex={0}
          variant="horizontal"
        />
      );

      expect(screen.getByText('Only Step')).toBeInTheDocument();
    });

    it('handles many steps', () => {
      const manySteps: FormStep[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Step ${i + 1}`,
        order: i + 1,
        status: i < 5 ? 'completed' : 'pending',
      }));

      render(
        <FormProgressIndicator
          steps={manySteps}
          currentStepIndex={5}
          variant="compact"
        />
      );

      expect(screen.getByText('Step 6 of 10')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});
