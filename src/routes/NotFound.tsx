import { useNavigate } from 'react-router';
import { Compass } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Screen title="Page not found" hideActions>
      <EmptyState
        icon={Compass}
        title="Page not found"
        body="This page doesn't exist. Let's get you back."
        action={<Button onClick={() => navigate('/home')}>Back to Home</Button>}
      />
    </Screen>
  );
}
