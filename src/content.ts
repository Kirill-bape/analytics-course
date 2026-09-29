// Загрузка содержимого курса из папки content/.
// Чтобы добавить тему: создай папку content/<модуль>/<тема>/ с файлами
// lesson.md (объяснение) и tasks.json (задания) и впиши тему в course.json.

import courseJson from '../content/course.json';
import planJson from '../content/plan.json';
import datasetsJson from '../content/datasets.json';

export interface TaskSelfTest {
  /** Другие правильные решения — проверка должна их принимать */
  correct?: (string | string[])[];
  /** Типичные ошибки — проверка должна их отклонять */
  wrong?: (string | string[])[];
}

export interface TaskMistake {
  /** Регулярное выражение, которое ищется в коде ученика */
  pattern: string;
  flags?: string;
  /** Если задано — сообщение показывается, только когда этого шаблона НЕТ в коде */
  unless?: string;
  message: string;
}

export interface TaskDef {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  type?: 'sql';
  prompt: string | string[];
  starter?: string | string[];
  solution: string | string[];
  orderMatters?: boolean;
  checkColumnNames?: boolean;
  hints: string[];
  mistakes?: TaskMistake[];
  selfTest?: TaskSelfTest;
}

export interface Topic {
  id: string;
  title: string;
  moduleId: string;
  key: string; // "модуль/тема"
  ready: boolean;
  lesson: string;
  tasks: TaskDef[];
}

export interface Module {
  id: string;
  title: string;
  icon: string;
  description: string;
  topics: Topic[];
}

export interface PlanWeek {
  start: string;
  end: string;
  title: string;
  items: string[];
}

export interface Plan {
  goal: string;
  startDate: string;
  goalDate: string;
  pace: string;
  weeks: PlanWeek[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  description: string;
}

export interface TableInfo {
  name: string;
  file: string;
  title: string;
  description: string;
  columns: ColumnInfo[];
}

const lessonFiles = import.meta.glob('/content/**/lesson.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const taskFiles = import.meta.glob('/content/**/tasks.json', {
  import: 'default',
  eager: true,
}) as Record<string, { tasks: TaskDef[] }>;

export const joinText = (t: string | string[] | undefined): string =>
  Array.isArray(t) ? t.join('\n') : (t ?? '');

export const modules: Module[] = courseJson.modules.map((m) => ({
  id: m.id,
  title: m.title,
  icon: m.icon,
  description: m.description,
  topics: m.topics.map((t) => {
    const base = `/content/${m.id}/${t.id}`;
    const lesson = lessonFiles[`${base}/lesson.md`];
    const tasks = taskFiles[`${base}/tasks.json`]?.tasks ?? [];
    return {
      id: t.id,
      title: t.title,
      moduleId: m.id,
      key: `${m.id}/${t.id}`,
      ready: Boolean(lesson) && tasks.length > 0,
      lesson: lesson ?? '',
      tasks,
    };
  }),
}));

export const allTopics: Topic[] = modules.flatMap((m) => m.topics);

export const plan: Plan = planJson;
export const tables: TableInfo[] = datasetsJson.tables;

export function findTopic(moduleId: string, topicId: string): Topic | undefined {
  return allTopics.find((t) => t.moduleId === moduleId && t.id === topicId);
}

export function findModule(moduleId: string): Module | undefined {
  return modules.find((m) => m.id === moduleId);
}

export const taskKey = (topic: Topic, task: TaskDef) => `${topic.key}/${task.id}`;

/** Темы, на которые ссылается пункт плана: "модуль" или "модуль/тема" */
export function topicsForPlanItem(item: string): Topic[] {
  if (item.includes('/')) {
    const t = allTopics.find((x) => x.key === item);
    return t ? [t] : [];
  }
  return findModule(item)?.topics ?? [];
}
