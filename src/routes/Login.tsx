import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/authStore';

/** PRD 6.3. Success signs in; the PublicOnly guard returns the user to where they were going. */
export default function Login() {
  const login = useAuthStore((s) => s.login);
  const loginDemo = useAuthStore((s) => s.loginDemo);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const result = await login({ email, password, remember });
    if (!result.ok) {
      // Never say which of the two was wrong.
      setError(result.message);
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Log in" back="/" hideActions>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          revealable
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="min-h-11 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden>
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>
        <Button variant="secondary" size="lg" fullWidth onClick={loginDemo}>
          Use demo account
        </Button>
        <p className="text-center text-sm text-ink-muted">
          New here?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-center text-xs text-ink-muted">
          <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">
            Privacy
          </Link>
        </p>{' '}
      </form>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Forgot password?"
        footer={
          <Button fullWidth onClick={() => setForgotOpen(false)}>
            OK
          </Button>
        }
      >
        Password reset isn't available yet. You can create a new account with another email, or try
        the demo.
      </Modal>
    </Screen>
  );
}
