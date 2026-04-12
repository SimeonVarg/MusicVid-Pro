// lib/tutorial/tutorialPersistence.ts

import { TUTORIAL_STEPS, QUICK_TOUR_STEPS } from '@/lib/tutorial/tutorialSteps';

const TUTORIAL_KEY = 'mvp_tutorial_v1';

export type TutorialProgress = {
  stepIndex: number;
  completed: boolean;
  dismissed: boolean;
};

export function saveTutorialProgress(progress: TutorialProgress): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify(progress));
  } catch {
    // Silent failure — in-memory state remains correct
  }
}

export function loadTutorialProgress(): TutorialProgress | null {
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as TutorialProgress;
  } catch {
    return null;
  }
}

export function clearTutorialProgress(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    // Silent failure
  }
}

// ─── v2 schema ───────────────────────────────────────────────────────────────

export type TutorialMode = 'quick' | 'dev';

export type TutorialProgressV2 = {
  mode: TutorialMode;
  quickStepIndex: number;
  devStepIndex: number;
  quickCompleted: boolean;
  devCompleted: boolean;
  dismissed: boolean;
};

const TUTORIAL_KEY_V2 = 'mvp_tutorial_v2';

export function saveTutorialProgressV2(progress: TutorialProgressV2): void {
  try {
    localStorage.setItem(TUTORIAL_KEY_V2, JSON.stringify(progress));
  } catch {
    // Silent failure — in-memory state remains correct
  }
}

export function loadTutorialProgressV2(): TutorialProgressV2 | null {
  // 1. Try v2 key
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY_V2);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as TutorialProgressV2;
      const mode: TutorialMode =
        parsed.mode === 'quick' || parsed.mode === 'dev' ? parsed.mode : 'dev';
      return {
        mode,
        quickStepIndex:
          typeof parsed.quickStepIndex === 'number' &&
          parsed.quickStepIndex < QUICK_TOUR_STEPS.length
            ? parsed.quickStepIndex
            : 0,
        devStepIndex:
          typeof parsed.devStepIndex === 'number' &&
          parsed.devStepIndex < TUTORIAL_STEPS.length
            ? parsed.devStepIndex
            : 0,
        quickCompleted: Boolean(parsed.quickCompleted),
        devCompleted: Boolean(parsed.devCompleted),
        dismissed: Boolean(parsed.dismissed),
      };
    }
  } catch {
    // Fall through to v1 migration
  }

  // 2. Try v1 key and migrate — return null so buildInitialState shows the welcome dialog.
  //    The v1 data (step index, completion) is not worth migrating since the user
  //    needs to pick a mode anyway. They'll start fresh with the new mode selection.
  try {
    const rawV1 = localStorage.getItem(TUTORIAL_KEY);
    if (rawV1 !== null) {
      // v1 data exists but no v2 — treat as new user so welcome dialog shows
      return null;
    }
  } catch {
    // Fall through
  }

  // 3. Both absent or both failed
  return null;
}

export function clearTutorialProgressV2(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY_V2);
  } catch {
    // Silent failure
  }
}
