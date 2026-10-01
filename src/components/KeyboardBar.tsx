// Панель быстрых символов над экранной клавиатурой (телефон, планшет).
// Появляется, когда открыт редактор кода или строка формул таблицы:
// верхний ряд — символы, которые на телефоне долго искать, нижний — частые слова.

import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react';
import { useActiveInput, useTouchDevice, type InputKind, type InputTarget } from '../keyboard';

interface Key {
  label: string;
  text: string;
  word?: boolean;
}

const SYMBOLS: Record<InputKind, string[]> = {
  sql: ["'", '(', ')', ',', '*', '=', ';', '<', '>', '.', '_', '%', '-', '+', '/', '|'],
  python: ['(', ')', '[', ']', ':', "'", '"', '=', '.', ',', '_', '#', '{', '}', '+', '-', '*', '/', '<', '>', '!', '%'],
  sheet: ['=', ';', '(', ')', ':', '$', '"', ',', '+', '-', '*', '/', '<', '>', '&', '%'],
};

const sqlWord = (w: string): Key => ({ label: w, text: w.endsWith('(') ? w : `${w} `, word: true });
const pyWord = (w: string): Key => ({ label: w.trim(), text: w, word: !w.startsWith('.') });
const fn = (w: string): Key => ({ label: w, text: w });

const WORDS: Record<InputKind, Key[]> = {
  sql: [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'DESC', 'LIMIT', 'AS', 'JOIN', 'LEFT JOIN', 'ON',
    'COUNT(', 'SUM(', 'AVG(', 'MIN(', 'MAX(', 'ROUND(', 'DISTINCT', 'HAVING', 'IN', 'NOT', 'LIKE', 'IS NULL', 'BETWEEN',
    'CASE WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'OVER (', 'PARTITION BY', 'DATE_TRUNC(', 'EXTRACT(', 'COALESCE(', 'CAST(',
  ].map(sqlWord),
  python: [
    'df', 'pd.', 'print(', 'result = ', '.groupby(', '.agg(', '.sum()', '.mean()', '.count()', '.size()', '.sort_values(',
    'ascending=False', '.reset_index()', '.head(', '.merge(', 'on=', 'how=', '.round(', '.value_counts()', '.nunique()',
    'as_index=False', '.loc[', '.isin(', '.fillna(', '.astype(', '.str.', '.dt.', 'True', 'False', 'None', 'len(', 'round(',
    'for ', 'in ', 'if ', 'else:', 'def ', 'return ', 'import ', 'plt.', 'lambda ',
  ].map(pyWord),
  sheet: [
    'СУММ(', 'СРЗНАЧ(', 'ЕСЛИ(', 'СЧЁТЕСЛИ(', 'СУММЕСЛИ(', 'СРЗНАЧЕСЛИ(', 'ВПР(', 'ПРОСМОТРX(', 'ОКРУГЛ(', 'ЕСЛИОШИБКА(',
    'МАКС(', 'МИН(', 'СЧЁТ(', 'СЖПРОБЕЛЫ(', 'ПОДСТАВИТЬ(', 'ПРОПНАЧ(', 'ЗНАЧ(', 'ИНДЕКС(', 'ПОИСКПОЗ(', 'И(', 'ИЛИ(',
  ].map(fn),
};

/** Насколько поднять панель, чтобы она оказалась над экранной клавиатурой */
function useKeyboardOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) return;
    const update = () => setOffset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return offset;
}

// Нажатие на кнопку панели не должно забирать фокус у редактора — иначе спрячется клавиатура
const keep = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};

function Btn({ label, title, className, onPress }: { label: string; title?: string; className?: string; onPress: () => void }) {
  return (
    <button type="button" className={`kkey${className ? ` ${className}` : ''}`} title={title} aria-label={title ?? label} {...keep} onClick={onPress}>
      {label}
    </button>
  );
}

function Bar({ target, offset }: { target: InputTarget; offset: number }) {
  const { kind } = target;
  const finish = (fn?: () => void) => () => {
    target.blur();
    fn?.();
  };
  return (
    <div className={`kbar${offset > 0 ? ' raised' : ''}`} style={{ transform: offset ? `translateY(${-offset}px)` : undefined }} role="toolbar" aria-label="Быстрые символы">
      <div className="kbar-row kbar-symbols">
        {kind === 'python' && <Btn label="⇥" title="Отступ (4 пробела)" className="ctl" onPress={() => target.insert('    ')} />}
        <Btn label="←" title="Курсор влево" className="ctl" onPress={() => target.move(-1)} />
        <Btn label="→" title="Курсор вправо" className="ctl" onPress={() => target.move(1)} />
        {SYMBOLS[kind].map((s) => (
          <Btn key={s} label={s} onPress={() => target.insert(s)} />
        ))}
      </div>
      <div className="kbar-row kbar-words">
        {WORDS[kind].map((w) => (
          <Btn key={w.label} label={w.label} className="word" onPress={() => target.insert(w.text, { word: w.word })} />
        ))}
      </div>
      <div className="kbar-actions">
        {target.run && <Btn label="▶" title="Запустить" className="act" onPress={finish(target.run)} />}
        {target.check && <Btn label="✓" title="Проверить" className="act primary" onPress={finish(target.check)} />}
        {target.enter && <Btn label="↵" title="Ввести формулу" className="act primary" onPress={() => target.enter?.()} />}
        <Btn label="▾" title="Спрятать клавиатуру" className="act" onPress={finish()} />
      </div>
    </div>
  );
}

export function KeyboardBar() {
  const target = useActiveInput();
  const touch = useTouchDevice();
  const offset = useKeyboardOffset(Boolean(target && touch));
  if (!target || !touch) return null;
  return <Bar target={target} offset={offset} />;
}
