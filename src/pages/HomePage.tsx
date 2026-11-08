import { useState } from 'react';
import { Flame, HardDriveDownload } from 'lucide-react';
import { modules, type Topic } from '../content';
import { href } from '../router';
import { SANDBOX, todayKey, useProgress } from '../progress';
import { coursePercent, nextStep, planStatus, stationState, streakInfo, taskTotals, topicStats } from '../stats';
import { plural } from '../sql/compare';
import { LineBadge, StationStrip, lineClass } from '../components/ui';

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

function planLine(plan: ReturnType<typeof planStatus>): string {
  if (plan.todayGoal > 0) return `По плану на сегодня — ещё ${plan.todayGoal} ${plural(plan.todayGoal, 'задание', 'задания', 'заданий')}.`;
  return 'План на сегодня выполнен.';
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
  const stateOf = (t: Topic) => stationState(t, data);

  return (
    <div className="page">
      <div className="home-head">
        <div>
          <h1>{greeting(fresh)}</h1>
          <p className="lead">
            {dateStr}. {planLine(plan)}
          </p>
        </div>
        <span className="streak-pill" title={`Серия дней занятий. Лучшая — ${streak.best}`}>
          <Flame size={18} aria-hidden /> {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
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

      {next && nextStats && nextModule && (
        <section className={`next ${lineClass(nextModule.id)}`} aria-label="Следующая тема">
          <a className="next-line" href={href('course', nextModule.id)}>
            <LineBadge moduleId={nextModule.id} />
            <span>{nextModule.title}</span>
            <span className="next-pos">
              тема {nextModule.topics.indexOf(next) + 1} из {nextModule.topics.length}
            </span>
          </a>
          <h2 className="next-title">{next.title}</h2>
          <StationStrip module={nextModule} current={next} stateOf={stateOf} />
          <div className="next-foot">
            <span className="muted">
              {nextStats.started
                ? `Решено ${nextStats.solved} из ${nextStats.total}, осталось ${nextStats.total - nextStats.solved}`
                : `Новая тема, ${nextStats.total} ${plural(nextStats.total, 'задание', 'задания', 'заданий')}`}
            </span>
            <a className="btn btn-primary btn-wide" href={href('topic', next.moduleId, next.id)}>
              {nextStats.started ? 'Продолжить тему' : 'Начать тему'}
            </a>
          </div>
        </section>
      )}

      <dl className="figures">
        <div>
          <dt>Курс пройден</dt>
          <dd>{pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)} %</dd>
        </div>
        <div>
          <dt>Решено заданий</dt>
          <dd>
            {totals.solved} <small>из {totals.total}</small>
          </dd>
        </div>
        <div>
          <dt>Серия</dt>
          <dd>
            {streak.current} <small>{streak.studiedToday ? 'сегодня засчитано' : `лучшая ${streak.best}`}</small>
          </dd>
        </div>
        <a className={`plan-${plan.state}`} href={href('plan')}>
          <dt>План</dt>
          <dd>
            {plan.state === 'behind' ? (
              <>
                −{plan.behind} <small>{plural(plan.behind, 'задание', 'задания', 'заданий')} отставания</small>
              </>
            ) : plan.state === 'ahead' ? (
              <>
                +{plan.ahead} <small>{plural(plan.ahead, 'задание', 'задания', 'заданий')} впереди</small>
              </>
            ) : (
              'по графику'
            )}
          </dd>
        </a>
      </dl>

      <div className="home-cols">
        <section>
          <div className="section-title">
            <h2>Модули</h2>
            <a href={href('course')}>Все темы</a>
          </div>
          <div className="module-list">
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
                <a key={m.id} className={`module-row ${lineClass(m.id)}${ready.length ? '' : ' soon'}`} href={href('course', m.id)}>
                  <LineBadge moduleId={m.id} size="sm" />
                  <span className="module-row-name">{m.title}</span>
                  <span className="module-row-track" aria-hidden>
                    <span style={{ width: `${p}%` }} />
                  </span>
                  <span className="pct">{ready.length ? `${p.toFixed(0)} %` : 'скоро'}</span>
                </a>
              );
            })}
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>Дни занятий</h2>
          </div>
          <Heatmap activeDays={data.activeDays} />
          <p className="muted small">
            Один день отдыха в неделю серию не прерывает. Всего дней занятий: {streak.totalDays}.
          </p>
        </section>
      </div>
    </div>
  );
}
