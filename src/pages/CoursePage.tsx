import { useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { modules } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { topicStats } from '../stats';
import { ModuleTile, ProgressRing } from '../components/ui';
import { plural } from '../sql/compare';

export function CoursePage({ anchor }: { anchor?: string }) {
  const { data } = useProgress();

  useEffect(() => {
    if (anchor) document.getElementById(`module-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [anchor]);

  const topicsTotal = modules.reduce((s, m) => s + m.topics.length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Курс</h1>
        <p className="lead">
          {modules.length} {plural(modules.length, 'модуль', 'модуля', 'модулей')} и {topicsTotal} {plural(topicsTotal, 'тема', 'темы', 'тем')} — от первого
          SQL-запроса до проекта в портфолио.
        </p>
      </div>
      {modules.map((m, mi) => {
        const readyCount = m.topics.filter((t) => t.ready).length;
        const st = m.topics.reduce(
          (acc, t) => {
            const s = topicStats(t, data);
            return { solved: acc.solved + s.solved, total: acc.total + s.total };
          },
          { solved: 0, total: 0 },
        );
        return (
          <section key={m.id} id={`module-${m.id}`} className={`card module-card${readyCount ? '' : ' soon'}`}>
            <div className="module-card-head">
              <ModuleTile moduleId={m.id} size={48} />
              <div>
                <div className="eyebrow">Модуль {mi + 1}</div>
                <h2>{m.title}</h2>
                <p className="muted">{m.description}</p>
              </div>
              {readyCount ? (
                <div className="module-card-progress">
                  <ProgressRing value={st.total ? st.solved / st.total : 0} size={52} stroke={6}>
                    <span style={{ fontSize: '0.75rem' }}>{st.total ? Math.round((st.solved / st.total) * 100) : 0}%</span>
                  </ProgressRing>
                  <span>
                    {st.solved}/{st.total}
                  </span>
                </div>
              ) : (
                <span className="badge">скоро</span>
              )}
            </div>
            <ol className="topic-list">
              {m.topics.map((t, ti) => {
                const s = topicStats(t, data);
                const part = s.total ? Math.round((s.solved / s.total) * 100) : 0;
                const content = (
                  <>
                    <span className="topic-num">{ti + 1}</span>
                    <span
                      className={`topic-status${s.done ? ' done' : s.started ? ' started' : ''}`}
                      style={s.started && !s.done ? ({ '--p': `${Math.max(part, 8)}%` } as React.CSSProperties) : undefined}
                    >
                      {s.done && <Check size={14} strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="topic-name">{t.title}</span>
                    {t.ready ? (
                      <span className="topic-count">
                        {s.solved}/{s.total}
                      </span>
                    ) : (
                      <span className="badge">скоро</span>
                    )}
                    {t.ready && <ChevronRight size={18} className="topic-chevron" aria-hidden />}
                  </>
                );
                return (
                  <li key={t.id}>
                    {t.ready ? (
                      <a className="topic-row" href={href('topic', m.id, t.id)}>
                        {content}
                      </a>
                    ) : (
                      <div className="topic-row disabled">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
