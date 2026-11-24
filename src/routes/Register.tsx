import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import {
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from '@/lib/validation';
import { useAuthStore } from '@/store/authStore';

type Field = 'name' | 'email' | 'password' | 'confirm' | 'adult' | 'privacy';
type Values = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  adult: boolean;
  privacy: boolean;
};
type Errors = Partial<Record<Field, string | null>>;

function validate(field: Field, v: Values): string | null {
  switch (field) {
    case 'name':
      return validateName(v.name);
    case 'email':
      return validateEmail(v.email);
    case 'password':
      return validatePassword(v.password);
    case 'confirm':
      return validateConfirmPassword(v.password, v.confirm);
    case 'adult':
      return v.adult ? null : 'You must be 18 or older to use SubSense.';
    case 'privacy':
      return v.privacy ? null : 'Please read and agree to continue.';
  }
}

const FIELDS: Field[] = ['name', 'email', 'password', 'confirm', 'adult', 'privacy'];

/** PRD 6.2. Success signs in; the PublicOnly guard then routes to onboarding. */
export default function Register() {
  const register = useAuthStore((s) => s.register);
  const [values, setValues] = useState<Values>({
    name: '',
    email: '',
    password: '',
    confirm: '',
    adult: false,
    privacy: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const check = (field: Field, next = values) =>
    setErrors((e) => ({ ...e, [field]: validate(field, next) }));

  const set = <K extends keyof Values>(field: K, value: Values[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field has shown an error, re-validate as the user fixes it.
    if (errors[field as Field]) check(field as Field, next);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const all: Errors = Object.fromEntries(FIELDS.map((f) => [f, validate(f, values)]));
    setErrors(all);
    if (FIELDS.some((f) => all[f])) return;

    setFormError(null);
    setSubmitting(true);
    const result = await register({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (!result.ok) {
      const { field, message } = result;
      if (field === 'form') setFormError(message);
      else setErrors((er) => ({ ...er, [field]: message }));
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Create account" back="/" hideActions>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          onBlur={() => check('name')}
          error={errors.name}
          maxLength={40}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          onBlur={() => check('email')}
          error={errors.email}
        />
        <TextField
          label="Password"
          revealable
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
          onBlur={() => check('password')}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <TextField
          label="Confirm password"
          revealable
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => set('confirm', e.target.value)}
          onBlur={() => check('confirm')}
          error={errors.confirm}
        />
        <Checkbox
          checked={values.adult}
          onChange={(v) => set('adult', v)}
          label="I am 18 or older"
          error={errors.adult}
        />
        <Checkbox
          checked={values.privacy}
          onChange={(v) => set('privacy', v)}
          label={
            <>
              I agree to the{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="font-semibold text-brand-ink underline underline-offset-2"
              >
                privacy notice
              </Link>
            </>
          }
          error={errors.privacy}
        />

        {formError && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger-ink">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </Screen>
  );
}
