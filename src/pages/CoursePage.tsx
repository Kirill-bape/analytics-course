import { useEffect } from 'react';
import { Check, ChevronRight, CirclePlay } from 'lucide-react';
import { modules } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { nextStep, stationState, topicStats } from '../stats';
import { LineBadge, lineClass } from '../components/ui';
import { plural } from '../sql/compare';
import { useMedia } from '../media/client';

export function CoursePage({ anchor }: { anchor?: string }) {
  const { data } = useProgress();
  const media = useMedia();
  const next = nextStep(data);
  // Сколько видео в теме: из основных курсов, а если их нет — из дополнительных
  const videosOf = (key: string) => {
    const list = (media.server && media.catalog?.lessons[key]?.videos) || [];
    return list.filter((v) => v.tier !== 'extra').length || list.length;
  };

  useEffect(() => {
    if (anchor) document.getElementById(`module-${anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [anchor]);

  const topicsTotal = modules.reduce((s, m) => s + m.topics.length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Курс</h1>
        <p className="lead">
          {modules.length} {plural(modules.length, 'модуль', 'модуля', 'модулей')} и {topicsTotal} {plural(topicsTotal, 'тема', 'темы', 'тем')}: от первого
          SQL-запроса до проекта в портфолио. Модуль — линия, тема — станция на ней.
        </p>
      </div>
      {modules.map((m) => {
        const readyCount = m.topics.filter((t) => t.ready || videosOf(t.key)).length;
        const st = m.topics.reduce(
          (acc, t) => {
            const s = topicStats(t, data);
            return { solved: acc.solved + s.solved, total: acc.total + s.total };
          },
          { solved: 0, total: 0 },
        );
        return (
          <section key={m.id} id={`module-${m.id}`} className={`course-line ${lineClass(m.id)}${readyCount ? '' : ' soon'}`}>
            <header className="course-line-head">
              <LineBadge moduleId={m.id} size="lg" />
              <div>
                <h2>{m.title}</h2>
                <p className="muted">{m.description}</p>
              </div>
              {readyCount ? (
                <span className="course-line-count" title="Решено заданий в модуле">
                  {st.solved} <small>из {st.total}</small>
                </span>
              ) : (
                <span className="badge">скоро</span>
              )}
            </header>
            <ol className="stations">
              {m.topics.map((t, ti) => {
                const s = topicStats(t, data);
                const state = stationState(t, data);
                const videos = videosOf(t.key);
                const open = t.ready || videos > 0;
                const here = t === next;
                const content = (
                  <>
                    <span className="station-dot" aria-hidden>
                      {state === 'done' && <Check size={12} strokeWidth={3.5} />}
                    </span>
                    <span className="station-num">{ti + 1}</span>
                    <span className="station-name">
                      {t.title}
                      {here && <span className="here-mark">ты здесь</span>}
                    </span>
                    {videos > 0 && (
                      <span className="station-videos" title={`Видео из курсов: ${videos}`}>
                        <CirclePlay size={14} aria-hidden /> {videos}
                      </span>
                    )}
                    {t.ready ? (
                      <span className="station-count" aria-label={`Решено ${s.solved} из ${s.total}`}>
                        {s.solved}/{s.total}
                      </span>
                    ) : (
                      !videos && <span className="badge">скоро</span>
                    )}
                    {open && <ChevronRight size={18} className="station-chevron" aria-hidden />}
                  </>
                );
                return (
                  <li key={t.id} className={`station ${state}${here ? ' here' : ''}`}>
                    {open ? (
                      <a className="station-row" href={href('topic', m.id, t.id)}>
                        {content}
                      </a>
                    ) : (
                      <div className="station-row disabled">{content}</div>
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
