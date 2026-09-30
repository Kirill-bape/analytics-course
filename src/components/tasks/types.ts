import type { TaskDef } from '../../content';
import type { TaskProgress } from '../../progress';

/** Что получает «тело» задания от общей карточки */
export interface TaskBodyProps {
  task: TaskDef;
  taskKey: string;
  tp: TaskProgress;
  /** Решение можно показывать (открыто кнопкой или задание уже решено) */
  showSolution: boolean;
  /** Неверный ответ: засчитать попытку */
  fail: (code?: string) => void;
  /** Верный ответ: засчитать задание */
  succeed: (code?: string) => void;
  /** Сохранить черновик */
  saveDraft: (code: string) => void;
}
