import type { ReactNode } from 'react';
import { Screen } from '@/components/layout/Screen';
import { formatDate } from '@/lib/format';
import { PRIVACY_VERSION, useAuthStore } from '@/store/authStore';

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL;

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-base text-ink-muted">{children}</div>
    </section>
  );
}

/** Privacy notice. Keep it in step with supabase/schema.sql and what the app really does. */
export default function Privacy() {
  const signedIn = useAuthStore((s) => s.sessionUserId !== null);
  return (
    <Screen title="Privacy" back hideActions={!signedIn}>
      <div className="flex flex-col gap-6">
        <p className="text-base text-ink">
          SubSense is a personal portfolio project. This page says what it stores and why. Last
          updated {formatDate(PRIVACY_VERSION)}.
        </p>
        <Part title="If you create an account, we store">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Your name, email, and when you signed up and last logged in.</li>
            <li>Your password, scrambled by our login provider. We can't read it.</li>
            <li>
              What you enter in the app: subscriptions, prices, quiz answers, budget, notes, usage
              and activity history.
            </li>
            <li>The dates on which you opened the app.</li>
          </ul>
        </Part>
        <Part title="If you use the demo">
          <p>
            Demo data stays in your browser. We only add 1 to a daily count of demo visits, with
            nothing that identifies you.
          </p>
        </Part>
        <Part title="Why">
          <p>
            To let you log in and use SubSense on any device, and to count how many people use it.
            The counts, never anyone's details, may appear on the developer's resume or portfolio.
          </p>
        </Part>
        <Part title="Who can see it">
          <p>
            Other users can't see your data. The developer can see it in the database, and uses it
            only to run the project and count users. It is never sold, and there are no ads or
            advertising trackers.
          </p>
          <p>
            Supabase stores the accounts and data, and the website's host and Google Fonts receive
            normal technical details such as your IP address when the page loads.
          </p>
        </Part>
        <Part title="Please don't enter">
          <p>
            Card numbers, bank details or passwords for other services. SubSense never needs them.
          </p>
        </Part>
        <Part title="Your choices">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Download your subscriptions: More, then Export CSV.</li>
            <li>Erase what you entered: More, then Clear all my data.</li>
            <li>
              Delete your account and everything stored with it: More, then Delete account. Backups
              kept by Supabase may hold a copy for a short time.
            </li>
          </ul>
          {CONTACT && (
            <p>
              Questions or requests:{' '}
              <a
                href={`mailto:${CONTACT}`}
                className="font-semibold text-brand-ink underline underline-offset-2"
              >
                {CONTACT}
              </a>
            </p>
          )}
        </Part>
        <Part title="Age">
          <p>SubSense is for people aged 18 and over.</p>
        </Part>
      </div>
    </Screen>
  );
}
