import { useEffect, useState } from 'react';
import { Feedback, type FeedbackState } from './Feedback';
import type { TaskBodyProps } from './types';
import type { TaskDef } from '../../content';
import { runQuery } from '../../sql/engine';

const cache = new Map<string, number | string>();

/** Правильный ответ: задан числом или считается SQL-запросом */
export async function numberAnswer(key: string, task: TaskDef): Promise<number | string> {
  if (task.answer !== undefined) return task.answer;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (!task.answerSql) throw new Error('У задания нет ответа');
  const res = await runQuery(task.answerSql);
  const v = res.rows[0]?.[0];
  if (v === null || v === undefined) throw new Error('Запрос ответа ничего не вернул');
  const answer = typeof v === 'number' ? v : String(v);
  cache.set(key, answer);
  return answer;
}

export function parseNumber(s: string): number | null {
  const t = s.replace(/\s+/g, '').replace(/₽|%|руб\.?/gi, '').replace(',', '.');
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return null;
  return Number(t);
}

const decimals = (x: number) => {
  const s = String(Number(x.toFixed(8)));
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
};

const fmt = (x: number) => x.toLocaleString('ru-RU', { maximumFractionDigits: 6 });

export function judgeNumber(task: TaskDef, answer: number | string, input: string): { ok: boolean; title?: string; details?: string[] } {
  if (typeof answer === 'string') {
    const ok = input.trim().toLowerCase().replace(/ё/g, 'е') === answer.trim().toLowerCase().replace(/ё/g, 'е');
    return ok ? { ok } : { ok, title: 'Ответ не совпадает.', details: ['Проверь написание ответа.'] };
  }
  const v = parseNumber(input);
  if (v === null) return { ok: false, title: 'Это не число.', details: ['Введи число, например `1234,5`. Пробелы между разрядами можно не ставить.'] };
  const tol = task.tolerance ?? 1e-6 + Math.abs(answer) * 1e-9;
  if (Math.abs(v - answer) <= tol) return { ok: true };
  for (const w of task.wrongAnswers ?? []) {
    if (Math.abs(v - w.value) <= Math.max(tol, Math.abs(w.value) * 0.005)) return { ok: false, title: 'Не совсем.', details: [w.message] };
  }
  const k = decimals(answer);
  if (decimals(v) > k && Math.abs(Number(v.toFixed(k)) - answer) <= tol) {
    return { ok: false, title: 'Почти!', details: [`Значение верное, но его нужно округлить до ${k} ${k === 1 ? 'знака' : 'знаков'} после запятой.`] };
  }
  const ratio = answer !== 0 ? v / answer : 0;
  const details = [`Твой ответ **${fmt(v)}** ${v > answer ? 'больше' : 'меньше'} правильного.`];
  if (Math.abs(ratio - 100) < 1e-6 || Math.abs(ratio - 0.01) < 1e-6) details.push('Похоже, перепутаны доли и проценты: 0,25 — это 25%.');
  return { ok: false, title: 'Ответ не совпадает.', details };
}

export function NumberTask({ task, taskKey, tp, showSolution, fail, succeed }: TaskBodyProps) {
  const [value, setValue] = useState(tp.code ?? '');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [answer, setAnswer] = useState<number | string | null>(null);

  useEffect(() => {
    if (showSolution || tp.solved) numberAnswer(taskKey, task).then(setAnswer, () => undefined);
  }, [showSolution, tp.solved, taskKey, task]);

  const check = async () => {
    try {
      const a = await numberAnswer(taskKey, task);
      const r = judgeNumber(task, a, value);
      if (r.ok) {
        succeed(value);
        setFeedback({ kind: 'ok' });
      } else {
        fail(value);
        setFeedback({ kind: 'wrong', title: r.title ?? 'Неверно.', details: r.details ?? [] });
      }
    } catch (e) {
      setFeedback({ kind: 'error', error: { title: 'Не удалось проверить ответ', text: 'База данных ещё загружается — подожди пару секунд и попробуй снова.', raw: String(e) } });
    }
  };

  return (
    <>
      <div className="number-answer">
        <input
          className="number-input"
          value={value}
          inputMode={typeof task.answer === 'string' ? 'text' : 'decimal'}
          placeholder={typeof task.answer === 'string' ? 'Твой ответ' : 'Например: 1234,5'}
          onChange={(e) => {
            setValue(e.target.value);
            setFeedback(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && check()}
        />
        {task.unit && <span className="number-unit">{task.unit}</span>}
        <button className="btn btn-primary" onClick={check} disabled={!value.trim()}>
          ✓ Проверить
        </button>
      </div>
      <Feedback state={feedback} usedSolution={tp.usedSolution} />
      {(showSolution || tp.solved) && answer !== null && (
        <div className="solution-answer">
          Правильный ответ: <b>{typeof answer === 'number' ? fmt(answer) : answer}</b> {task.unit}
        </div>
      )}
    </>
  );
}
