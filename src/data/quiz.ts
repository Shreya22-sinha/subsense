import {
  BookOpen,
  Briefcase,
  Car,
  Coins,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Headphones,
  HeartPulse,
  Languages,
  Laptop,
  Library,
  Palette,
  PiggyBank,
  Scale,
  Sofa,
  Sparkles,
  TrendingUp,
  Tv,
  User,
  Users,
  UserRound,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import type { QuizAnswers } from '@/types/models';

export interface QuizOption {
  /** Stable id; scoring rules in src/engine/quizScoring.ts key on it. */
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface QuizQuestion {
  key: keyof QuizAnswers;
  title: string;
  multi: boolean;
  options: QuizOption[];
}

/** The 6 onboarding questions (PRD 6.4, steps 1 to 6). */
export const QUIZ: QuizQuestion[] = [
  {
    key: 'q1',
    title: 'What does your free time look like?',
    multi: true,
    options: [
      { id: 'binge', label: 'Binge-watching shows', icon: Tv },
      { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
      { id: 'reading', label: 'Reading', icon: BookOpen },
      { id: 'workout', label: 'Working out', icon: Dumbbell },
      { id: 'learning', label: 'Learning new skills', icon: GraduationCap },
      { id: 'making', label: 'Making things (music, video, art)', icon: Palette },
    ],
  },
  {
    key: 'q2',
    title: 'How much music do you listen to?',
    multi: false,
    options: [
      { id: 'all_day', label: 'All day', icon: Headphones },
      { id: 'commute', label: 'On my commute', icon: Car },
      { id: 'rarely', label: 'Rarely', icon: VolumeX },
    ],
  },
  {
    key: 'q3',
    title: 'What do you do?',
    multi: false,
    options: [
      { id: 'student', label: 'Student', icon: GraduationCap },
      { id: 'professional', label: 'Working professional', icon: Briefcase },
      { id: 'freelancer', label: 'Freelancer or self-employed', icon: Laptop },
      { id: 'other', label: 'Other', icon: UserRound },
    ],
  },
  {
    key: 'q4',
    title: 'Do you share subscriptions with family or friends?',
    multi: false,
    options: [
      { id: 'often', label: 'Yes, often', icon: Users },
      { id: 'sometimes', label: 'Sometimes', icon: UserRound },
      { id: 'never', label: 'No', icon: User },
    ],
  },
  {
    key: 'q5',
    title: 'What matters more to you?',
    multi: false,
    options: [
      { id: 'low', label: 'Lowest price', icon: Coins },
      { id: 'quality', label: 'Best quality', icon: Sparkles },
      { id: 'balanced', label: 'A balance', icon: Scale },
    ],
  },
  {
    key: 'q6',
    title: 'Any goals this year?',
    multi: true,
    options: [
      { id: 'get_fit', label: 'Get fit', icon: HeartPulse },
      { id: 'language', label: 'Learn a language', icon: Languages },
      { id: 'read_more', label: 'Read more', icon: Library },
      { id: 'save_money', label: 'Save money', icon: PiggyBank },
      { id: 'career', label: 'Grow my career', icon: TrendingUp },
      { id: 'relax', label: 'Relax more', icon: Sofa },
    ],
  },
];

export const BUDGET = {
  minPaise: 50000,
  maxPaise: 1000000,
  stepPaise: 10000,
  defaultPaise: 200000,
} as const;

/**
 * Budget hint for onboarding step 7, based on quiz question 3 (what you do).
 * We never ask for age, so the hint uses an answer the user actually gave.
 * Ranges are rough estimates, labelled as such in the UI.
 */
export function budgetHint(q3: string): string {
  switch (q3) {
    case 'student':
      return 'Students often spend about ₹500 to ₹1,500 a month.';
    case 'professional':
      return 'Working professionals often spend about ₹1,500 to ₹3,000 a month.';
    case 'freelancer':
      return 'Freelancers often spend about ₹1,500 to ₹3,000 a month, including work tools.';
    default:
      return 'Many people spend about ₹1,000 to ₹2,500 a month.';
  }
}

export const ONBOARDING_STEPS = 8;
export const QUIZ_STEPS = QUIZ.length;
