/**
 * Tests for TutorialTooltip component.
 * Includes property-based tests and unit tests.
 *
 * Feature: in-app-tutorial
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fc from 'fast-check';
import { TutorialTooltip } from '../components/editor/TutorialTooltip';
import { TUTORIAL_STEPS, type TutorialStep, type TutorialModule } from '../lib/tutorial/tutorialSteps';

// ---- Helpers ----

function makeDOMRect(x = 100, y = 100, width = 200, height = 80): DOMRect {
  return {
    x, y, width, height,
    top: y, left: x, right: x + width, bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

const defaultStep = TUTORIAL_STEPS[0];
const defaultRect = makeDOMRect();
const totalSteps = TUTORIAL_STEPS.length;

function renderTooltip(overrides: Partial<{
  step: TutorialStep;
  spotlightRect: DOMRect;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}> = {}) {
  const props = {
    step: defaultStep,
    spotlightRect: defaultRect,
    stepNumber: 1,
    totalSteps,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
  return render(<TutorialTooltip {...props} />);
}

// ---- Arbitraries ----

const MODULES: TutorialModule[] = [
  'Getting Started', 'Timeline Editing', 'BPM & Tempo Sync',
  'Time-Stretch & Pitch', 'Multi-Cam Sync', 'Video Speed',
  'Waveform Visualization', 'Metronome Overlay', 'Recording',
  'Export', 'Project Saving',
];

// Non-empty, non-whitespace-only strings (testing-library normalizes whitespace)
const arbNonBlankString = (maxLength: number) =>
  fc.string({ minLength: 1, maxLength }).filter((s) => s.trim().length > 0);

const arbTutorialStep = fc.record<TutorialStep>({
  id: arbNonBlankString(20),
  module: fc.constantFrom(...MODULES),
  targetSelector: arbNonBlankString(30),
  title: arbNonBlankString(60),
  body: arbNonBlankString(200),
  tooltipPlacement: fc.constantFrom('below' as const, 'above' as const, 'left' as const, 'right' as const),
});

const arbDOMRect = fc.record({
  x: fc.integer({ min: 0, max: 800 }),
  y: fc.integer({ min: 0, max: 600 }),
  width: fc.integer({ min: 50, max: 300 }),
  height: fc.integer({ min: 30, max: 200 }),
}).map(({ x, y, width, height }) => makeDOMRect(x, y, width, height));

// ---- Property 7: Tooltip content completeness ----
// Feature: in-app-tutorial, Property 7
// Validates: Requirements 3.1, 3.5, 3.6

describe('Property 7: Tooltip content completeness', () => {
  it('rendered output contains title, body, module name, and "Step N of M" string', () => {
    fc.assert(
      fc.property(
        arbTutorialStep,
        arbDOMRect,
        fc.integer({ min: 1, max: 50 }).chain((total) =>
          fc.integer({ min: 1, max: total }).map((n) => ({ n, total }))
        ),
        (step, spotlightRect, { n, total }) => {
          const { unmount, container } = render(
            <TutorialTooltip
              step={step}
              spotlightRect={spotlightRect}
              stepNumber={n}
              totalSteps={total}
              onNext={vi.fn()}
              onBack={vi.fn()}
              onSkip={vi.fn()}
            />
          );

          const text = container.textContent ?? '';
          const normalizedText = text.replace(/\s+/g, ' ');

          // Title is present (use trimmed match to handle whitespace edge cases)
          expect(normalizedText).toContain(step.title.trim().replace(/\s+/g, ' '));
          // Body is present
          expect(normalizedText).toContain(step.body.trim().replace(/\s+/g, ' '));
          // Module label is present
          expect(normalizedText).toContain(step.module);
          // Step counter "Step N of M" — now includes mode label, check for the numeric part
          expect(normalizedText).toContain(`Step ${n} of ${total}`);

          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---- Property 6: Navigation state consistency ----
// Feature: in-app-tutorial, Property 6
// Validates: Requirements 3.4

describe('Property 6: Navigation state consistency', () => {
  it('Back is disabled iff stepNumber === 1; button label is "Finish" iff stepNumber === totalSteps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 60 }).chain((total) =>
          fc.integer({ min: 1, max: total }).map((n) => ({ n, total }))
        ),
        ({ n, total }) => {
          const { unmount, container } = render(
            <TutorialTooltip
              step={defaultStep}
              spotlightRect={defaultRect}
              stepNumber={n}
              totalSteps={total}
              onNext={vi.fn()}
              onBack={vi.fn()}
              onSkip={vi.fn()}
            />
          );

          const view = within(container);
          const backBtn = view.getByRole('button', { name: 'Back' });
          const nextBtn = view.getByRole('button', { name: n === total ? 'Finish' : 'Next' });

          // Back disabled iff first step
          if (n === 1) {
            expect(backBtn).toBeDisabled();
          } else {
            expect(backBtn).not.toBeDisabled();
          }

          // Next reads "Finish" iff last step
          if (n === total) {
            expect(nextBtn.textContent).toBe('Finish');
          } else {
            expect(nextBtn.textContent).toBe('Next');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Unit tests for TutorialTooltip (task 9.3) ----

describe('TutorialTooltip unit tests', () => {
  it('calls onSkip when "Skip Tutorial" is clicked', () => {
    const onSkip = vi.fn();
    renderTooltip({ onSkip });
    fireEvent.click(screen.getByRole('button', { name: 'Skip Tutorial' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onSkip when Escape key is pressed on the container', () => {
    const onSkip = vi.fn();
    const { container } = renderTooltip({ onSkip });
    const tooltipDiv = container.firstChild as HTMLElement;
    fireEvent.keyDown(tooltipDiv, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('Back button is disabled on step 1', () => {
    renderTooltip({ stepNumber: 1 });
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('Back button is enabled on step 2+', () => {
    renderTooltip({ stepNumber: 2, totalSteps: 5 });
    expect(screen.getByRole('button', { name: 'Back' })).not.toBeDisabled();
  });

  it('Next button reads "Finish" on the last step', () => {
    renderTooltip({ stepNumber: totalSteps, totalSteps });
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  });

  it('Next button reads "Next" on non-last steps', () => {
    renderTooltip({ stepNumber: 1, totalSteps: 5 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('calls onNext when Next button is clicked', () => {
    const onNext = vi.fn();
    renderTooltip({ onNext, stepNumber: 1, totalSteps: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onBack when Back button is clicked (not first step)', () => {
    const onBack = vi.fn();
    renderTooltip({ onBack, stepNumber: 2, totalSteps: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders module label, title, and body', () => {
    renderTooltip();
    expect(screen.getByText(defaultStep.module)).toBeTruthy();
    expect(screen.getByText(defaultStep.title)).toBeTruthy();
    expect(screen.getByText(defaultStep.body)).toBeTruthy();
  });

  it('renders step counter "Step N of M"', () => {
    const { container } = renderTooltip({ stepNumber: 3, totalSteps: 10 });
    // Counter now includes mode label: "Quick Tour · Step 3 of 10" — check via textContent
    expect(container.textContent).toContain('Step 3 of 10');
  });

  it('tooltip container has tabIndex -1 for focus management', () => {
    const { container } = renderTooltip();
    const tooltipDiv = container.firstChild as HTMLElement;
    expect(tooltipDiv.getAttribute('tabindex')).toBe('-1');
  });

  it('tooltip has position fixed style', () => {
    const { container } = renderTooltip();
    const tooltipDiv = container.firstChild as HTMLElement;
    expect(tooltipDiv.style.position).toBe('fixed');
  });

  it('tooltip has z-index 10000', () => {
    const { container } = renderTooltip();
    const tooltipDiv = container.firstChild as HTMLElement;
    expect(tooltipDiv.style.zIndex).toBe('10000');
  });
});
