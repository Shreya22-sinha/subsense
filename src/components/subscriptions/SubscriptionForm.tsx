import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Disclosure } from '@/components/ui/Disclosure';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { StarRating } from '@/components/ui/StarRating';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { CATALOG, getCatalogItem } from '@/data/catalog';
import { sharePaise, trialEndDate } from '@/engine/dates';
import { cn } from '@/lib/cn';
import { formatDate, formatRs, rupeesToPaise } from '@/lib/format';
import {
  LIMITS,
  validateSubscriptionForm,
  type FormField,
  type SubscriptionFormValues,
} from '@/lib/subscriptionForm';
import { CATEGORIES, type CatalogItem, type IsoDate, type Liking } from '@/types/models';

interface SubscriptionFormProps {
  initial: SubscriptionFormValues;
  today: IsoDate;
  /** Calculated next charge date for the current values (PRD 7.1), or null. */
  computeNextCharge: (values: SubscriptionFormValues) => IsoDate | null;
  onSubmit: (values: SubscriptionFormValues) => void;
  submitLabel: string;
  /** Start with "More options" open (editing). */
  startOpen?: boolean;
}

const CUSTOM_PLAN = '__custom';

function findCatalogByName(name: string): CatalogItem | undefined {
  const needle = name.trim().toLowerCase();
  return needle ? CATALOG.find((c) => c.name.toLowerCase() === needle) : undefined;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-4"
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** A heading inside the optional section. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={title}
      className="flex flex-col gap-4 border-t border-line py-5 last:pb-1"
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/** Fields inside "More options": an error in one keeps the section open. */
const OPTIONAL_FIELDS: FormField[] = ['endDate', 'sharedWith', 'paidWith', 'notes'];
function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="-mt-2 flex gap-1.5 text-xs text-ink-muted">
      <Info size={14} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Add/Edit subscription form (PRD 6.7). Save stays disabled until every field is valid. */
export function SubscriptionForm({
  initial,
  today,
  computeNextCharge,
  onSubmit,
  submitLabel,
  startOpen = false,
}: SubscriptionFormProps) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Set<FormField>>(new Set());
  const datalistId = useId();
  const notesId = useId();

  const errors = useMemo(() => validateSubscriptionForm(values, today), [values, today]);
  const isValid = Object.keys(errors).length === 0;
  const errorFor = (field: FormField) => (touched.has(field) ? errors[field] : undefined);
  const touch = (field: FormField) => setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));

  const set = <K extends keyof SubscriptionFormValues>(
    field: K,
    value: SubscriptionFormValues[K],
  ) => setValues((v) => ({ ...v, [field]: value }));

  const catalogItem = getCatalogItem(values.catalogId);
  const brandedPlans = catalogItem && !catalogItem.isTemplate ? catalogItem.plans : [];

  const calculatedNext = useMemo(() => {
    if (values.cycle === 'one_time' || errors.startDate) return null;
    return computeNextCharge(values);
  }, [values, errors.startDate, computeNextCharge]);

  const pricePaise = rupeesToPaise(Number(values.price) || 0);
  const shared = Number(values.sharedWith);
  const trialEnd =
    values.isTrial && !errors.trialDays && !errors.startDate
      ? trialEndDate(values.startDate, Number(values.trialDays))
      : null;

  // ---------- Catalogue ----------

  const applyPlan = (item: CatalogItem, planName: string) => {
    const plan = item.plans.find((p) => p.name === planName);
    if (!plan) return;
    setValues((v) => ({
      ...v,
      planName: plan.name,
      price: plan.pricePaise ? String(plan.pricePaise / 100) : v.price,
      cycle: plan.cycle,
      trialDays: plan.trialDays ? String(plan.trialDays) : v.trialDays,
      nextChargeOverride: null,
    }));
  };

  const onNameChange = (name: string) => {
    const match = findCatalogByName(name);
    if (match && match.id !== values.catalogId) {
      // Choosing a catalogue item fills category, plan and price.
      const plan = match.plans[0];
      setValues((v) => ({
        ...v,
        name: match.name,
        catalogId: match.id,
        category: match.category,
        planName: plan?.name ?? '',
        price: plan?.pricePaise ? String(plan.pricePaise / 100) : '',
        cycle: plan?.cycle ?? v.cycle,
        trialDays: plan?.trialDays ? String(plan.trialDays) : v.trialDays,
        nextChargeOverride: null,
      }));
      setTouched((t) => new Set(t).add('category'));
    } else {
      setValues((v) => ({ ...v, name, catalogId: match ? v.catalogId : null }));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit(values);
    else setTouched(new Set(Object.keys(errors) as FormField[]));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Section title="Service">
        <TextField
          label="Service name"
          value={values.name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={() => touch('name')}
          error={errorFor('name')}
          list={datalistId}
          autoComplete="off"
          maxLength={LIMITS.nameMax}
          placeholder="e.g. Netflix"
        />
        <datalist id={datalistId}>
          {CATALOG.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        {catalogItem && !catalogItem.isTemplate && (
          <Hint>
            {catalogItem.lastVerified
              ? `Prices last checked ${formatDate(catalogItem.lastVerified)}; check the official site.`
              : 'Typical price, not yet checked. Check the official site for the current price.'}
          </Hint>
        )}

        {brandedPlans.length > 0 ? (
          <>
            <Select
              label="Plan"
              value={
                brandedPlans.some((p) => p.name === values.planName) ? values.planName : CUSTOM_PLAN
              }
              onChange={(e) => {
                if (e.target.value === CUSTOM_PLAN) set('planName', '');
                else if (catalogItem) applyPlan(catalogItem, e.target.value);
              }}
              options={[
                ...brandedPlans.map((p) => ({ value: p.name, label: p.name })),
                { value: CUSTOM_PLAN, label: 'Other plan' },
              ]}
            />
            {!brandedPlans.some((p) => p.name === values.planName) && (
              <TextField
                label="Plan name"
                value={values.planName}
                onChange={(e) => set('planName', e.target.value)}
                placeholder="e.g. Premium"
              />
            )}
          </>
        ) : (
          <TextField
            label="Plan name (optional)"
            value={values.planName}
            onChange={(e) => set('planName', e.target.value)}
            placeholder="e.g. Premium, Family"
          />
        )}

        <Select
          label="Category"
          value={values.category}
          onChange={(e) => {
            set('category', e.target.value as SubscriptionFormValues['category']);
            touch('category');
          }}
          onBlur={() => touch('category')}
          error={errorFor('category')}
          options={[
            { value: '', label: 'Choose a category' },
            ...CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
      </Section>

      <Section title="Price and billing">
        <TextField
          label="Price (₹)"
          type="number"
          inputMode="decimal"
          min={0}
          max={LIMITS.priceMaxRupees}
          value={values.price}
          onChange={(e) => set('price', e.target.value)}
          onBlur={() => touch('price')}
          error={errorFor('price')}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink" aria-hidden>
            Billing cycle
          </span>
          <Segmented
            label="Billing cycle"
            value={values.cycle}
            onChange={(cycle) => setValues((v) => ({ ...v, cycle, nextChargeOverride: null }))}
            options={[
              { value: 'weekly', label: 'Week' },
              { value: 'monthly', label: 'Month' },
              { value: 'quarterly', label: 'Qtr' },
              { value: 'yearly', label: 'Year' },
              { value: 'one_time', label: 'Once' },
            ]}
          />
        </div>
        <TextField
          label="Start date"
          type="date"
          value={values.startDate}
          onChange={(e) =>
            setValues((v) => ({ ...v, startDate: e.target.value, nextChargeOverride: null }))
          }
          onBlur={() => touch('startDate')}
          error={errorFor('startDate')}
        />

        <Switch
          label="Free trial"
          checked={values.isTrial}
          onChange={(isTrial) => setValues((v) => ({ ...v, isTrial, nextChargeOverride: null }))}
        />
        {values.isTrial && (
          <TextField
            label="Trial length (days)"
            type="number"
            inputMode="numeric"
            min={LIMITS.trialMin}
            max={LIMITS.trialMax}
            value={values.trialDays}
            onChange={(e) =>
              setValues((v) => ({ ...v, trialDays: e.target.value, nextChargeOverride: null }))
            }
            onBlur={() => touch('trialDays')}
            error={errorFor('trialDays')}
            hint={
              trialEnd
                ? `Trial ends ${formatDate(trialEnd)}. The first charge is that day.`
                : undefined
            }
          />
        )}

        {values.cycle !== 'one_time' && (
          <div className="flex flex-col gap-1">
            <TextField
              label="Next charge date"
              type="date"
              value={values.nextChargeOverride ?? calculatedNext ?? ''}
              onChange={(e) => set('nextChargeOverride', e.target.value || null)}
              onBlur={() => touch('nextCharge')}
              error={errors.nextCharge}
              hint={
                values.nextChargeOverride === null
                  ? 'Calculated from the start date and cycle. Change it if your bill says otherwise.'
                  : undefined
              }
            />
            {values.nextChargeOverride !== null && (
              <button
                type="button"
                onClick={() => set('nextChargeOverride', null)}
                className="min-h-11 self-start text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
              >
                Use the calculated date{calculatedNext ? ` (${formatDate(calculatedNext)})` : ''}
              </button>
            )}
          </div>
        )}
      </Section>

      <Disclosure
        title="More options"
        hint="End date, sharing, usage, reminders, notes"
        defaultOpen={startOpen}
        forceOpen={OPTIONAL_FIELDS.some((field) => errors[field])}
      >
        <Group title="Plan length">
          <div className="flex items-end gap-2">
            <TextField
              label="End date (optional)"
              type="date"
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              onBlur={() => touch('endDate')}
              error={errorFor('endDate')}
              className="flex-1"
            />
            {values.endDate && (
              <Button
                variant="ghost"
                onClick={() => set('endDate', '')}
                className={cn(errorFor('endDate') && 'mb-7')}
              >
                Clear
              </Button>
            )}
          </div>
          <Hint>For fixed-term plans that stop on a set date.</Hint>

          <Switch
            label="Auto-renew"
            description="Off means it stops at the end of the current period."
            checked={values.autoRenew}
            onChange={(autoRenew) => set('autoRenew', autoRenew)}
          />
        </Group>

        <Group title="Sharing and payment">
          <TextField
            label="People sharing it (including you)"
            type="number"
            inputMode="numeric"
            min={LIMITS.sharedMin}
            max={LIMITS.sharedMax}
            value={values.sharedWith}
            onChange={(e) => set('sharedWith', e.target.value)}
            onBlur={() => touch('sharedWith')}
            error={errorFor('sharedWith')}
            hint={
              shared > 1 && !errors.sharedWith && !errors.price
                ? `Your share: ${formatRs(sharePaise(pricePaise, shared))} per charge.`
                : undefined
            }
          />
          <TextField
            label="Paid with (optional)"
            value={values.paidWith}
            onChange={(e) => set('paidWith', e.target.value)}
            onBlur={() => touch('paidWith')}
            error={errorFor('paidWith')}
            maxLength={LIMITS.paidWithMax}
            placeholder='e.g. "HDFC card" or "UPI"'
            hint="A label only. Never enter card numbers."
          />
        </Group>

        <Group title="How you use it">
          <StarRating
            label="How much do you use it?"
            value={values.usageRating}
            onChange={(usageRating) => set('usageRating', usageRating)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink" aria-hidden>
              How much do you like it? (optional)
            </span>
            <LikingPicker value={values.liking} onChange={(liking) => set('liking', liking)} />
          </div>
        </Group>

        <Group title="Reminder and notes">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink" aria-hidden>
              Remind me before a charge
            </span>
            <Segmented
              label="Remind me before a charge"
              value={values.reminderDays}
              onChange={(reminderDays) => set('reminderDays', reminderDays)}
              options={[
                { value: 1, label: '1 day' },
                { value: 3, label: '3 days' },
                { value: 7, label: '7 days' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={notesId} className="text-sm font-medium text-ink">
              Notes (optional)
            </label>
            <textarea
              id={notesId}
              rows={3}
              maxLength={LIMITS.notesMax}
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink focus:border-brand focus:outline-none"
            />
            <p className="text-right text-xs text-ink-muted">
              {values.notes.length}/{LIMITS.notesMax}
            </p>
          </div>
        </Group>
      </Disclosure>

      <div className="sticky -bottom-8 z-20 -mx-4 -mb-8 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Button type="submit" size="lg" fullWidth disabled={!isValid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Love it / It's okay / Meh; tapping the selected option clears it. */
function LikingPicker({
  value,
  onChange,
}: {
  value: Liking | null;
  onChange: (v: Liking | null) => void;
}) {
  const options: Array<{ value: Liking; label: string }> = [
    { value: 'love', label: 'Love it' },
    { value: 'okay', label: "It's okay" },
    { value: 'meh', label: 'Meh' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="How much do you like it?"
      className="flex rounded-xl bg-surface-2 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={cn(
            'min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
