// Загрузка содержимого курса из папки content/.
// Если новая тема не появилась в приложении — перезапусти приложение (start.bat):
// сервер разработки иногда не замечает новые папки с темами.
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

export type TaskType = 'sql' | 'python' | 'quiz' | 'number' | 'sheet' | 'checklist';

export interface QuizOption {
  text: string;
  correct?: boolean;
  /** Почему этот вариант верный или неверный */
  explain?: string;
}

export interface PlotCheck {
  kind?: 'bar' | 'line' | 'scatter' | 'pie';
  title?: boolean;
  xlabel?: boolean;
  ylabel?: boolean;
}

export interface SheetCheck {
  /** Ячейка или диапазон, например "F2" или "F2:F11" */
  range: string;
  /** Эталонная формула для первой ячейки диапазона (протягивается вниз) */
  formula: string;
  /** Функция, которую обязательно нужно использовать, например "ВПР" */
  requireFunction?: string;
}

export interface SheetSpec {
  /** Данные листа из SQL-запроса: первая строка — заголовки */
  dataSql?: string;
  /** Или данные вручную: первая строка — заголовки */
  data?: (string | number | null)[][];
  /** Дополнительные заголовки пустых столбцов справа от данных */
  extraHeaders?: string[];
  checks: SheetCheck[];
  /** Ширины столбцов (в пикселях) */
  widths?: number[];
}

export interface ChartSpec {
  type: 'bar' | 'line';
  /** Номер столбца с подписями (по умолчанию 0) */
  x?: number;
  /** Номера столбцов со значениями (по умолчанию все числовые) */
  y?: number[];
}

export interface TaskDef {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  type?: TaskType;
  prompt: string | string[];
  hints: string[];
  /** Разбор после решения (Markdown) */
  explanation?: string | string[];

  // SQL и Python
  starter?: string | string[];
  solution?: string | string[];
  orderMatters?: boolean;
  checkColumnNames?: boolean;
  mistakes?: TaskMistake[];
  selfTest?: TaskSelfTest;
  /** SQL: показать результат графиком */
  chart?: ChartSpec;

  // Python
  /** Что проверять: переменную result (по умолчанию), вывод print или график */
  check?: 'result' | 'stdout' | 'plot';
  resultVar?: string;
  plot?: PlotCheck;

  // Тест с вариантами ответа
  options?: QuizOption[];

  // Ответ-число
  answer?: number | string;
  /** Правильный ответ считается SQL-запросом (первая ячейка результата) */
  answerSql?: string;
  tolerance?: number;
  unit?: string;
  wrongAnswers?: { value: number; message: string }[];

  // Таблица с формулами (Excel)
  sheet?: SheetSpec;

  // Чек-лист (итоговый проект)
  items?: string[];
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
  group: string;
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
export const tableGroups: { id: string; title: string }[] = datasetsJson.groups;

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
