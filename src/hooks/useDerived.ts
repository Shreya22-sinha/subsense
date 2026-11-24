/**
 * Derived data shared by several screens. Each hook selects raw store slices and runs the
 * pure engine function in useMemo, so screens never re-implement a rule.
 */
import { useMemo } from 'react';
import { computeActionItems, type ActionItem } from '@/engine/actions';
import { computeBadges, type Badge } from '@/engine/badges';
import { computePicks, type PicksResult } from '@/engine/recommendations';
import { CATALOG } from '@/data/catalog';
import { uses30ById } from '@/engine/usage';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';

export function useBadges(): Map<string, Badge[]> {
  const today = useToday();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const usages = useDataStore((s) => s.usages);
  const priceChanges = useDataStore((s) => s.priceChanges);
  return useMemo(
    () => computeBadges(subscriptions, { usages, priceChanges, today }),
    [subscriptions, usages, priceChanges, today],
  );
}

export function useUses30(): Map<string, number> {
  const today = useToday();
  const usages = useDataStore((s) => s.usages);
  return useMemo(() => uses30ById(usages, today), [usages, today]);
}

export function useActionItems(): ActionItem[] {
  const today = useToday();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const charges = useDataStore((s) => s.charges);
  const usages = useDataStore((s) => s.usages);
  const priceChanges = useDataStore((s) => s.priceChanges);
  const actionStates = useDataStore((s) => s.actionStates);
  return useMemo(
    () => computeActionItems({ subscriptions, charges, usages, priceChanges, actionStates }, today),
    [subscriptions, charges, usages, priceChanges, actionStates, today],
  );
}

export function usePicks(): PicksResult {
  const today = useToday();
  const profile = useDataStore((s) => s.profile);
  const subscriptions = useDataStore((s) => s.subscriptions);
  const usages = useDataStore((s) => s.usages);
  const dismissedPicks = useDataStore((s) => s.dismissedPicks);
  return useMemo(
    () => computePicks({ profile, subscriptions, usages, dismissedPicks }, CATALOG, today),
    [profile, subscriptions, usages, dismissedPicks, today],
  );
}
