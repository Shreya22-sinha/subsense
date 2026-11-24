import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, CloudOff, Download, LogOut, RefreshCw } from 'lucide-react';
import { BudgetPicker } from '@/components/BudgetPicker';
import { DemoTools } from '@/components/demo/DemoTools';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { TypeToConfirm } from '@/components/ui/TypeToConfirm';
import { csvFileName, subscriptionsCsv } from '@/engine/csv';
import { downloadText } from '@/lib/download';
import { formatRs } from '@/lib/format';
import { useAuthStore, useCurrentUser, useIsDemo } from '@/store/authStore';
import { getToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { useSyncStore } from '@/store/sync';
import { showToast } from '@/store/uiStore';
import type { ReminderDays, ThemePreference } from '@/types/models';

const APP_VERSION = '0.1.0';

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={className}>
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        {children}
      </div>
    </section>
  );
}

function RowButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-surface-2"
    >
      <span className="flex-1">{label}</span>
      {value && <span className="text-ink-muted">{value}</span>}
      <ChevronRight size={18} className="text-ink-muted" aria-hidden />
    </button>
  );
}

const SYNC_LINES = {
  saved: { icon: Check, text: 'Saved to your account' },
  saving: { icon: RefreshCw, text: 'Saving…' },
  waiting: { icon: CloudOff, text: "Not saved yet. We'll keep trying." },
};

function SyncLine() {
  const { icon: Icon, text } = SYNC_LINES[useSyncStore((s) => s.status)];
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
      <Icon size={16} aria-hidden /> {text}
    </p>
  );
}

/**
 * Settings / More (PRD 6.12): profile, quiz, budget, preferences, data
 * (export CSV, clear data, delete account), demo tools (mobile), about and log out.
 */
export default function Settings() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const isDemo = useIsDemo();
  const [working, setWorking] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const profile = useDataStore((s) => s.profile);
  const { setBudget, updatePreferences } = useDataStore.getState();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [draftBudget, setDraftBudget] = useState(profile.budgetPaise);
  const [confirm, setConfirm] = useState<'none' | 'clear' | 'delete'>('none');
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const exportCsv = () => {
    const { subscriptions, usages, logDataExported } = useDataStore.getState();
    const today = getToday();
    downloadText(csvFileName(today), subscriptionsCsv(subscriptions, usages, today));
    logDataExported(subscriptions.length);
    showToast(`Exported ${subscriptions.length} subscriptions.`);
  };

  return (
    <Screen title="More">
      <div className="flex flex-col gap-6">
        <Section title="Profile">
          <div className="text-sm">
            <p className="font-semibold text-ink">{user?.name}</p>
            <p className="text-ink-muted">{user?.email}</p>
          </div>
          {!isDemo && <SyncLine />}
          <RowButton label="Retake quiz" onClick={() => navigate('/onboarding?step=1&retake=1')} />
          <RowButton
            label="Monthly budget"
            value={formatRs(profile.budgetPaise)}
            onClick={() => {
              setDraftBudget(profile.budgetPaise);
              setBudgetOpen(true);
            }}
          />
        </Section>

        <Section title="Preferences">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">Theme</span>
            <Segmented<ThemePreference>
              label="Theme"
              value={profile.theme}
              onChange={(theme) => updatePreferences({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">Remind me before a charge</span>
            <Segmented<ReminderDays>
              label="Default reminder days"
              value={profile.defaultReminderDays}
              onChange={(defaultReminderDays) => updatePreferences({ defaultReminderDays })}
              options={[
                { value: 1, label: '1 day' },
                { value: 3, label: '3 days' },
                { value: 7, label: '7 days' },
              ]}
            />
          </div>
          <Switch
            label="I'm a student"
            description="Shows student prices where they exist."
            checked={profile.isStudent}
            onChange={(isStudent) => updatePreferences({ isStudent })}
          />
        </Section>

        <Section title="Your data">
          <Button variant="secondary" fullWidth onClick={exportCsv}>
            <Download size={18} aria-hidden /> Export CSV
          </Button>
          <p className="text-xs text-ink-muted">
            A spreadsheet of your subscriptions. Opens in Excel and Google Sheets.
          </p>
          {isDemo ? (
            <p className="text-sm text-ink-muted">
              To start the demo again, use Reset demo data in the demo tools.
            </p>
          ) : (
            <>
              <Button variant="danger" fullWidth onClick={() => setConfirm('clear')}>
                Clear all my data
              </Button>
              <Button variant="danger" fullWidth onClick={() => setConfirm('delete')}>
                Delete account
              </Button>
            </>
          )}
        </Section>

        {isDemo && (
          <Section title="Demo tools" className="lg:hidden">
            <DemoTools />
          </Section>
        )}

        <Section title="About">
          <p className="text-sm text-ink-muted">
            SubSense v{APP_VERSION}. A portfolio project, not financial advice.
          </p>
          <RowButton label="Privacy notice" onClick={() => navigate('/privacy')} />
        </Section>

        <Button
          variant="danger"
          size="lg"
          fullWidth
          disabled={working}
          onClick={() => {
            setWorking(true);
            void logout().finally(() => setWorking(false));
          }}
        >
          <LogOut size={18} aria-hidden />
          {working ? 'One moment…' : 'Log out'}
        </Button>
      </div>

      <Modal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title="Monthly budget"
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setBudgetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                setBudget(draftBudget, { log: true });
                setBudgetOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <BudgetPicker valuePaise={draftBudget} onChange={setDraftBudget} />
      </Modal>

      <TypeToConfirm
        open={confirm === 'clear'}
        onClose={() => setConfirm('none')}
        title="Clear all your data?"
        confirmLabel="Clear data"
        onConfirm={() => {
          setConfirm('none');
          useDataStore.getState().clearAllData();
          showToast('All your data was cleared.');
        }}
      >
        This removes every subscription, record and setting from your account, on all your devices.
        You'll set things up again. This can't be undone.
      </TypeToConfirm>

      <TypeToConfirm
        open={confirm === 'delete'}
        onClose={() => setConfirm('none')}
        title="Delete your account?"
        confirmLabel="Delete account"
        onConfirm={() => {
          setConfirm('none');
          setWorking(true);
          void deleteAccount()
            .then((ok) =>
              showToast(
                ok
                  ? 'Your account was deleted.'
                  : "We couldn't delete your account. Check your connection and try again.",
              ),
            )
            .finally(() => setWorking(false));
        }}
      >
        This deletes your account and everything stored with it. This can't be undone.
      </TypeToConfirm>
    </Screen>
  );
}
