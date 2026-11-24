import rawCatalog from './catalog.json';
import { CATEGORIES, type CatalogItem, type Category } from '@/types/models';

/** Typed view of catalog.json. */
export const CATALOG = rawCatalog as CatalogItem[];

const byId = new Map(CATALOG.map((item) => [item.id, item]));

export function getCatalogItem(id: string | null | undefined): CatalogItem | undefined {
  return id ? byId.get(id) : undefined;
}

/** Branded services grouped by category, in category order (templates excluded). */
export function catalogByCategory(): Array<{ category: Category; items: CatalogItem[] }> {
  return CATEGORIES.map((category) => ({
    category,
    items: CATALOG.filter((i) => i.category === category && !i.isTemplate),
  })).filter((g) => g.items.length > 0);
}
