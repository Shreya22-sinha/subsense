import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Screen } from '@/components/layout/Screen';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getCatalogItem } from '@/data/catalog';
import { createSubscription } from '@/engine/subscriptions';
import {
  emptyFormValues,
  toSubscriptionInput,
  type SubscriptionFormValues,
} from '@/lib/subscriptionForm';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';

/** Add subscription (PRD 6.7). `?catalog=<id>&plan=<name>&price=<paise>` prefill from a pick. */
export default function AddSubscription() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = useToday();
  const reminderDays = useDataStore((s) => s.profile.defaultReminderDays);
  const [pending, setPending] = useState<SubscriptionFormValues | null>(null);

  const initial = useMemo(() => {
    const values = emptyFormValues(today, reminderDays);
    const item = getCatalogItem(params.get('catalog'));
    // ?plan= and ?price= come from a Discover pick (e.g. a student price).
    const plan = item?.plans.find((p) => p.name === params.get('plan')) ?? item?.plans[0];
    const priceParam = Number(params.get('price'));
    if (!item || !plan) return values;
    return {
      ...values,
      catalogId: item.id,
      name: item.name,
      category: item.category,
      planName: plan.name,
      price:
        priceParam > 0
          ? String(priceParam / 100)
          : plan.pricePaise
            ? String(plan.pricePaise / 100)
            : '',
      cycle: plan.cycle,
    };
    // The form owns its state after mount; initial values are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeNextCharge = useCallback(
    (v: SubscriptionFormValues) =>
      createSubscription(toSubscriptionInput({ ...v, price: v.price || '0' }), {
        id: 'preview',
        today,
        now: today,
        defaultReminderDays: reminderDays,
      }).sub.nextChargeDate,
    [today, reminderDays],
  );

  const save = (values: SubscriptionFormValues) => {
    const sub = useDataStore.getState().addSubscription(toSubscriptionInput(values), {
      nextChargeOverride: values.nextChargeOverride,
    });
    showToast(`${sub.name} added`);
    navigate(`/subs/${sub.id}`, { replace: true });
  };

  const onSubmit = (values: SubscriptionFormValues) => {
    const name = values.name.trim().toLowerCase();
    const duplicate = useDataStore
      .getState()
      .subscriptions.some((s) => s.status === 'active' && s.name.trim().toLowerCase() === name);
    if (duplicate) setPending(values);
    else save(values);
  };

  return (
    <Screen title="Add subscription" back>
      <SubscriptionForm
        initial={initial}
        today={today}
        computeNextCharge={computeNextCharge}
        onSubmit={onSubmit}
        submitLabel="Save subscription"
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
              Add anyway
            </Button>
          </>
        }
      >
        You already track {pending?.name.trim()}. Add anyway?
      </Modal>
    </Screen>
  );
}
