/**
 * tutorialSlice — tutorial overlay state.
 * Owns: active state, current step index, completion/dismissal flags, welcome prompt, tutorial mode.
 *
 * Initial state is hydrated from localStorage via loadTutorialProgressV2().
 * Stale step indices are reset to 0. Unknown mode values default to 'dev'.
 *
 * Action implementations live in stores/editorStore.ts.
 */
import { loadTutorialProgressV2, type TutorialMode } from '@/lib/tutorial/tutorialPersistence';
import { TUTORIAL_STEPS, QUICK_TOUR_STEPS } from '@/lib/tutorial/tutorialSteps';

export type { TutorialMode };

export interface TutorialState {
  tutorialActive: boolean;
  tutorialCurrentStepIndex: number;
  tutorialCompleted: boolean;
  tutorialDismissed: boolean;
  tutorialShowWelcome: boolean;
  // v2 mode fields
  tutorialMode: TutorialMode;
  tutorialQuickStepIndex: number;
  tutorialDevStepIndex: number;
}

export interface TutorialActions {
  startTutorial: () => void;
  resumeTutorial: () => void;
  pauseTutorial: () => void;
  exitTutorial: () => void;
  completeTutorial: () => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (index: number) => void;
  dismissWelcome: () => void;
  resetTutorialProgress: () => void;
  setTutorialMode: (mode: TutorialMode) => void;
}

function buildInitialState(): TutorialState {
  const saved = loadTutorialProgressV2();

  if (saved === null) {
    // New user (or no v2 key) — show welcome prompt, default to quick mode
    return {
      tutorialActive: false,
      tutorialCurrentStepIndex: 0,
      tutorialCompleted: false,
      tutorialDismissed: false,
      tutorialShowWelcome: true,
      tutorialMode: 'quick',
      tutorialQuickStepIndex: 0,
      tutorialDevStepIndex: 0,
    };
  }

  const mode = saved.mode;
  const quickIdx = Math.min(saved.quickStepIndex, Math.max(0, QUICK_TOUR_STEPS.length - 1));
  const devIdx = Math.min(saved.devStepIndex, Math.max(0, TUTORIAL_STEPS.length - 1));
  const currentStepIndex = mode === 'quick' ? quickIdx : devIdx;
  const completed = mode === 'quick' ? saved.quickCompleted : saved.devCompleted;

  return {
    tutorialActive: false,
    tutorialCurrentStepIndex: currentStepIndex,
    tutorialCompleted: completed,
    tutorialDismissed: saved.dismissed,
    tutorialShowWelcome: false,
    tutorialMode: mode,
    tutorialQuickStepIndex: quickIdx,
    tutorialDevStepIndex: devIdx,
  };
}

export const tutorialInitialState: TutorialState = buildInitialState();
