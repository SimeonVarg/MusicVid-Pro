'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useTutorialController } from '@/lib/hooks/useTutorialController';
import { TutorialTooltip } from '@/components/editor/TutorialTooltip';

export function TutorialOverlay(): React.ReactElement | null {
  const tutorialActive = useEditorStore((s) => s.tutorialActive);
  const goToNextStep = useEditorStore((s) => s.goToNextStep);
  const goToPreviousStep = useEditorStore((s) => s.goToPreviousStep);
  const exitTutorial = useEditorStore((s) => s.exitTutorial);
  const resumeTutorial = useEditorStore((s) => s.resumeTutorial);
  const pauseTutorial = useEditorStore((s) => s.pauseTutorial);
  const completeTutorial = useEditorStore((s) => s.completeTutorial);

  const [pausePromptOpen, setPausePromptOpen] = useState(false);

  const { currentStep, spotlightRect, totalSteps, currentStepNumber } =
    useTutorialController();

  // Global Escape key listener — pause the tutorial and show resume/exit prompt
  useEffect(() => {
    if (!tutorialActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pauseTutorial();
        setPausePromptOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tutorialActive, pauseTutorial]);

  if (!tutorialActive && !pausePromptOpen) return null;

  const isLastStep = currentStepNumber === totalSteps;

  function handleNext() {
    if (isLastStep) {
      completeTutorial();
    } else {
      goToNextStep();
    }
  }

  function handleSkip() {
    setPausePromptOpen(false);
    exitTutorial();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* ARIA live region — announces step changes to screen readers */}
      {currentStep && (
        <span aria-live="polite" className="sr-only">
          {currentStep.title} — {currentStep.module}
        </span>
      )}

      {/* SVG spotlight mask */}
      {tutorialActive && spotlightRect ? (
        <svg
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlightRect.x}
                y={spotlightRect.y}
                width={spotlightRect.width}
                height={spotlightRect.height}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tutorial-spotlight-mask)"
          />
        </svg>
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}

      {/* Tooltip */}
      {tutorialActive && currentStep && spotlightRect && (
        <TutorialTooltip
          step={currentStep}
          spotlightRect={spotlightRect}
          stepNumber={currentStepNumber}
          totalSteps={totalSteps}
          onNext={handleNext}
          onBack={goToPreviousStep}
          onSkip={handleSkip}
        />
      )}

      {/* Escape pause prompt */}
      {pausePromptOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 w-80 text-zinc-100">
            <h3 className="font-bold text-base mb-2">Tutorial paused</h3>
            <p className="text-sm text-zinc-400 mb-4">Would you like to resume or exit the tutorial?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setPausePromptOpen(false); exitTutorial(); }}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Exit Tutorial
              </button>
              <button
                onClick={() => { setPausePromptOpen(false); resumeTutorial(); }}
                className="text-sm px-3 py-1.5 rounded-lg bg-signal-400 text-zinc-950 hover:bg-signal-300 transition-colors font-medium"
              >
                Resume Tutorial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
