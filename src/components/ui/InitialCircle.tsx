import { CATEGORY_COLORS } from '@/data/categories';
import type { Category } from '@/types/models';

/** Coloured initial in place of a brand logo (PRD 3, 9.1). */
export function InitialCircle({
  name,
  category,
  size = 40,
}: {
  name: string;
  category: Category;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: CATEGORY_COLORS[category],
        fontSize: size * 0.42,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
