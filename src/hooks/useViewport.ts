import { useSyncExternalStore } from 'react';

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** Window height in CSS px. */
export function useWindowHeight(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerHeight);
}

/** True at 1024 px and wider, where the phone frame and demo panel show (PRD 5). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth >= 1024);
}
