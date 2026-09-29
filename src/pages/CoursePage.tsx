import { useEffect } from 'react';
import { modules } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { topicStats } from '../stats';

export function CoursePage({ anchor }: { anchor?: string }) {
  const { data } = useProgress();

  useEffect(() => {
    if (anchor) document.getElementById(`module-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [anchor]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Курс</h1>
        <p className="lead">
          9 модулей — от первого SQL-запроса до проекта в портфолио. Модули с пометкой «скоро» появятся по мере продвижения.
        </p>
      </div>
      {modules.map((m, mi) => {
        const readyCount = m.topics.filter((t) => t.ready).length;
        return (
          <section key={m.id} id={`module-${m.id}`} className={`card module-card${readyCount ? '' : ' soon'}`}>
            <div className="module-card-head">
              <span className="module-big-icon">{m.icon}</span>
              <div>
                <div className="eyebrow">Модуль {mi + 1}</div>
                <h2>{m.title}</h2>
                <p className="muted">{m.description}</p>
              </div>
              {!readyCount && <span className="badge">скоро</span>}
            </div>
            <ol className="topic-list">
              {m.topics.map((t) => {
                const s = topicStats(t, data);
                const content = (
                  <>
                    <span className={`topic-status${s.done ? ' done' : s.started ? ' started' : ''}`}>{s.done ? '✓' : ''}</span>
                    <span className="topic-name">{t.title}</span>
                    {t.ready ? (
                      <span className="small muted">
                        {s.solved}/{s.total}
                      </span>
                    ) : (
                      <span className="small muted">скоро</span>
                    )}
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
