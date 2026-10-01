import { useEffect } from 'react';
import { allTopics, findModule, findTopic } from '../content';
import { href } from '../router';
import { useProgress } from '../progress';
import { topicStats } from '../stats';
import { Markdown } from '../components/Markdown';
import { TaskCard } from '../components/tasks/TaskCard';
import { plural } from '../sql/compare';
import { ensurePython } from '../python/engine';

export function TopicPage({ moduleId, topicId }: { moduleId: string; topicId: string }) {
  const topic = findTopic(moduleId, topicId);
  const module = findModule(moduleId);
  const { data } = useProgress();

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
        <a href={href('course')}>← К списку тем</a>
      </div>
    );
  }
  if (!topic.ready) {
    return (
      <div className="page">
        <h1>{topic.title}</h1>
        <p className="lead">Эта тема ещё готовится и скоро появится.</p>
        <a href={href('course')}>← К списку тем</a>
      </div>
    );
  }

  const ready = allTopics.filter((t) => t.ready);
  const idx = ready.indexOf(topic);
  const prev = ready[idx - 1];
  const next = ready[idx + 1];
  const numInModule = module.topics.indexOf(topic) + 1;
  const s = topicStats(topic, data);

  return (
    <div className="page topic-page">
      <nav className="breadcrumbs">
        <a href={href('course')}>Курс</a> › <a href={href('course', module.id)}>{module.title}</a> › Тема {numInModule} из{' '}
        {module.topics.length}
      </nav>
      <div className="page-head">
        <h1>{topic.title}</h1>
        <div className="topic-meta">
          <span className={`badge${s.done ? ' badge-success' : ''}`}>
            {s.done ? '✓ Тема пройдена' : `Решено ${s.solved} из ${s.total} ${plural(s.total, 'задания', 'заданий', 'заданий')}`}
          </span>
          <a className="btn btn-small btn-ghost" href="#practice" onClick={(e) => {
            e.preventDefault();
            document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            ↓ К заданиям
          </a>
        </div>
      </div>

      <article className="lesson card">
        <Markdown key={topic.key} source={topic.lesson} runnable />
      </article>

      <h2 id="practice" className="practice-title">
        ✍️ Практика
      </h2>
      <p className="muted">Задания идут от простого к сложному. Результат проверяется автоматически.</p>
      {topic.tasks.map((task, i) => (
        <TaskCard key={`${topic.key}/${task.id}`} topic={topic} task={task} index={i} />
      ))}

      <div className="topic-nav">
        {prev ? (
          <a className="btn btn-ghost" href={href('topic', prev.moduleId, prev.id)}>
            ← {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a className="btn btn-primary" href={href('topic', next.moduleId, next.id)}>
            Следующая тема: {next.title} →
          </a>
        )}
      </div>
    </div>
  );
}
