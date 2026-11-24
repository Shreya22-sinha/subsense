import { Hammer } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from './Screen';

/** Placeholder for screens built in later milestones (PRD 11). */
export function ComingSoon({ title, step, back }: { title: string; step: number; back?: boolean }) {
  return (
    <Screen title={title} back={back}>
      <EmptyState
        icon={Hammer}
        title={`${title} is on its way`}
        body={`This screen is built in step ${step}.`}
      />
    </Screen>
  );
}
