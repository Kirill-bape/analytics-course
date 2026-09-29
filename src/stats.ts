// Подсчёт статистики: проценты, серия дней, отставание от плана.

import { allTopics, plan, taskKey, topicsForPlanItem, type Topic, type PlanWeek } from './content';
import { todayKey, type ProgressData } from './progress';

const DAY = 86_400_000;
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export function topicStats(topic: Topic, data: ProgressData) {
  const total = topic.tasks.length;
  const solved = topic.tasks.filter((t) => data.tasks[taskKey(topic, t)]?.solved).length;
  return { total, solved, done: total > 0 && solved === total, started: solved > 0 };
}

/** Процент по всему курсу: каждая тема весит одинаково, неготовые темы считаются как 0 */
export function coursePercent(data: ProgressData): number {
  if (!allTopics.length) return 0;
  const sum = allTopics.reduce((s, t) => {
    const st = topicStats(t, data);
    return s + (st.total ? st.solved / st.total : 0);
  }, 0);
  return (sum / allTopics.length) * 100;
}

export function taskTotals(data: ProgressData) {
  let total = 0;
  let solved = 0;
  for (const t of allTopics) {
    const st = topicStats(t, data);
    total += st.total;
    solved += st.solved;
  }
  return { total, solved };
}

/** Первое нерешённое задание в порядке курса */
export function nextStep(data: ProgressData): Topic | undefined {
  return allTopics.find((t) => t.ready && !topicStats(t, data).done);
}

// ---------------------------------------------------------------------------
// Серия дней. Правило: один день отдыха в неделю серию не прерывает.
// ---------------------------------------------------------------------------
function weekKey(d: Date): string {
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return todayKey(monday);
}

function streakEndingAt(active: Set<string>, end: Date): number {
  let streak = 0;
  const skipped = new Set<string>();
  let d = end;
  for (let guard = 0; guard < 2000; guard++) {
    if (active.has(todayKey(d))) {
      streak++;
    } else {
      const wk = weekKey(d);
      if (skipped.has(wk)) break;
      skipped.add(wk);
    }
    d = addDays(d, -1);
  }
  return streak;
}

export function streakInfo(data: ProgressData, now = new Date()) {
  const active = new Set(data.activeDays);
  const today = todayKey(now);
  const studiedToday = active.has(today);
  // Если сегодня ещё не занимался — серия не сгорает, считаем до вчера
  const current = streakEndingAt(active, studiedToday ? now : addDays(now, -1));
  let best = current;
  for (const day of data.activeDays) best = Math.max(best, streakEndingAt(active, parseDay(day)));
  return { current, best, studiedToday, totalDays: active.size };
}

// ---------------------------------------------------------------------------
// План: сколько заданий должно быть решено к сегодняшнему дню
// ---------------------------------------------------------------------------
export interface WeekStatus {
  week: PlanWeek;
  index: number;
  topics: Topic[];
  total: number; // заданий в готовых темах
  solved: number;
  notReady: number; // тем, которые ещё не добавлены
  state: 'past' | 'current' | 'future';
}

export function weekStatuses(data: ProgressData, now = new Date()): WeekStatus[] {
  const today = parseDay(todayKey(now));
  return plan.weeks.map((week, index) => {
    const topics = week.items.flatMap(topicsForPlanItem);
    let total = 0;
    let solved = 0;
    for (const t of topics) {
      const st = topicStats(t, data);
      total += st.total;
      solved += st.solved;
    }
    const start = parseDay(week.start);
    const end = parseDay(week.end);
    const state = today > end ? 'past' : today < start ? 'future' : 'current';
    return { week, index, topics, total, solved, notReady: topics.filter((t) => !t.ready).length, state };
  });
}

export function planStatus(data: ProgressData, now = new Date()) {
  const today = parseDay(todayKey(now));
  const weeks = weekStatuses(data, now);
  let expectedStart = 0; // к началу сегодняшнего дня
  let expectedEnd = 0; // к концу сегодняшнего дня
  let solved = 0;
  for (const w of weeks) {
    solved += w.solved;
    if (!w.total) continue;
    const start = parseDay(w.week.start);
    const len = daysBetween(start, parseDay(w.week.end)) + 1;
    const doneDays = Math.min(len, Math.max(0, daysBetween(start, today)));
    expectedStart += (w.total * doneDays) / len;
    expectedEnd += (w.total * Math.min(len, doneDays + (today >= start ? 1 : 0))) / len;
  }
  const behind = Math.ceil(expectedStart - solved - 0.001);
  // Сколько заданий осталось решить сегодня, чтобы к вечеру идти по графику
  const todayGoal = Math.max(0, Math.ceil(expectedEnd - solved - 0.001));
  const goalDate = parseDay(plan.goalDate);
  const daysLeft = Math.max(0, daysBetween(today, goalDate));
  const current = weeks.find((w) => w.state === 'current');
  let state: 'ahead' | 'ontrack' | 'behind' = 'ontrack';
  if (behind >= 3) state = 'behind';
  else if (solved - expectedEnd >= 1) state = 'ahead';
  return {
    expected: Math.floor(expectedStart),
    solved,
    behind: Math.max(0, behind),
    ahead: Math.max(0, Math.floor(solved - expectedEnd)),
    todayGoal,
    daysLeft,
    state,
    currentWeek: current,
    weeks,
  };
}
