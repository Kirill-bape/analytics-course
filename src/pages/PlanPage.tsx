import { plan } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { parseDay, planStatus, topicStats } from '../stats';
import { plural } from '../sql/compare';

const fmt = (s: string) => parseDay(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export function PlanPage() {
  const { data } = useProgress();
  const st = planStatus(data);

  return (
    <div className="page">
      <div className="page-head">
        <h1>План</h1>
        <p className="lead">
          {plan.goal}. Темп: {plan.pace}. До цели {st.daysLeft} {plural(st.daysLeft, 'день', 'дня', 'дней')}.
        </p>
      </div>

      <div className={`card plan-status plan-${st.state}`}>
        <div className="plan-status-main">
          {st.state === 'behind' && (
            <>
              <h2>Ты немного отстаёшь</h2>
              <p>
                По плану к сегодняшнему дню должно быть решено {st.expected} {plural(st.expected, 'задание', 'задания', 'заданий')}, а решено{' '}
                {st.solved}. Отставание — {st.behind} {plural(st.behind, 'задание', 'задания', 'заданий')}. Это нормально: догнать можно за 1–2
                занятия.
              </p>
            </>
          )}
          {st.state === 'ontrack' && (
            <>
              <h2>Идёшь по графику ✓</h2>
              <p>
                По плану к сегодняшнему дню: {st.expected} {plural(st.expected, 'задание', 'задания', 'заданий')}. Решено: {st.solved}.
              </p>
            </>
          )}
          {st.state === 'ahead' && (
            <>
              <h2>Опережаешь план 🚀</h2>
              <p>
                Решено {st.solved}, это на {st.ahead} больше, чем нужно к концу сегодняшнего дня. Отличный темп!
              </p>
            </>
          )}
        </div>
        <div className="plan-today">
          <div className="stat-label">На сегодня</div>
          <div className="stat-value">{st.todayGoal > 0 ? st.todayGoal : '✓'}</div>
          <div className="small muted">
            {st.todayGoal > 0 ? `${plural(st.todayGoal, 'задание', 'задания', 'заданий')} осталось` : 'план выполнен'}
          </div>
        </div>
      </div>

      <div className="timeline">
        {st.weeks.map((w) => {
          const pct = w.total ? (w.solved / w.total) * 100 : 0;
          const done = w.total > 0 && w.solved === w.total && w.notReady === 0;
          const late = w.state === 'past' && !done && w.topics.length > 0;
          return (
            <div key={w.index} className={`week ${w.state}${done ? ' done' : ''}${late ? ' late' : ''}`}>
              <div className="week-marker">{done ? '✓' : w.index + 1}</div>
              <div className="week-body card">
                <div className="week-head">
                  <div>
                    <div className="eyebrow">
                      Неделя {w.index + 1} · {fmt(w.week.start)} – {fmt(w.week.end)}
                      {w.state === 'current' && <span className="badge badge-accent">сейчас</span>}
                      {late && <span className="badge badge-warn">не завершена</span>}
                    </div>
                    <h3>{w.week.title}</h3>
                  </div>
                  {w.total > 0 && (
                    <div className="week-progress">
                      <span className="small muted">
                        {w.solved}/{w.total}
                      </span>
                      <span className="progress-bar thin">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  )}
                </div>
                {w.topics.length > 0 ? (
                  <ul className="week-topics">
                    {w.topics.map((t) => {
                      const s = topicStats(t, data);
                      return (
                        <li key={t.key} className={s.done ? 'done' : ''}>
                          <span className="topic-status small-status">{s.done ? '✓' : ''}</span>
                          {t.ready ? <a href={href('topic', t.moduleId, t.id)}>{t.title}</a> : <span className="muted">{t.title}</span>}
                          {!t.ready && <span className="badge">скоро</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">Резервная неделя: повтори сложные темы, перерешай задания, где открывалось решение, потренируйся на задачах с собеседований.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
