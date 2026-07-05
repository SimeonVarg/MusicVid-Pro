'use client';

import { useEffect, useRef } from 'react';
import { TutorialStep } from '@/lib/tutorial/tutorialSteps';
import { computeTooltipPosition } from '@/lib/tutorial/tooltipPosition';
import { useEditorStore } from '@/stores/editorStore';

type TutorialTooltipProps = {
  step: TutorialStep;
  spotlightRect: DOMRect;
  stepNumber: number; // 1-based
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const TOOLTIP_SIZE = { width: 320, height: 180 };

export function TutorialTooltip({
  step,
  spotlightRect,
  stepNumber,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TutorialTooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tutorialMode = useEditorStore((s) => s.tutorialMode);

  useEffect(() => {
    containerRef.current?.focus();
  }, [step.id]);

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const pos = computeTooltipPosition(spotlightRect, TOOLTIP_SIZE, viewport, step.tooltipPlacement ?? 'below');

  const isFirst = stepNumber === 1;
  const isLast = stepNumber === totalSteps;
  const modeLabel = tutorialMode === 'quick' ? 'Quick Tour' : 'Dev Tour';

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onSkip();
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        width: TOOLTIP_SIZE.width,
        zIndex: 10000,
        pointerEvents: 'auto',
      }}
      className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 text-zinc-100 outline-none"
    >
      {/* Module label */}
      <p className="text-xs text-zinc-400 mb-1">{step.module}</p>

      {/* Step title */}
      <h3 className="font-bold text-sm mb-2">{step.title}</h3>

      {/* Body copy */}
      <p className="text-xs text-zinc-300 leading-relaxed mb-3">{step.body}</p>

      {/* Step counter + navigation */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500 shrink-0">
          {modeLabel} · Step {stepNumber} of {totalSteps}
        </span>

        <div className="flex items-center gap-2">
          <button
            tabIndex={1}
            onClick={onBack}
            disabled={isFirst}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          <button
            tabIndex={2}
            onClick={onNext}
            className="text-xs px-3 py-1.5 rounded-lg bg-signal-400 text-zinc-950 hover:bg-signal-300 transition-colors font-medium"
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>

      {/* Skip link */}
      <div className="mt-2 text-center">
        {isLast && tutorialMode === 'quick' ? (
          <p className="text-xs text-zinc-400">
            Quick Tour complete! Open the Dev Tour from the ? button for a deep dive.
          </p>
        ) : (
          <button
            tabIndex={3}
            onClick={onSkip}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
          >
            Skip Tutorial
          </button>
        )}
      </div>
    </div>
  );
}
