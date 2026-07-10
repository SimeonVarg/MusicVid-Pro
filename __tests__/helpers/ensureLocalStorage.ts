/**
 * Ensure a working localStorage exists BEFORE the editor store is imported.
 * zustand's persist middleware resolves (and caches) its storage at store
 * creation, so this must run first — import it above the store import.
 */
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  const mem: Record<string, string> = {};
  const mock = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = String(v); },
    removeItem: (k: string) => { delete mem[k]; },
    clear: () => { for (const k of Object.keys(mem)) delete mem[k]; },
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
}

export {};
