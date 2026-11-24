import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getCatalogItem } from '@/data/catalog';
import { monthlyShareOf } from '@/engine/dates';
import { formatRs } from '@/lib/format';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { Subscription } from '@/types/models';

/**
 * Cancel sheet (PRD 6.8). SubSense never cancels for you: it points to the official
 * site, then records the cancellation and the saving once you confirm.
 */
export function CancelSheet({
  sub,
  open,
  onClose,
  onCancelled,
}: {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
  /** Called after the cancellation is recorded (e.g. to resolve an Action Center item). */
  onCancelled?: () => void;
}) {
  const cancelUrl = getCatalogItem(sub.catalogId)?.cancelUrl;
  const monthly = monthlyShareOf(sub);

  const confirm = () => {
    useDataStore.getState().cancelSubscription(sub.id);
    onCancelled?.();
    onClose();
    showToast(
      monthly > 0
        ? `${sub.name} marked as cancelled. You'll save ${formatRs(monthly)}/month.`
        : `${sub.name} marked as cancelled.`,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cancel ${sub.name}`}
      footer={
        <>
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            Not now
          </Button>
          <Button size="lg" className="flex-1" onClick={confirm}>
            I've cancelled
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          <strong className="text-ink">Cancel on the official site first.</strong> SubSense can't
          cancel anything for you. Once you've cancelled, tap "I've cancelled" and we'll stop
          tracking charges.
        </p>
        {cancelUrl ? (
          <a
            href={cancelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            How to cancel {sub.name}
            <ExternalLink size={16} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <p>Check your account settings or bill for how to cancel.</p>
        )}
      </div>
    </Modal>
  );
}
