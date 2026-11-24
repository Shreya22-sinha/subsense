import { twMerge } from 'tailwind-merge';

/** Join class names, skipping falsy values. When two classes conflict, the later one wins. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(...classes);
}
