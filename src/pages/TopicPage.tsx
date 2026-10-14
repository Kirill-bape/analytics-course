import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpenText, ChevronLeft, CirclePlay, ListChecks } from 'lucide-react';
import { allTopics, findModule, findTopic, type Topic } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { topicStats } from '../stats';
import { Markdown } from '../components/Markdown';
import { TaskCard } from '../components/tasks/TaskCard';
import { ModuleTile } from '../components/ui';
import { plural } from '../sql/compare';
import { ensurePython } from '../python/engine';
import { LessonMaterials, LessonVideos, useLessonMedia } from '../components/media/LessonMedia';

interface Section {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

/** Закреплённые вкладки «Теория · Видео · Практика»: прокручивают к нужному блоку */
function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 140) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);
  return (
    <nav className="section-nav" aria-label="Разделы урока">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`section-tab${active === s.id ? ' active' : ''}`}
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {s.icon}
          {s.label}
          {s.count !== undefined && <span className="count">{s.count}</span>}
        </button>
      ))}
    </nav>
  );
}

function TaskProgress({ topic }: { topic: Topic }) {
  const { task } = useProgress();
  const solved = topic.tasks.filter((t) => task(`${topic.key}/${t.id}`).solved).length;
  return (
    <div className="task-progress" aria-label={`Решено ${solved} из ${topic.tasks.length}`}>
      {topic.tasks.map((t) => (
        <span key={t.id} className={task(`${topic.key}/${t.id}`).solved ? 'done' : undefined} />
      ))}
      <em>
        {solved} из {topic.tasks.length}
      </em>
    </div>
  );
}

export function TopicPage({ moduleId, topicId }: { moduleId: string; topicId: string }) {
  const topic = findTopic(moduleId, topicId);
  const module = findModule(moduleId);
  const { data } = useProgress();
  const media = useLessonMedia(topic?.key);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [moduleId, topicId]);

  // В темах с Python заранее запускаем Python, чтобы не ждать при первом запуске
  useEffect(() => {
    if (topic?.ready && (topic.tasks.some((t) => t.type === 'python') || topic.lesson.includes('```python'))) {
      ensurePython().catch(() => undefined);
    }
  }, [topic]);

  if (!topic || !module) {
    return (
      <div className="page">
        <h1>Тема не найдена</h1>
        <a href={href('course')}>Вернуться к списку тем</a>
      </div>
    );
  }
  if (!topic.ready) {
    return (
      <div className="page">
        <h1>{topic.title}</h1>
        <p className="lead">Эта тема ещё готовится и скоро появится.</p>
        <a href={href('course')}>Вернуться к списку тем</a>
      </div>
    );
  }

  const ready = allTopics.filter((t) => t.ready);
  const idx = ready.indexOf(topic);
  const prev = ready[idx - 1];
  const next = ready[idx + 1];
  const numInModule = module.topics.indexOf(topic) + 1;
  const s = topicStats(topic, data);
  const videos = media?.videos ?? [];

  const sections: Section[] = [
    { id: 'theory', label: 'Теория', icon: <BookOpenText size={18} aria-hidden /> },
    ...(videos.length ? [{ id: 'video', label: 'Видео', icon: <CirclePlay size={18} aria-hidden />, count: videos.length }] : []),
    { id: 'practice', label: 'Практика', icon: <ListChecks size={18} aria-hidden />, count: topic.tasks.length },
  ];

  return (
    <div className="page topic-page">
      <nav className="breadcrumbs">
        <a href={href('course', module.id)}>
          <ChevronLeft size={16} aria-hidden /> {module.title}
        </a>
        <span>· тема {numInModule} из {module.topics.length}</span>
      </nav>
      <div className="page-head topic-head">
        <ModuleTile moduleId={module.id} size={52} />
        <div>
          <h1>{topic.title}</h1>
          <div className="topic-meta">
            <span className={`badge${s.done ? ' badge-success' : ''}`}>
              {s.done ? 'Тема пройдена' : `Решено ${s.solved} из ${s.total} ${plural(s.total, 'задания', 'заданий', 'заданий')}`}
            </span>
          </div>
        </div>
      </div>

      <SectionNav sections={sections} />

      <section id="theory" className="lesson-section">
        <article className="lesson card">
          <Markdown key={topic.key} source={topic.lesson} runnable />
        </article>
        {media && <LessonMaterials items={media.theory} title="Конспекты и материалы курсов" />}
      </section>

      {videos.length > 0 && (
        <section id="video" className="lesson-section">
          <h2 className="lesson-section-title">
            <CirclePlay size={26} aria-hidden /> Видео
          </h2>
          <LessonVideos videos={videos} />
        </section>
      )}

      <section id="practice" className="lesson-section">
        <h2 className="lesson-section-title">
          <ListChecks size={26} aria-hidden /> Практика
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Задания идут от простого к сложному. Результат проверяется автоматически.
        </p>
        <TaskProgress topic={topic} />
        {topic.tasks.map((task, i) => (
          <TaskCard key={`${topic.key}/${task.id}`} topic={topic} task={task} index={i} />
        ))}
        {media && <LessonMaterials items={media.practice} title="Задания и данные из курсов" />}
      </section>

      <div className="topic-nav">
        {prev ? (
          <a className="btn btn-secondary" href={href('topic', prev.moduleId, prev.id)}>
            <ArrowLeft size={18} aria-hidden /> {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a className="btn btn-primary" href={href('topic', next.moduleId, next.id)}>
            Следующая тема: {next.title} <ArrowRight size={18} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
