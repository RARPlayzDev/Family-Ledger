import { useEffect, useState } from 'react';

/** Tailwind-aligned breakpoints used for layout decisions in JS. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);

    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', handleChange);
      return () => list.removeEventListener('change', handleChange);
    }
    // Older Android WebViews only expose the deprecated API.
    list.addListener(handleChange);
    return () => list.removeListener(handleChange);
  }, [query]);

  return matches;
}

/** true on viewports where the sidebar layout is used. */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
