import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SearchX } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import type { PriceHikeState } from '@/components/subscriptions/PriceHikeBanner';
import { priceHike } from '@/engine/priceHike';
import { applyEdit } from '@/engine/subscriptions';
import {
  formValuesFrom,
  toSubscriptionInput,
  type SubscriptionFormValues,
} from '@/lib/subscriptionForm';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';

/** Edit subscription (PRD 6.7). Saving also confirms dates for onboarding-chip subscriptions. */
export default function EditSubscription() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const sub = useDataStore((s) => s.subscriptions.find((x) => x.id === id));
  const chargedToday = useDataStore((s) =>
    s.charges.some((c) => c.subId === id && c.date === today),
  );
  const [pending, setPending] = useState<SubscriptionFormValues | null>(null);

  // Read once: the form owns its state after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => (sub ? formValuesFrom(sub) : null), [id]);

  const computeNextCharge = useCallback(
    (v: SubscriptionFormValues) =>
      sub
        ? applyEdit(sub, toSubscriptionInput({ ...v, price: v.price || '0' }), {
            today,
            now: today,
            chargedToday,
          }).sub.nextChargeDate
        : null,
    [sub, today, chargedToday],
  );

  if (!sub || !initial) {
    return (
      <Screen title="Edit subscription" back="/subs">
        <EmptyState
          icon={SearchX}
          title="Subscription not found"
          body="It may have been deleted."
          action={<ButtonLink to="/subs">Back to subscriptions</ButtonLink>}
        />
      </Screen>
    );
  }

  const save = (values: SubscriptionFormValues) => {
    const result = useDataStore.getState().updateSubscription(id, toSubscriptionInput(values), {
      nextChargeOverride: values.nextChargeOverride,
    });
    // Price-hike alert (PRD 7.5): a higher price on the same cycle shows a banner on the
    // detail page; a lower price just gets a toast; a changed cycle gets neither.
    const change = result?.priceChange;
    const hike = change
      ? priceHike(change.oldPaise, change.newPaise, sub.cycle, values.cycle)
      : null;
    if (hike && result?.priceChangeId) {
      const state: PriceHikeState = { hike, priceChangeId: result.priceChangeId };
      navigate(`/subs/${id}`, { replace: true, state: { priceHike: state } });
      return;
    }
    if (change && change.sameCycle && change.newPaise < change.oldPaise) showToast('Price lowered');
    else showToast(result?.changedFields.length ? 'Changes saved' : 'Details confirmed');
    navigate(`/subs/${id}`, { replace: true });
  };

  const onSubmit = (values: SubscriptionFormValues) => {
    const name = values.name.trim().toLowerCase();
    const renamedToDuplicate =
      name !== sub.name.trim().toLowerCase() &&
      useDataStore
        .getState()
        .subscriptions.some(
          (s) => s.id !== id && s.status === 'active' && s.name.trim().toLowerCase() === name,
        );
    if (renamedToDuplicate) setPending(values);
    else save(values);
  };

  return (
    <Screen title={`Edit ${sub.name}`} back>
      <SubscriptionForm
        initial={initial}
        today={today}
        computeNextCharge={computeNextCharge}
        onSubmit={onSubmit}
        submitLabel="Save changes"
        startOpen
      />
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Already tracked"
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setPending(null)}
            >
              Go back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => pending && save(pending)}>
              Save anyway
            </Button>
          </>
        }
      >
        You already track {pending?.name.trim()}. Save anyway?
      </Modal>
    </Screen>
  );
}
