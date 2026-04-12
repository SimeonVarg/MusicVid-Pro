// lib/hooks/useTutorialController.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { TUTORIAL_STEPS, QUICK_TOUR_STEPS, type TutorialStep } from '@/lib/tutorial/tutorialSteps';
import { saveTutorialProgress } from '@/lib/tutorial/tutorialPersistence';

export type TutorialControllerResult = {
  currentStep: TutorialStep | null;
  spotlightRect: DOMRect | null;
  totalSteps: number;
  currentStepNumber: number; // 1-based
};

export function useTutorialController(): TutorialControllerResult {
  const tutorialActive = useEditorStore((s) => s.tutorialActive);
  const tutorialCurrentStepIndex = useEditorStore((s) => s.tutorialCurrentStepIndex);
  const tutorialCompleted = useEditorStore((s) => s.tutorialCompleted);
  const tutorialDismissed = useEditorStore((s) => s.tutorialDismissed);
  const tutorialMode = useEditorStore((s) => s.tutorialMode);
  const goToNextStep = useEditorStore((s) => s.goToNextStep);

  const activeSteps = tutorialMode === 'quick' ? QUICK_TOUR_STEPS : TUTORIAL_STEPS;

  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const currentStep = tutorialActive
    ? (activeSteps[tutorialCurrentStepIndex] ?? null)
    : null;

  // Debounced localStorage write
  const schedulePersist = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveTutorialProgress({
        stepIndex: tutorialCurrentStepIndex,
        completed: tutorialCompleted,
        dismissed: tutorialDismissed,
      });
    }, 500);
  }, [tutorialCurrentStepIndex, tutorialCompleted, tutorialDismissed]);

  // Compute and set the spotlight rect from an element
  const computeRect = useCallback((element: Element) => {
    const rect = element.getBoundingClientRect();
    setSpotlightRect(rect);
  }, []);

  // Schedule a rect recompute within one rAF
  const scheduleRectUpdate = useCallback((element: Element) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      computeRect(element);
    });
  }, [computeRect]);

  useEffect(() => {
    // Persist step index changes
    if (tutorialActive) {
      schedulePersist();
    }
  }, [tutorialCurrentStepIndex, tutorialActive, schedulePersist]);

  useEffect(() => {
    // Clean up previous observer and rAF when step changes or tutorial deactivates
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [tutorialCurrentStepIndex, tutorialActive]);

  useEffect(() => {
    if (!tutorialActive || !currentStep) {
      setSpotlightRect(null);
      return;
    }

    const selector = `[data-tutorial="${currentStep.targetSelector}"]`;
    const element = document.querySelector(selector);

    if (!element) {
      console.warn(`[Tutorial] target not found: ${currentStep.targetSelector}`);
      goToNextStep();
      return;
    }

    // Check if element is in viewport
    const rect = element.getBoundingClientRect();
    const inViewport =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (!inViewport) {
      if (typeof (element as HTMLElement).scrollIntoView === 'function') {
        (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Wait one frame after scrolling before computing rect
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        computeRect(element);
      });
    } else {
      computeRect(element);
    }

    // Window resize listener — recompute within one rAF
    const onWindowResize = () => scheduleRectUpdate(element);
    window.addEventListener('resize', onWindowResize);

    // ResizeObserver on the target element
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => scheduleRectUpdate(element));
      ro.observe(element);
      observerRef.current = ro;
    }

    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [tutorialActive, tutorialCurrentStepIndex, currentStep, goToNextStep, computeRect, scheduleRectUpdate]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    currentStep,
    spotlightRect: tutorialActive ? spotlightRect : null,
    totalSteps: activeSteps.length,
    currentStepNumber: tutorialCurrentStepIndex + 1,
  };
}
