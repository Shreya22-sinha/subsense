/** Structural equality for JSON values; object key order doesn't matter. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  // A key set to undefined is dropped by JSON, so treat it as missing.
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...keys].every((k) => deepEqual(x[k], y[k]));
}
