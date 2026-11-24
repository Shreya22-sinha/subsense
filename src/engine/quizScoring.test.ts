import { describe, expect, it } from 'vitest';
import { emptyQuizAnswers, interests, scoreQuiz } from './quizScoring';

describe('scoreQuiz', () => {
  it('gives neutral defaults for a fully skipped quiz', () => {
    const r = scoreQuiz(emptyQuizAnswers());
    expect(Object.values(r.interestScores).every((v) => v === 0)).toBe(true);
    expect(r).toMatchObject({
      isStudent: false,
      sharesPlans: 'never',
      pricePreference: 'balanced',
      savingsFocus: false,
    });
  });

  it('adds free-time and goal points per the table', () => {
    const r = scoreQuiz({
      ...emptyQuizAnswers(),
      q1: ['binge', 'making'],
      q6: ['relax', 'career'],
    });
    expect(r.interestScores.Video).toBe(55); // 40 + 15
    expect(r.interestScores.Productivity).toBe(40); // 20 + 20
    expect(r.interestScores.Cloud).toBe(20);
    expect(r.interestScores.Music).toBe(25); // 10 + 15
    expect(r.interestScores.Gaming).toBe(10);
    expect(r.interestScores.Learning).toBe(20);
  });

  it('caps scores at 100', () => {
    const r = scoreQuiz({
      ...emptyQuizAnswers(),
      q1: ['learning'],
      q3: 'student',
      q6: ['language', 'career'],
    });
    expect(r.interestScores.Learning).toBe(100); // 40 + 10 + 30 + 20
  });

  it('sets profile flags', () => {
    const r = scoreQuiz({
      ...emptyQuizAnswers(),
      q2: 'all_day',
      q3: 'student',
      q4: 'often',
      q5: 'low',
      q6: ['save_money'],
    });
    expect(r.interestScores.Music).toBe(40);
    expect(r.isStudent).toBe(true);
    expect(r.sharesPlans).toBe('often');
    expect(r.pricePreference).toBe('low');
    expect(r.savingsFocus).toBe(true);
  });

  it('scores freelancers higher on productivity than professionals', () => {
    const pro = scoreQuiz({ ...emptyQuizAnswers(), q3: 'professional' });
    const free = scoreQuiz({ ...emptyQuizAnswers(), q3: 'freelancer' });
    expect([pro.interestScores.Productivity, pro.interestScores.Cloud]).toEqual([20, 10]);
    expect([free.interestScores.Productivity, free.interestScores.Cloud]).toEqual([30, 20]);
  });
});

describe('interests', () => {
  it('lists categories at 40+ sorted by score', () => {
    const r = scoreQuiz({ ...emptyQuizAnswers(), q1: ['reading', 'learning'], q6: ['language'] });
    expect(interests(r.interestScores)).toEqual(['Learning', 'Reading']);
  });
});
