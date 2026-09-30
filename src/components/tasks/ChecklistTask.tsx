import { useState } from 'react';
import { mdInline } from '../Markdown';
import type { TaskBodyProps } from './types';

export function ChecklistTask({ task, tp, succeed, saveDraft }: TaskBodyProps) {
  const items = task.items ?? [];
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const saved = tp.code ? (JSON.parse(tp.code) as boolean[]) : [];
      return items.map((_, i) => Boolean(saved[i]) || tp.solved);
    } catch {
      return items.map(() => tp.solved);
    }
  });

  const toggle = (i: number) => {
    const next = done.map((d, k) => (k === i ? !d : d));
    setDone(next);
    saveDraft(JSON.stringify(next));
  };

  const all = done.every(Boolean);
  return (
    <>
      <ul className="checklist">
        {items.map((it, i) => (
          <li key={i} className={done[i] ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={done[i]} onChange={() => toggle(i)} />
              <span dangerouslySetInnerHTML={{ __html: mdInline(it) }} />
            </label>
          </li>
        ))}
      </ul>
      <div className="task-actions">
        {tp.solved ? (
          <span className="badge badge-success">✓ Этап завершён</span>
        ) : (
          <button className="btn btn-primary" disabled={!all} onClick={() => succeed(JSON.stringify(done))}>
            {all ? '✓ Этап готов' : `Отмечено ${done.filter(Boolean).length} из ${items.length}`}
          </button>
        )}
      </div>
    </>
  );
}
