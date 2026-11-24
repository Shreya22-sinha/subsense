import { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { CancelSheet } from '@/components/subscriptions/CancelSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CATALOG } from '@/data/catalog';
import { vibeFollowUp, type VibeAnswer, type VibeFollowUp } from '@/engine/vibeCheck';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import type { Subscription } from '@/types/models';
import { PickCard } from './PickCard';

const ANSWERS: Array<{ value: VibeAnswer; label: string }> = [
  { value: 'love', label: 'Love it' },
  { value: 'okay', label: "It's okay" },
  { value: 'not_really', label: 'Not really' },
];

/** "Still enjoying Netflix?" with a follow-up suggestion right after the answer (PRD 7.8). */
export function VibeCheckCard({
  sub,
  onAnswered,
}: {
  sub: Subscription;
  /** The parent keeps this card mounted after answering so the follow-up stays visible. */
  onAnswered?: () => void;
}) {
  const today = useToday();
  const [followUp, setFollowUp] = useState<VibeFollowUp | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const answer = (value: VibeAnswer) => {
    const s = useDataStore.getState();
    // Compute the follow-up from the state before the answer changes liking.
    const next = vibeFollowUp(sub, value, {
      profile: s.profile,
      subscriptions: s.subscriptions,
      usages: s.usages,
      catalog: CATALOG,
      today,
    });
    s.answerVibeCheck(sub.id, value);
    setFollowUp(next);
    onAnswered?.();
  };

  const pick = useMemo(() => (followUp?.kind === 'pick' ? followUp.pick : null), [followUp]);

  return (
    <Card>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Heart size={16} className="text-brand-ink" aria-hidden /> Vibe check
      </p>
      {!followUp ? (
        <>
          <p className="mt-1 text-base text-ink">Still enjoying {sub.name}?</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ANSWERS.map((a) => (
              <Button
                key={a.value}
                variant="secondary"
                onClick={() => answer(a.value)}
                className="px-2"
              >
                {a.label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-1 flex flex-col gap-3">
          <p className="text-sm text-ink">{followUp.text}</p>
          {pick && (
            <ul>
              <PickCard pick={pick} />
            </ul>
          )}
          {followUp.kind === 'cancel' && sub.status === 'active' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                Cancel it
              </Button>
              <Button
                variant="secondary"
                onClick={() => setFollowUp({ kind: 'none', text: 'Okay, keeping it for now.' })}
              >
                Keep for now
              </Button>
            </div>
          )}
          <CancelSheet sub={sub} open={cancelOpen} onClose={() => setCancelOpen(false)} />
        </div>
      )}
    </Card>
  );
}
