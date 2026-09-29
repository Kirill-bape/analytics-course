import { modules } from '../content';
import { href } from '../router';
import { todayKey, useProgress } from '../progress';
import { coursePercent, nextStep, planStatus, streakInfo, taskTotals, topicStats } from '../stats';
import { plural } from '../sql/compare';

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
  const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">{dateStr}</div>
        <h1>{fresh ? 'Добро пожаловать!' : 'С возвращением!'}</h1>
        <p className="lead">Цель: джуниор аналитик данных к январю. Осталось {plan.daysLeft} {plural(plan.daysLeft, 'день', 'дня', 'дней')}.</p>
      </div>

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
        <a className="card continue" href={href('topic', next.moduleId, next.id)}>
          <div>
            <div className="eyebrow">
              {nextStats.started ? 'Продолжить' : 'Следующая тема'} · {nextModule.icon} {nextModule.title}
            </div>
            <h2>{next.title}</h2>
            <div className="muted">
              Решено {nextStats.solved} из {nextStats.total} {plural(nextStats.total, 'задания', 'заданий', 'заданий')}
            </div>
          </div>
          <span className="btn btn-primary">{nextStats.started ? 'Продолжить →' : 'Начать →'}</span>
        </a>
      )}

      <div className="stats-grid">
        <div className="card stat">
          <div className="stat-label">Курс пройден</div>
          <div className="stat-value">{pct.toFixed(1)}%</div>
          <div className="progress-bar">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="card stat">
          <div className="stat-label">Заданий решено</div>
          <div className="stat-value">
            {totals.solved} <span className="stat-of">из {totals.total}</span>
          </div>
          <div className="muted small">в готовых модулях</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Серия дней</div>
          <div className="stat-value">🔥 {streak.current}</div>
          <div className="muted small">
            {streak.studiedToday ? 'Сегодняшнее занятие засчитано ✓' : 'Реши задание, чтобы продлить серию'}
            <br />
            Лучшая: {streak.best} · всего дней: {streak.totalDays}
          </div>
        </div>
        <a className={`card stat plan-${plan.state}`} href={href('plan')}>
          <div className="stat-label">План</div>
          <div className="stat-value small-value">
            {plan.state === 'behind' && `Отставание: ${plan.behind} ${plural(plan.behind, 'задание', 'задания', 'заданий')}`}
            {plan.state === 'ontrack' && 'Идёшь по графику ✓'}
            {plan.state === 'ahead' && `Опережаешь на ${plan.ahead} 🚀`}
          </div>
          <div className="muted small">
            {plan.todayGoal > 0
              ? `Сегодня по плану: ещё ${plan.todayGoal} ${plural(plan.todayGoal, 'задание', 'задания', 'заданий')}`
              : 'План на сегодня выполнен 🎉'}
          </div>
        </a>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Дни занятий</h3>
          <Heatmap activeDays={data.activeDays} />
          <p className="muted small">Один день отдыха в неделю серию не прерывает.</p>
        </div>
        <div className="card">
          <h3>Модули</h3>
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
                <a key={m.id} className="module-row" href={href('course', m.id)}>
                  <span className="module-icon">{m.icon}</span>
                  <span className="module-name">{m.title}</span>
                  {ready.length ? (
                    <span className="module-progress">
                      <span className="progress-bar thin">
                        <span style={{ width: `${p}%` }} />
                      </span>
                      <span className="small muted">{p.toFixed(0)}%</span>
                    </span>
                  ) : (
                    <span className="badge">скоро</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
