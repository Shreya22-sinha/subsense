import { supabaseCloud } from './supabase';
import type { Cloud } from './types';

export * from './types';

let current: Cloud = supabaseCloud;

export function cloud(): Cloud {
  return current;
}

/** Tests swap in a fake backend. */
export function setCloud(next: Cloud): void {
  current = next;
}
