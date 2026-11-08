// Общие детали дизайна «Схема линий»: каждый модуль — линия своего цвета,
// темы — станции на ней. Цвета линий заданы в styles.css (.line-*).

import type { CSSProperties } from 'react';
import { modules, type Module, type Topic } from '../content';

/** Номер модуля по порядку курса (1, 2, 3…) — как номер линии на схеме */
export function lineNumber(moduleId: string): number {
  return modules.findIndex((m) => m.id === moduleId) + 1;
}

/** Класс с цветами линии модуля: задаёт --line и акцентные цвета внутри блока */
export function lineClass(moduleId: string): string {
  return `line-${moduleId}`;
}

/** Кружок с номером линии */
export function LineBadge({ moduleId, size = 'md' }: { moduleId: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`line-badge ${size} ${lineClass(moduleId)}`} aria-hidden>
      {lineNumber(moduleId)}
    </span>
  );
}

export type StationState = 'done' | 'started' | 'todo' | 'soon';

/** Короткая схема линии: все темы модуля точками, текущая выделена */
export function StationStrip({
  module,
  current,
  stateOf,
}: {
  module: Module;
  current?: Topic;
  stateOf: (t: Topic) => StationState;
}) {
  const doneCount = module.topics.filter((t) => stateOf(t) === 'done').length;
  // Сколько линии «проехано»: до последней решённой темы
  let lastDone = -1;
  module.topics.forEach((t, i) => {
    if (stateOf(t) === 'done') lastDone = i;
  });
  const travelled = module.topics.length > 1 ? Math.max(0, lastDone) / (module.topics.length - 1) : 0;
  return (
    <div
      className={`strip ${lineClass(module.id)}`}
      style={{ '--travelled': travelled } as CSSProperties}
      role="img"
      aria-label={`Пройдено тем: ${doneCount} из ${module.topics.length}`}
    >
      {module.topics.map((t) => (
        <span key={t.id} className={`strip-stop ${stateOf(t)}${t === current ? ' current' : ''}`} title={t.title} />
      ))}
    </div>
  );
}

/** Сложность задания: 1–3 деления */
export function Difficulty({ level }: { level: number }) {
  return (
    <span className="difficulty" title={`Сложность ${level} из 3`} aria-label={`Сложность ${level} из 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= level ? 'on' : undefined} />
      ))}
    </span>
  );
}
