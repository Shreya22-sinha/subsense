/**
 * Integration tests for accounts + per-user persistence (PRD step 2 acceptance):
 * register, log out, log in again; wrong password; two accounts never see each other's data.
 */
import { createFakeCloud } from '@/cloud/fake';
import { setCloud } from '@/cloud';
import { emptyUserData } from '@/engine/userData';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { computeActionItems } from '@/engine/actions';
import { computePicks } from '@/engine/recommendations';
import { CATALOG } from '@/data/catalog';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage() });
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage() });

type AuthModule = typeof import('./authStore');
type DataModule = typeof import('./dataStore');
type ClockModule = typeof import('./clockStore');
type EffectsModule = typeof import('./effects');
let auth: AuthModule;
let data: DataModule;
let clock: ClockModule;
let effects: EffectsModule;
let sync: typeof import('./sync');
const fake = createFakeCloud();

beforeAll(async () => {
  setCloud(fake.cloud);
  auth = await import('./authStore');
  data = await import('./dataStore');
  clock = await import('./clockStore');
  effects = await import('./effects');
  sync = await import('./sync');
  effects.startStoreEffects();
});

beforeEach(async () => {
  fake.state.offline = false;
  await auth.useAuthStore.getState().logout();
  clock.useClockStore.getState().resetOffset();
});

const A = { name: 'Isha Rao', email: 'Isha@Example.com', password: 'secret123' };
const B = { name: 'Karan Mehta', email: 'karan@example.com', password: 'hunter123' };

describe('accounts', () => {
  const state = () => auth.useAuthStore.getState();
  const login = (who: typeof A, remember = true) => state().login({ ...who, remember });
  const store = () => data.useDataStore.getState();
  const uid = () => state().sessionUserId!;

  it('registers with a lower-cased email and signs in', async () => {
    expect((await state().register(A)).ok).toBe(true);
    expect(state().user).toMatchObject({
      email: 'isha@example.com',
      name: 'Isha Rao',
      isDemo: false,
    });
    expect(store().activities.map((a) => a.type)).toEqual(['account_created']);
    await sync.flush();
    expect(fake.rows.has(uid())).toBe(true);
  });

  it('never keeps a password in the browser', () => {
    const everything = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.getItem(localStorage.key(i)!),
    ).join();
    expect(everything).not.toContain(A.password);
  });

  it('rejects a duplicate email', async () => {
    expect(await state().register({ ...A, email: 'ISHA@example.com' })).toEqual({
      ok: false,
      message: 'An account with this email already exists',
      field: 'email',
    });
  });

  it('keeps each account’s data separate, and leaves nothing behind on logout', async () => {
    await login(A);
    const idA = uid();
    store().addSubscriptionsFromCatalog(['netflix', 'spotify']);
    store().completeOnboarding();
    await state().logout();
    expect(localStorage.getItem(`subsense_data_${idA}`)).toBeNull();
    expect(store().subscriptions).toHaveLength(0);

    await state().register(B);
    expect(store().subscriptions).toHaveLength(0);
    expect(store().profile.onboardingDone).toBe(false);
    await state().logout();

    await login(A);
    expect(store().subscriptions.map((s) => s.name)).toEqual(['Netflix', 'Spotify']);
    expect(store().profile.onboardingDone).toBe(true);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrongPw = await login({ ...A, password: 'nope1234' });
    const noUser = await login({ ...A, email: 'x@y.com' });
    expect(wrongPw).toEqual({
      ok: false,
      message: 'Email or password is incorrect',
      field: 'form',
    });
    expect(noUser).toEqual(wrongPw);
    expect(state().sessionUserId).toBeNull();
  });

  it('uses sessionStorage for everything when Remember me is off', async () => {
    await login(A, false);
    const id = uid();
    expect(localStorage.getItem('subsense_auth')).toBeNull();
    expect(localStorage.getItem(`subsense_data_${id}`)).toBeNull();
    expect(sessionStorage.getItem('subsense_auth')).toBe(id);
    expect(sessionStorage.getItem(`subsense_data_${id}`)).not.toBeNull();
  });

  it('restores the session on load', async () => {
    await login(A);
    const id = uid();
    await sync.flush();
    auth.useAuthStore.setState({ user: null, sessionUserId: null });
    await auth.initAuth();
    expect(uid()).toBe(id);
    expect(store().subscriptions).toHaveLength(2);
  });

  it('counts each time a real account is opened', async () => {
    const opens = fake.state.opens;
    await login(A);
    expect(fake.state.opens).toBe(opens + 1);
  });

  it('always uses the real date for real accounts', async () => {
    clock.useClockStore.getState().advanceDays(30);
    await login(A);
    expect(clock.useClockStore.getState().offsetDays).toBe(0);
  });

  it('deletes the account and everything saved', async () => {
    const D = { name: 'Del Me', email: 'del@example.com', password: 'deleteme1' };
    await state().register(D);
    const id = uid();
    await sync.flush();
    expect(await state().deleteAccount()).toBe(true);
    expect(fake.rows.has(id)).toBe(false);
    expect(localStorage.getItem(`subsense_data_${id}`)).toBeNull();
    expect(state().sessionUserId).toBeNull();
    expect((await login(D)).ok).toBe(false);
  });

  it('says so, and deletes nothing, when the server cannot be reached', async () => {
    await login(A);
    const id = uid();
    fake.state.offline = true;
    expect(await state().deleteAccount()).toBe(false);
    expect(uid()).toBe(id);
    expect(store().subscriptions).toHaveLength(2);
  });
});

describe('sync', () => {
  const state = () => auth.useAuthStore.getState();
  const store = () => data.useDataStore.getState();
  const remote = (id: string) => fake.rows.get(id)!.data as ReturnType<typeof emptyUserData>;
  const S = { name: 'Sync Test', email: 'sync@example.com', password: 'syncsync1' };
  let id = '';

  beforeEach(async () => {
    const r = await state().register(S);
    if (!r.ok) await state().login({ ...S, remember: true });
    id = state().sessionUserId!;
    store().replaceAll(emptyUserData());
    store().addSubscriptionsFromCatalog(['netflix']);
    await sync.flush();
    expect(remote(id).subscriptions).toHaveLength(1);
  });

  it('a failed load at sign-in shows an error and never overwrites saved data', async () => {
    await state().logout();
    const original = fake.cloud.loadData;
    fake.cloud.loadData = () => Promise.reject(new Error('down'));
    const r = await state().login({ ...S, remember: true });
    fake.cloud.loadData = original;
    expect(r.ok).toBe(false);
    expect(state().sessionUserId).toBeNull();
    expect(remote(id).subscriptions).toHaveLength(1);
  });

  it('a failed load on opening the app can be retried, with nothing lost', async () => {
    localStorage.removeItem(`subsense_data_${id}`);
    const original = fake.cloud.loadData;
    fake.cloud.loadData = () => Promise.reject(new Error('down'));
    await auth.initAuth();
    expect(state().status).toBe('failed');
    await sync.flush();
    fake.cloud.loadData = original;
    expect(remote(id).subscriptions).toHaveLength(1);
    await auth.initAuth();
    expect(state().status).toBe('ready');
    expect(store().subscriptions).toHaveLength(1);
  });

  it('refuses to load unreadable saved data rather than replacing it', async () => {
    await state().logout();
    fake.rows.set(id, { data: { profile: 'broken' }, updatedAt: 'x' });
    expect((await state().login({ ...S, remember: true })).ok).toBe(false);
    expect(fake.rows.get(id)!.data).toEqual({ profile: 'broken' });
    fake.rows.delete(id);
  });

  it('clearing or switching the store is never saved as a change', async () => {
    data.bindDataStoreToUser(null);
    await sync.flush();
    expect(remote(id).subscriptions).toHaveLength(1);
    await auth.initAuth();
  });

  it('keeps offline changes and sends them after reopening', async () => {
    fake.state.offline = true;
    store().addSubscriptionsFromCatalog(['spotify']);
    await sync.flush();
    expect(sync.useSyncStore.getState().status).toBe('waiting');
    await auth.initAuth(); // reopened, still offline: the browser copy is used
    expect(store().subscriptions).toHaveLength(2);
    fake.state.offline = false;
    await auth.initAuth(); // reopened, back online
    await sync.flush();
    expect(remote(id).subscriptions).toHaveLength(2);
    expect(sync.useSyncStore.getState().status).toBe('saved');
  });

  it('keeps unsaved changes through an offline logout', async () => {
    fake.state.offline = true;
    store().addSubscriptionsFromCatalog(['spotify']);
    await state().logout();
    fake.state.offline = false;
    await state().login({ ...S, remember: true });
    await sync.flush();
    expect(remote(id).subscriptions.map((s) => s.name)).toEqual(['Netflix', 'Spotify']);
  });

  it('another device’s newer save is loaded, not overwritten', async () => {
    const other = { ...remote(id), profile: { ...remote(id).profile, budgetPaise: 777700 } };
    fake.saveElsewhere(id, other);
    store().addSubscriptionsFromCatalog(['spotify']);
    await sync.flush();
    expect(store().profile.budgetPaise).toBe(777700);
    expect(remote(id).profile.budgetPaise).toBe(777700);
  });

  it('keeps local edits when a save arrived but its reply was lost', async () => {
    fake.state.loseNextReply = true;
    store().addSubscriptionsFromCatalog(['spotify']);
    await sync.flush();
    store().addSubscriptionsFromCatalog(['canva']);
    await sync.flush();
    await sync.flush();
    expect(remote(id).subscriptions.map((s) => s.name)).toEqual(['Netflix', 'Spotify', 'Canva']);
  });

  it('logs out here when the login ends in another tab', async () => {
    fake.changeUser(null);
    await new Promise((r) => setTimeout(r, 20));
    expect(state().sessionUserId).toBeNull();
  });
});

describe('demo account', () => {
  const state = () => auth.useAuthStore.getState();

  it('signs in with seeded, onboarded data and cannot be used with a password', async () => {
    state().loginDemo();
    expect(state().user).toMatchObject({ email: 'demo@subsense.app', isDemo: true });
    expect(data.useDataStore.getState().profile.onboardingDone).toBe(true);
    expect(data.useDataStore.getState().profile.interestScores.Learning).toBeGreaterThanOrEqual(40);
    expect(data.useDataStore.getState().profile.interestScores.Reading).toBeGreaterThanOrEqual(40);
    expect(data.useDataStore.getState().subscriptions.length).toBeGreaterThan(0);

    await state().logout();
    const res = await state().login({ email: 'demo@subsense.app', password: '', remember: true });
    expect(res.ok).toBe(false);
  });

  it('works offline, saves nothing to the cloud and is counted once a day', async () => {
    const { saves, opens } = fake.state;
    localStorage.removeItem('subsense_demo_day');
    const visits = fake.state.demoVisits;
    state().loginDemo();
    state().loginDemo();
    expect(fake.state.demoVisits).toBe(visits + 1);
    data.useDataStore.getState().addSubscriptionsFromCatalog(['canva']);
    fake.state.offline = true;
    await auth.initAuth();
    expect(state().user?.isDemo).toBe(true);
    expect(fake.state.saves).toBe(saves);
    expect(fake.state.opens).toBe(opens);
  });

  it('rebuilds demo data on every load', async () => {
    state().loginDemo();
    data.useDataStore.getState().replaceAll({ ...data.useDataStore.getState(), subscriptions: [] });
    await state().logout();
    state().loginDemo();
    expect(data.useDataStore.getState().subscriptions.length).toBeGreaterThan(0);
  });
});
describe('subscriptions', () => {
  const C = { name: 'Neha Shah', email: 'neha@example.com', password: 'student1' };
  const today = () => clock.getToday();
  const netflix = (startDate: string) => ({
    name: 'Netflix',
    category: 'Video' as const,
    pricePaise: 64900,
    cycle: 'monthly' as const,
    startDate,
  });

  beforeEach(async () => {
    const res = await auth.useAuthStore.getState().register(C);
    if (!res.ok) await auth.useAuthStore.getState().login({ ...C, remember: true });
    data.useDataStore.getState().replaceAll({
      ...data.useDataStore.getState(),
      subscriptions: [],
      charges: [],
      activities: [],
      savings: [],
      priceChanges: [],
    });
  });

  it('adds with payment history and logs it', () => {
    const s = data.useDataStore.getState().addSubscription(netflix(today()));
    const state = data.useDataStore.getState();
    expect(state.charges.filter((c) => c.subId === s.id)).toHaveLength(1);
    expect(state.activities.map((a) => a.type)).toEqual(['subscription_added']);
  });

  it('keeps edits after a reload', async () => {
    const s = data.useDataStore.getState().addSubscription(netflix(today()));
    data.useDataStore
      .getState()
      .updateSubscription(s.id, { ...netflix(today()), pricePaise: 79900 });
    await sync.flush();
    await auth.initAuth();
    const state = data.useDataStore.getState();
    expect(state.subscriptions[0].pricePaise).toBe(79900);
    expect(state.priceChanges).toHaveLength(1);
    expect(state.activities.map((a) => a.type)).toEqual([
      'subscription_added',
      'subscription_edited',
      'price_changed',
    ]);
  });

  it('delete removes related records and undo restores them', () => {
    const s = data.useDataStore.getState().addSubscription(netflix(today()));
    const snap = data.useDataStore.getState().deleteSubscription(s.id)!;
    expect(data.useDataStore.getState().subscriptions).toHaveLength(0);
    expect(data.useDataStore.getState().charges).toHaveLength(0);
    data.useDataStore.getState().restoreSubscription(snap);
    expect(data.useDataStore.getState().subscriptions[0].id).toBe(s.id);
    expect(data.useDataStore.getState().charges).toHaveLength(1);
    expect(data.useDataStore.getState().activities.map((a) => a.type)).toEqual([
      'subscription_added',
    ]);
  });

  it('runs rollover when the demo clock moves forward', () => {
    const s = data.useDataStore.getState().addSubscription(netflix(today()));
    clock.useClockStore.getState().advanceMonth();
    // Exactly one month later the charge is due today, not yet past (PRD 7.1).
    expect(data.useDataStore.getState().charges).toHaveLength(1);
    expect(data.useDataStore.getState().subscriptions[0].nextChargeDate).toBe(today());
    clock.useClockStore.getState().advanceDays(1);
    const state = data.useDataStore.getState();
    expect(state.charges.filter((c) => c.subId === s.id)).toHaveLength(2);
    expect(state.activities.at(-1)?.type).toBe('charged');
    expect(state.subscriptions[0].nextChargeDate! > today()).toBe(true);
  });

  it('converts a trial when the clock passes its end', () => {
    const s = data.useDataStore
      .getState()
      .addSubscription({ ...netflix(today()), isTrial: true, trialDays: 7 });
    clock.useClockStore.getState().advanceDays(8);
    const sub = data.useDataStore.getState().subscriptions.find((x) => x.id === s.id)!;
    expect(sub.isTrial).toBe(false);
    expect(data.useDataStore.getState().activities.at(-1)?.type).toBe('trial_converted');
  });

  it('pause stops rollover; cancel records a saving', () => {
    const s = data.useDataStore.getState().addSubscription(netflix(today()));
    data.useDataStore.getState().pauseSubscription(s.id);
    clock.useClockStore.getState().advanceMonth();
    expect(data.useDataStore.getState().charges).toHaveLength(1);
    data.useDataStore.getState().resumeSubscription(s.id);
    data.useDataStore.getState().cancelSubscription(s.id);
    const state = data.useDataStore.getState();
    expect(state.subscriptions[0].status).toBe('cancelled');
    expect(state.savings).toEqual([
      expect.objectContaining({ subId: s.id, monthlyPaise: 64900, source: 'cancel' }),
    ]);
  });
});

describe('usage and the Action Center', () => {
  const D = { name: 'Karan Mehta', email: 'karan2@example.com', password: 'hunter123' };
  const items = () => {
    const s = data.useDataStore.getState();
    return computeActionItems(s, clock.getToday());
  };

  beforeEach(async () => {
    const res = await auth.useAuthStore.getState().register(D);
    if (!res.ok) await auth.useAuthStore.getState().login({ ...D, remember: true });
    data.useDataStore.getState().replaceAll({
      ...data.useDataStore.getState(),
      subscriptions: [],
      charges: [],
      usages: [],
      activities: [],
      actionStates: [],
      priceChanges: [],
    });
  });

  it('logs one use per day and undoes it', () => {
    const s = data.useDataStore.getState().addSubscription({
      name: 'Spotify',
      category: 'Music',
      pricePaise: 13900,
      cycle: 'monthly',
      startDate: clock.getToday(),
    });
    const first = data.useDataStore.getState().logUsage(s.id);
    expect(first.status).toBe('logged');
    expect(data.useDataStore.getState().logUsage(s.id).status).toBe('already');
    if (first.status === 'logged')
      data.useDataStore.getState().undoUsage(first.usageId, first.activityId);
    expect(data.useDataStore.getState().usages).toHaveLength(0);
    expect(data.useDataStore.getState().activities.map((a) => a.type)).toEqual([
      'subscription_added',
    ]);
  });

  it('+1 week moves a trial into Urgent; acting removes it', () => {
    data.useDataStore.getState().addSubscription({
      name: 'CineLite',
      category: 'Video',
      pricePaise: 14900,
      cycle: 'monthly',
      startDate: clock.getToday(),
      isTrial: true,
      trialDays: 9,
    });
    expect(items().filter((i) => i.level === 'urgent')).toHaveLength(0);
    clock.useClockStore.getState().advanceDays(7);
    const urgent = items().filter((i) => i.level === 'urgent');
    expect(urgent).toHaveLength(1);
    data.useDataStore.getState().resolveAction(urgent[0], 'keep');
    expect(items().filter((i) => i.level === 'urgent')).toHaveLength(0);
    expect(data.useDataStore.getState().activities.at(-1)).toMatchObject({
      type: 'decision_made',
      data: { decision: 'keep', source: 'action_center' },
    });
  });

  it('Confirm appears after a rollover charge; "No, I\'d cancelled" removes it', () => {
    const s = data.useDataStore.getState().addSubscription({
      name: 'Netflix',
      category: 'Video',
      pricePaise: 64900,
      cycle: 'weekly',
      startDate: clock.getToday(),
      usageRating: 4,
    });
    clock.useClockStore.getState().advanceDays(8);
    const confirm = items().find((i) => i.level === 'confirm');
    expect(confirm).toBeDefined();
    data.useDataStore.getState().rejectCharge(confirm!);
    const state = data.useDataStore.getState();
    expect(state.subscriptions[0]).toMatchObject({ id: s.id, status: 'cancelled' });
    expect(state.charges).toHaveLength(1); // only the backfilled first payment remains
    expect(state.savings[0]).toMatchObject({ subId: s.id, source: 'cancel' });
    expect(items().find((i) => i.level === 'confirm')).toBeUndefined();
  });

  it('snooze hides an item until the next demo day', () => {
    data.useDataStore.getState().addSubscription({
      name: 'Cult.fit',
      category: 'Fitness',
      pricePaise: 39900,
      cycle: 'monthly',
      startDate: clock.getToday(),
      isTrial: true,
      trialDays: 2,
    });
    const urgent = items()[0];
    data.useDataStore.getState().snoozeAction(urgent);
    expect(items()).toHaveLength(0);
    clock.useClockStore.getState().advanceDays(1);
    expect(items().map((i) => i.level)).toContain('urgent');
  });

  it('records a price-hike reminder that becomes a Review item 3 days before renewal', () => {
    const s = data.useDataStore.getState().addSubscription({
      name: 'YouTube Premium',
      category: 'Music',
      pricePaise: 12900,
      cycle: 'monthly',
      startDate: clock.getToday(),
      usageRating: 4,
    });
    const result = data.useDataStore.getState().updateSubscription(s.id, {
      name: 'YouTube Premium',
      category: 'Music',
      pricePaise: 14900,
      cycle: 'monthly',
      startDate: clock.getToday(),
      usageRating: 4,
    })!;
    data.useDataStore.getState().remindPriceHikeAtRenewal(result.priceChangeId!);
    expect(items()).toHaveLength(0);
    const next = data.useDataStore.getState().subscriptions[0].nextChargeDate!;
    const daysToGo = Math.round((Date.parse(next) - Date.parse(clock.getToday())) / 86_400_000);
    clock.useClockStore.getState().advanceDays(daysToGo - 3);
    expect(items()[0]).toMatchObject({ level: 'review' });
    expect(items()[0].reason).toMatch(/^Price went up to ₹149\./);
  });
});

describe('recommendations and settings data', () => {
  const picks = () => computePicks(data.useDataStore.getState(), CATALOG, clock.getToday()).ranked;

  beforeEach(() => {
    auth.useAuthStore.getState().loginDemo();
  });

  it('Go annual: switches to yearly from the next renewal and records a saving', () => {
    const pick = picks().find((p) => p.type === 'go_annual')!;
    const before = data.useDataStore.getState().subscriptions.find((s) => s.id === pick.subId)!;
    data.useDataStore.getState().applyPlanChange(pick);
    const s = data.useDataStore.getState();
    const after = s.subscriptions.find((x) => x.id === pick.subId)!;
    expect(after).toMatchObject({
      cycle: 'yearly',
      pricePaise: pick.newPricePaise,
      nextChargeDate: before.nextChargeDate,
    });
    expect(s.savings.at(-1)).toMatchObject({
      subId: pick.subId,
      source: 'switch_annual',
      monthlyPaise: pick.monthlySavingPaise,
    });
    expect(s.activities.at(-1)?.type).toBe('recommendation_accepted');
    expect(picks().find((p) => p.id === pick.id)).toBeUndefined(); // condition no longer holds
  });

  it('Swap: cancels the old one and adds the new one from its next charge', () => {
    const pick = picks().find((p) => p.type === 'swap' && p.catalogId !== undefined)!;
    const old = data.useDataStore.getState().subscriptions.find((s) => s.id === pick.subId)!;
    data.useDataStore.getState().applySwap(pick);
    const s = data.useDataStore.getState();
    expect(s.subscriptions.find((x) => x.id === old.id)?.status).toBe('cancelled');
    const added = s.subscriptions.at(-1)!;
    expect(added).toMatchObject({
      catalogId: pick.catalogId,
      startDate: old.nextChargeDate,
      status: 'active',
    });
    expect(s.savings.at(-1)).toMatchObject({ source: 'swap' });
  });

  it('Not for me hides a pick for 30 days and logs the reason', () => {
    const pick = picks()[0];
    data.useDataStore.getState().dismissPick(pick, 'not_relevant');
    expect(picks().find((p) => p.id === pick.id)).toBeUndefined();
    expect(data.useDataStore.getState().activities.at(-1)).toMatchObject({
      type: 'recommendation_dismissed',
      data: { reason: 'not_relevant' },
    });
  });

  it('going over budget removes Discover; Trim pause records a saving that ends on resume', () => {
    expect(picks().some((p) => p.type === 'discover')).toBe(true);
    data.useDataStore.getState().setBudget(100000);
    expect(picks().some((p) => p.type === 'discover')).toBe(false);

    const trim = picks().find((p) => p.type === 'trim')!;
    data.useDataStore.getState().pauseFromPick(trim);
    expect(
      data.useDataStore
        .getState()
        .savings.some((s) => s.subId === trim.subId && s.source === 'pause'),
    ).toBe(true);
    data.useDataStore.getState().resumeSubscription(trim.subId!);
    expect(
      data.useDataStore
        .getState()
        .savings.some((s) => s.subId === trim.subId && s.source === 'pause'),
    ).toBe(false);
  });

  it('vibe check answers set liking and lastVibeCheckAt', () => {
    const sub = data.useDataStore.getState().subscriptions.find((s) => s.status === 'active')!;
    data.useDataStore.getState().answerVibeCheck(sub.id, 'not_really');
    const after = data.useDataStore.getState().subscriptions.find((s) => s.id === sub.id)!;
    expect(after).toMatchObject({ liking: 'meh', lastVibeCheckAt: clock.getToday() });
  });

  it('logs budget_exceeded once per month when going over budget', () => {
    data.useDataStore.getState().setBudget(100000);
    data.useDataStore.getState().setBudget(90000);
    const exceeded = data.useDataStore
      .getState()
      .activities.filter((a) => a.type === 'budget_exceeded');
    expect(exceeded).toHaveLength(1);
  });

  it('clear data wipes the user data', () => {
    data.useDataStore.getState().clearAllData();
    const s = data.useDataStore.getState();
    expect(s.subscriptions).toHaveLength(0);
    expect(s.profile.onboardingDone).toBe(false);
    expect(s.activities.map((a) => a.type)).toEqual(['data_cleared']);
  });
});
