import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { MarkdownText, mdInline } from '../Markdown';
import { Feedback, type FeedbackState } from './Feedback';
import type { TaskBodyProps } from './types';

/**
 * Порядок показа вариантов: перемешан, но всегда одинаковый для задания (зависит от его id).
 * Номера вариантов в сохранённом ответе остаются исходными, поэтому прогресс не ломается.
 */
export function optionOrder(taskId: string, n: number): number[] {
  let seed = 2166136261;
  for (const ch of taskId) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function QuizTask({ task, tp, showSolution, fail, succeed }: TaskBodyProps) {
  const options = task.options ?? [];
  const order = useMemo(() => optionOrder(task.id, options.length), [task.id, options.length]);
  const multiple = options.filter((o) => o.correct).length > 1;
  const [chosen, setChosen] = useState<number[]>(() => {
    try {
      return tp.code ? (JSON.parse(tp.code) as number[]) : [];
    } catch {
      return [];
    }
  });
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [checkedOnce, setCheckedOnce] = useState(false);

  const toggle = (i: number) => {
    setFeedback(null);
    setChosen((c) => (multiple ? (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]) : [i]));
  };

  const check = () => {
    const correct = options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    const ok = correct.length === chosen.length && correct.every((i) => chosen.includes(i));
    const code = JSON.stringify(chosen);
    setCheckedOnce(true);
    if (ok) {
      succeed(code);
      setFeedback({ kind: 'ok' });
      return;
    }
    fail(code);
    const wrongChosen = chosen.filter((i) => !options[i].correct);
    const details = wrongChosen.map((i) => options[i].explain).filter((x): x is string => Boolean(x));
    if (!details.length && multiple) {
      details.push(chosen.length < correct.length ? 'Выбраны не все правильные варианты — их здесь несколько.' : 'Среди выбранных есть лишний вариант.');
    }
    setFeedback({ kind: 'wrong', title: 'Не совсем так.', details: details.length ? details : ['Перечитай объяснение в уроке и попробуй ещё раз.'] });
  };

  const reveal = showSolution || tp.solved;

  return (
    <>
      <div className="quiz-options" role={multiple ? 'group' : 'radiogroup'}>
        {multiple && <div className="muted small">Можно выбрать несколько вариантов.</div>}
        {order.map((i) => {
          const o = options[i];
          const selected = chosen.includes(i);
          const cls = ['quiz-option', selected ? 'selected' : '', reveal && o.correct ? 'correct' : '', checkedOnce && selected && !o.correct && feedback?.kind === 'wrong' ? 'wrong' : ''].join(' ');
          return (
            <label key={i} className={cls}>
              <input type={multiple ? 'checkbox' : 'radio'} name={task.id} checked={selected} onChange={() => toggle(i)} />
              <span className="quiz-text">
                <span dangerouslySetInnerHTML={{ __html: mdInline(o.text) }} />
                {reveal && o.explain && <MarkdownText text={o.explain} className="quiz-explain markdown" />}
              </span>
            </label>
          );
        })}
      </div>
      <div className="task-actions">
        <button className="btn btn-primary" onClick={check} disabled={!chosen.length}>
          <Check size={18} strokeWidth={2.6} aria-hidden /> Проверить ответ
        </button>
      </div>
      <Feedback state={feedback} usedSolution={tp.usedSolution} />
    </>
  );
}
