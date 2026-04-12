import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveTutorialProgress,
  loadTutorialProgress,
  clearTutorialProgress,
  type TutorialProgress,
} from '../lib/tutorial/tutorialPersistence';

const TUTORIAL_KEY = 'mvp_tutorial_v1';

// Minimal localStorage mock for environments where jsdom's localStorage is incomplete
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('tutorialPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('saveTutorialProgress', () => {
    it('writes progress to localStorage under the versioned key', () => {
      const progress: TutorialProgress = { stepIndex: 3, completed: false, dismissed: false };
      saveTutorialProgress(progress);
      expect(localStorage.getItem(TUTORIAL_KEY)).toBe(JSON.stringify(progress));
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveTutorialProgress({ stepIndex: 0, completed: false, dismissed: false })).not.toThrow();
    });
  });

  describe('loadTutorialProgress', () => {
    it('returns null when key is absent', () => {
      expect(loadTutorialProgress()).toBeNull();
    });

    it('returns the stored progress when key exists', () => {
      const progress: TutorialProgress = { stepIndex: 5, completed: false, dismissed: true };
      localStorage.setItem(TUTORIAL_KEY, JSON.stringify(progress));
      expect(loadTutorialProgress()).toEqual(progress);
    });

    it('returns null when stored value is invalid JSON', () => {
      localStorage.setItem(TUTORIAL_KEY, 'not-valid-json{');
      expect(loadTutorialProgress()).toBeNull();
    });

    it('returns null when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      expect(loadTutorialProgress()).toBeNull();
    });
  });

  describe('clearTutorialProgress', () => {
    it('removes the key from localStorage', () => {
      localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ stepIndex: 2, completed: false, dismissed: false }));
      clearTutorialProgress();
      expect(localStorage.getItem(TUTORIAL_KEY)).toBeNull();
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      expect(() => clearTutorialProgress()).not.toThrow();
    });
  });

  describe('round-trip', () => {
    it('save then load returns the same progress', () => {
      const progress: TutorialProgress = { stepIndex: 7, completed: true, dismissed: false };
      saveTutorialProgress(progress);
      expect(loadTutorialProgress()).toEqual(progress);
    });

    it('save then clear then load returns null', () => {
      saveTutorialProgress({ stepIndex: 1, completed: false, dismissed: false });
      clearTutorialProgress();
      expect(loadTutorialProgress()).toBeNull();
    });
  });
});
