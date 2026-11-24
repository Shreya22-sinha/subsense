import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/dataStore';

const query = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** 'light' | 'dark' after applying the user's preference (System when signed out). */
export function useResolvedTheme(): 'light' | 'dark' {
  const signedIn = useAuthStore((s) => s.sessionUserId !== null);
  const pref = useDataStore((s) => s.profile.theme);
  const systemDark = useSystemPrefersDark();
  const effective = signedIn ? pref : 'system';
  if (effective === 'system') return systemDark ? 'dark' : 'light';
  return effective;
}
