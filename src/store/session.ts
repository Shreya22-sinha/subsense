/**
 * Whether this browser is in the demo account. Real logins are kept by the cloud client
 * (src/cloud/authStorage.ts).
 */
import { STORAGE_KEYS } from '@/lib/storageKeys';

const DEMO = 'demo';

export function isDemoSession(): boolean {
  return localStorage.getItem(STORAGE_KEYS.session) === DEMO;
}

export function writeDemoSession(): void {
  localStorage.setItem(STORAGE_KEYS.session, DEMO);
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.session);
  sessionStorage.removeItem(STORAGE_KEYS.session);
}
