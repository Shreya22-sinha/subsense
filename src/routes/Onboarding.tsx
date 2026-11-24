import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { BudgetPicker } from '@/components/BudgetPicker';
import { Button } from '@/components/ui/Button';
import { OptionCard } from '@/components/ui/OptionCard';
import { catalogByCategory } from '@/data/catalog';
import { budgetHint, ONBOARDING_STEPS, QUIZ, QUIZ_STEPS, type QuizQuestion } from '@/data/quiz';
import { monthlyEquivalentPaise } from '@/engine/dates';
import { cn } from '@/lib/cn';
import { formatRs } from '@/lib/format';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { QuizAnswers } from '@/types/models';

/**
 * PRD 6.4: 8 steps via ?step=1..8. Steps 1–6 quiz, 7 budget, 8 existing services.
 * With ?retake=1 (from Settings) only the quiz runs, then it returns to Settings.
 * Answers save as you go, so a reload resumes where you left off.
 */
export default function Onboarding() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const onboardingDone = useDataStore((s) => s.profile.onboardingDone);
  const retake = params.get('retake') === '1';
  const lastStep = retake ? QUIZ_STEPS : ONBOARDING_STEPS;
  const step = Math.min(lastStep, Math.max(1, Number(params.get('step')) || 1));

  if (onboardingDone && !retake) return <Navigate to="/home" replace />;

  const goTo = (n: number) =>
    setParams(retake ? { step: String(n), retake: '1' } : { step: String(n) });
  const goBack = () => (step > 1 ? goTo(step - 1) : navigate('/settings'));

  const title = retake ? 'Retake quiz' : 'Set up SubSense';

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-canvas px-2 pt-1 pb-3">
        <div className="flex h-12 items-center gap-1">
          {step > 1 || retake ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
            >
              <ArrowLeft size={22} aria-hidden />
            </button>
          ) : (
            <span className="w-3" />
          )}
          <h1 className="flex-1 text-lg font-semibold text-ink">{title}</h1>
          <span className="pr-3 text-sm text-ink-muted">
            Step {step} of {lastStep}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={lastStep}
          aria-valuenow={step}
          className="mx-3 h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${(step / lastStep) * 100}%` }}
          />
        </div>
      </header>

      {step <= QUIZ_STEPS ? (
        <QuizStep
          key={step}
          question={QUIZ[step - 1]}
          isLast={retake && step === QUIZ_STEPS}
          onBack={step > 1 ? goBack : undefined}
          onNext={() => {
            if (retake && step === QUIZ_STEPS) {
              useDataStore.getState().applyQuiz({ retake: true });
              showToast('Quiz updated. Your picks will reflect your new answers.');
              navigate('/settings');
            } else {
              goTo(step + 1);
            }
          }}
        />
      ) : step === 7 ? (
        <BudgetStep onBack={goBack} onNext={() => goTo(8)} />
      ) : (
        <ServicesStep
          onBack={goBack}
          onFinish={(ids) => {
            const store = useDataStore.getState();
            store.addSubscriptionsFromCatalog(ids);
            store.completeOnboarding();
            navigate('/home', { replace: true });
          }}
        />
      )}
    </div>
  );
}

// ---------- Step layout ----------

function StepBody({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
      <h2 className="text-2xl leading-tight font-bold text-ink">{heading}</h2>
      {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </main>
  );
}

function StepFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex shrink-0 gap-3 border-t border-line bg-canvas px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">
      {children}
    </footer>
  );
}

// ---------- Steps 1–6: quiz ----------

function QuizStep({
  question,
  isLast,
  onBack,
  onNext,
}: {
  question: QuizQuestion;
  isLast: boolean;
  onBack?: () => void;
  onNext: () => void;
}) {
  const value = useDataStore((s) => s.profile.quizAnswers[question.key]);
  const setAnswer = useDataStore((s) => s.setQuizAnswer);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const answered = selected.length > 0;

  const toggle = (id: string) => {
    if (question.multi) {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      setAnswer(question.key, next as QuizAnswers[typeof question.key]);
    } else {
      setAnswer(question.key, id as QuizAnswers[typeof question.key]);
    }
  };

  const skip = () => {
    setAnswer(question.key, (question.multi ? [] : '') as QuizAnswers[typeof question.key]);
    onNext();
  };

  return (
    <>
      <StepBody
        heading={question.title}
        sub={question.multi ? 'Pick as many as you like.' : undefined}
      >
        <div
          role={question.multi ? 'group' : 'radiogroup'}
          aria-label={question.title}
          className="flex flex-col gap-3"
        >
          {question.options.map((opt) => (
            <OptionCard
              key={opt.id}
              label={opt.label}
              icon={opt.icon}
              multi={question.multi}
              selected={selected.includes(opt.id)}
              onToggle={() => toggle(opt.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={skip}
          className="mt-4 min-h-11 w-full text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Skip for now
        </button>
      </StepBody>
      <StepFooter>
        {onBack && (
          <Button variant="secondary" size="lg" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button size="lg" onClick={onNext} disabled={!answered} className="flex-1">
          {isLast ? 'Save answers' : 'Next'}
        </Button>
      </StepFooter>
    </>
  );
}

// ---------- Step 7: budget ----------

function BudgetStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const budget = useDataStore((s) => s.profile.budgetPaise);
  const setBudget = useDataStore((s) => s.setBudget);
  const occupation = useDataStore((s) => s.profile.quizAnswers.q3);

  return (
    <>
      <StepBody
        heading="What's your monthly subscription budget?"
        sub="We'll warn you as you get close. You can change it any time in Settings."
      >
        <BudgetPicker valuePaise={budget} onChange={(p) => setBudget(p)} />
        <p className="mt-6 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-muted">
          {budgetHint(occupation)} (Our estimate.)
        </p>
      </StepBody>
      <StepFooter>
        <Button variant="secondary" size="lg" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button size="lg" onClick={onNext} className="flex-1">
          Next
        </Button>
      </StepFooter>
    </>
  );
}

// ---------- Step 8: existing services ----------

function ServicesStep({
  onBack,
  onFinish,
}: {
  onBack: () => void;
  onFinish: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const groups = catalogByCategory();
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <StepBody
        heading="Which of these do you already pay for?"
        sub="We'll add them with typical prices. You can fix plans and dates afterwards."
      >
        <div className="flex flex-col gap-5">
          {groups.map(({ category, items }) => (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h3 id={`cat-${category}`} className="mb-2 text-sm font-semibold text-ink-muted">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const on = picked.includes(item.id);
                  const plan = item.plans[0];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(item.id)}
                      className={cn(
                        'flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                        on
                          ? 'border-brand bg-brand text-white'
                          : 'border-line bg-surface text-ink hover:border-brand/60',
                      )}
                    >
                      {on && <Check size={16} aria-hidden />}
                      {item.name}
                      {plan && (
                        <span className={cn('text-xs', on ? 'text-white/85' : 'text-ink-muted')}>
                          {formatRs(monthlyEquivalentPaise(plan.pricePaise, plan.cycle))}/mo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          Prices are typical and not yet checked against official sites. Check the official site for
          current prices.
        </p>
      </StepBody>
      <StepFooter>
        <Button variant="secondary" size="lg" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button size="lg" onClick={() => onFinish(picked)} className="flex-1">
          {picked.length > 0 ? `Add ${picked.length} and finish` : 'Finish'}
        </Button>
      </StepFooter>
    </>
  );
}
