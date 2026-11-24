import { useEffect } from 'react';
import { Link } from 'react-router';
import { BellRing, ChartPie, Lightbulb, type LucideIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: BellRing,
    title: 'Never miss a trial',
    body: 'A heads-up before a free trial turns into a charge.',
  },
  {
    icon: ChartPie,
    title: 'See where your money goes',
    body: 'Your real monthly total, by category.',
  },
  {
    icon: Lightbulb,
    title: 'Smart ideas to save',
    body: 'What to keep, cancel or switch, from your own data.',
  },
];

export default function Landing() {
  const loginDemo = useAuthStore((s) => s.loginDemo);

  // Landing is where an explicit Log out ends; later guard redirects go to Login again.
  useEffect(() => {
    useAuthStore.setState({ signedOutByUser: false });
  }, []);

  return (
    <div className="scrollbar-thin flex h-full flex-col overflow-y-auto">
      <div className="bg-brand-gradient px-6 pt-6 pb-8 text-white">
        <p className="font-display text-xl font-bold">SubSense</p>
        <h1 className="mt-4 text-3xl leading-tight font-bold">
          Know every rupee you subscribe to.
        </h1>
        <p className="mt-3 text-base text-white/90">
          Track your subscriptions and bills, get warned before you're charged, and find easy ways
          to spend less.
        </p>
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pt-5 pb-[calc(1.25rem+var(--safe-bottom))]">
        <ul className="flex flex-col gap-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <Icon size={20} aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                <p className="text-sm text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth onClick={loginDemo}>
            Use demo account
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <ButtonLink to="/register" variant="secondary" size="lg">
              Sign up
            </ButtonLink>
            <ButtonLink to="/login" variant="secondary" size="lg">
              Log in
            </ButtonLink>
          </div>
        </div>

        <p className="mt-auto text-center text-xs text-ink-muted">
          The demo stays in your browser. Not financial advice.{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">
            Privacy
          </Link>
        </p>
      </main>
    </div>
  );
}
