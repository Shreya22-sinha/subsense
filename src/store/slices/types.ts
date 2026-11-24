import type { StateCreator } from 'zustand';
import type { ActivityType, UserData } from '@/types/models';
import type { ActionSlice } from './actionSlice';
import type { PickSlice } from './pickSlice';
import type { ProfileSlice } from './profileSlice';
import type { SubscriptionSlice } from './subscriptionSlice';
import type { UsageSlice } from './usageSlice';

export interface ActivityOpts {
  subId?: string;
  data?: Record<string, unknown>;
  /** Override the timestamp (e.g. a charge logged at its charge date). Defaults to demo now. */
  at?: string;
}

export interface CoreSlice {
  logActivity: (type: ActivityType, text: string, opts?: ActivityOpts) => string;
  replaceAll: (data: UserData) => void;
}

export type DataState = UserData &
  CoreSlice &
  ProfileSlice &
  SubscriptionSlice &
  UsageSlice &
  ActionSlice &
  PickSlice;

/** A slice creator that can see the whole data state. */
export type DataSlice<T> = StateCreator<DataState, [['zustand/persist', unknown]], [], T>;
