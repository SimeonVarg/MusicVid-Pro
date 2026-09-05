'use client';

import { useEffect, useState } from 'react';

/**
 * Matches Tailwind's `md` breakpoint (768px) so JS layout decisions and the
 * `hidden md:block` classes agree about what "mobile" means. Server render and
 * first client paint report `false` - the CSS classes cover that frame.
 */
export const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
