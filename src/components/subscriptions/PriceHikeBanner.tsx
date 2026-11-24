import { useNavigate } from 'react-router';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PriceHike } from '@/engine/priceHike';
import { formatRs } from '@/lib/format';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { Subscription } from '@/types/models';

export interface PriceHikeState {
  hike: PriceHike;
  priceChangeId: string;
}

/** Shown on the detail page after an edit raises the price (PRD 7.5). */
export function PriceHikeBanner({
  sub,
  state,
  onClose,
}: {
  sub: Subscription;
  state: PriceHikeState;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { hike, priceChangeId } = state;

  return (
    <section
      role="status"
      className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/8 p-4"
    >
      <div className="flex gap-3">
        <TrendingUp size={22} className="mt-0.5 shrink-0 text-danger-ink" aria-hidden />
        <p className="text-sm text-ink">
          <strong>
            {sub.name} went up from {formatRs(hike.oldPaise)} to {formatRs(hike.newPaise)} (+
            {hike.increasePct}%).
          </strong>{' '}
          That's {formatRs(hike.extraPerYearPaise)} more a year.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/picks?category=${encodeURIComponent(sub.category)}`)}
        >
          See cheaper options
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            useDataStore.getState().remindPriceHikeAtRenewal(priceChangeId);
            showToast("We'll remind you 3 days before it renews.");
            onClose();
          }}
        >
          Remind me at renewal
        </Button>
      </div>
    </section>
  );
}
