import { useState } from 'react';
import { ArrowRight, Check, Flame, HardDriveDownload, Rocket, Target, TrendingUp } from 'lucide-react';
import { modules } from '../content';
import { href } from '../router';
import { SANDBOX, todayKey, useProgress } from '../progress';
import { coursePercent, nextStep, planStatus, streakInfo, taskTotals, topicStats } from '../stats';
import { plural } from '../sql/compare';
import { IconTile, ModuleTile, ProgressRing } from '../components/ui';

function Heatmap({ activeDays }: { activeDays: string[] }) {
  const active = new Set(activeDays);
  const today = new Date();
  const weeks = 12;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const cols = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d)),
  );
  const todayStr = todayKey(today);
  return (
    <div className="heatmap" aria-label="Дни занятий">
      <div className="heatmap-days">
        {['пн', '', 'ср', '', 'пт', '', 'вс'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      {cols.map((col, i) => (
        <div className="heatmap-col" key={i}>
          {col.map((d) => {
            const k = todayKey(d);
            const future = k > todayStr;
            return (
              <span
                key={k}
                className={`cell${active.has(k) ? ' on' : ''}${future ? ' future' : ''}${k === todayStr ? ' today' : ''}`}
                title={`${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${active.has(k) ? ' — было занятие' : ''}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const SNOOZE_KEY = 'backup-reminder-snooze';

/** Раз в неделю напоминает сохранить копию прогресса в файл */
function BackupReminder() {
  const { data, loaded } = useProgress();
  const [snoozed, setSnoozed] = useState(() => {
    try {
      return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
    } catch {
      return false;
    }
  });
  const solved = Object.values(data.tasks).filter((t) => t.solved).length;
  const since = data.lastBackup ? Math.floor((Date.now() - new Date(data.lastBackup).getTime()) / 86_400_000) : null;
  if (!loaded || SANDBOX || snoozed || solved < 3 || (since !== null && since < 7)) return null;

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 3 * 86_400_000));
    } catch {
      // не страшно — напоминание просто появится снова
    }
    setSnoozed(true);
  };
  return (
    <div className="banner banner-soft" role="status">
      <span>
        <HardDriveDownload size={20} color="var(--accent)" aria-hidden />
        <span>
          {since === null ? 'Копия прогресса ещё не сохранена.' : `Последняя копия прогресса — ${since} ${plural(since, 'день', 'дня', 'дней')} назад.`} Сохрани её в
          файл, чтобы ничего не потерять и продолжать на другом устройстве.
        </span>
      </span>
      <span className="banner-actions">
        <a className="btn btn-small btn-primary" href={href('settings')}>
          Сохранить
        </a>
        <button className="btn btn-small btn-ghost" onClick={snooze}>
          Позже
        </button>
      </span>
    </div>
  );
}

function greeting(fresh: boolean): string {
  if (fresh) return 'Добро пожаловать!';
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи!';
  if (h < 12) return 'Доброе утро!';
  if (h < 18) return 'Привет! Продолжим?';
  return 'Добрый вечер!';
}

export function HomePage() {
  const { data, loaded } = useProgress();
  const pct = coursePercent(data);
  const totals = taskTotals(data);
  const streak = streakInfo(data);
  const plan = planStatus(data);
  const next = nextStep(data);
  const nextStats = next ? topicStats(next, data) : null;
  const nextModule = next ? modules.find((m) => m.id === next.moduleId) : null;
  const fresh = loaded && totals.solved === 0;
  const dateRaw = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateStr = dateRaw.charAt(0).toUpperCase() + dateRaw.slice(1);

  return (
    <div className="page">
      <div className="home-head">
        <div>
          <div className="eyebrow">
            {dateStr}
          </div>
          <h1>{greeting(fresh)}</h1>
        </div>
        <span className="streak-pill" title="Серия дней занятий">
          <Flame size={18} aria-hidden /> {streak.current}
        </span>
      </div>

      <BackupReminder />

      {fresh && (
        <div className="card welcome">
          <h2>Как здесь всё устроено</h2>
          <ol>
            <li>
              <b>Читаешь объяснение.</b> Примеры кода в уроках «живые» — их можно менять и запускать.
            </li>
            <li>
              <b>Решаешь задания.</b> Пишешь SQL-запрос, нажимаешь «Проверить» — приложение сравнит результат с правильным и объяснит ошибку.
            </li>
            <li>
              <b>Не получается?</b> Есть подсказки, а после трёх попыток можно посмотреть решение.
            </li>
            <li>
              <b>Следи за планом.</b> Во вкладке «План» видно, идёшь ли ты по графику.
            </li>
          </ol>
        </div>
      )}

      <div className="two-col">
        <div>
          {next && nextStats && nextModule && (
            <div className="card continue">
              <div className="continue-main">
                <ProgressRing value={nextStats.total ? nextStats.solved / nextStats.total : 0}>
                  {nextStats.solved}/{nextStats.total}
                </ProgressRing>
                <div className="continue-text">
                  <span className="continue-eyebrow">
                    {nextModule.title} · тема {nextModule.topics.indexOf(next) + 1}
                  </span>
                  <span className="continue-title">{next.title}</span>
                  <span className="small muted">
                    {nextStats.started
                      ? `Осталось ${nextStats.total - nextStats.solved} ${plural(nextStats.total - nextStats.solved, 'задание', 'задания', 'заданий')}`
                      : `${nextStats.total} ${plural(nextStats.total, 'задание', 'задания', 'заданий')} · новая тема`}
                  </span>
                </div>
              </div>
              <a className="btn btn-primary btn-block" href={href('topic', next.moduleId, next.id)}>
                {nextStats.started ? 'Продолжить' : 'Начать тему'} <ArrowRight size={20} aria-hidden />
              </a>
            </div>
          )}

          <div className="stats-grid">
            <div className="card stat">
              <IconTile icon={TrendingUp} tone="indigo" size={34} />
              <div className="stat-value">{pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%</div>
              <div className="stat-label">Курс пройден</div>
            </div>
            <div className="card stat">
              <IconTile icon={Check} tone="green" size={34} />
              <div className="stat-value">
                {totals.solved} <span className="stat-of">/ {totals.total}</span>
              </div>
              <div className="stat-label">Заданий решено</div>
            </div>
            <div className="card stat">
              <IconTile icon={Flame} tone="orange" size={34} />
              <div className="stat-value">
                {streak.current} <span className="stat-of">{plural(streak.current, 'день', 'дня', 'дней')}</span>
              </div>
              <div className="stat-label">{streak.studiedToday ? 'Сегодня засчитано' : `Серия · лучшая ${streak.best}`}</div>
            </div>
            <a className={`card stat plan-${plan.state}`} href={href('plan')}>
              <IconTile icon={plan.state === 'ahead' ? Rocket : Target} tone={plan.state === 'behind' ? 'orange' : 'teal'} size={34} />
              <div className="stat-value">
                {plan.state === 'behind' ? `−${plan.behind}` : plan.state === 'ahead' ? `+${plan.ahead}` : <Check size={26} aria-label="По графику" />}
              </div>
              <div className="stat-label">
                {plan.todayGoal > 0 ? `Сегодня по плану: ещё ${plan.todayGoal}` : 'План на сегодня выполнен'}
              </div>
            </a>
          </div>

          <div className="card">
            <h3>Дни занятий</h3>
            <Heatmap activeDays={data.activeDays} />
            <p className="muted small" style={{ margin: 0 }}>
              Один день отдыха в неделю серию не прерывает. Всего дней занятий: {streak.totalDays}.
            </p>
          </div>
        </div>

        <div>
          <div className="section-title">
            <h2>Модули</h2>
            <a className="small" href={href('course')} style={{ fontWeight: 800 }}>
              Все {modules.length}
            </a>
          </div>
          <div className="card module-list">
            {modules.map((m) => {
              const ready = m.topics.filter((t) => t.ready);
              const s = m.topics.reduce(
                (acc, t) => {
                  const st = topicStats(t, data);
                  return { solved: acc.solved + st.solved, total: acc.total + st.total };
                },
                { solved: 0, total: 0 },
              );
              const p = s.total ? (s.solved / s.total) * 100 : 0;
              return (
                <a key={m.id} className="module-row" href={href('course', m.id)}>
                  <ModuleTile moduleId={m.id} size={42} />
                  <span className="module-row-body">
                    <span className="module-row-top">
                      <span>{m.title}</span>
                      <span className="pct">{ready.length ? `${p.toFixed(0)}%` : 'скоро'}</span>
                    </span>
                    <span className={`progress-bar${p >= 100 ? ' success' : ''}`}>
                      <span style={{ width: `${p}%` }} />
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
