// Сетка электронной таблицы: ячейки, строка формул, «протянуть вниз».

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HyperFormula } from 'hyperformula';
import { addrName, cell, colName, ERROR_HELP, fillDown, rawForEdit, shown, toEngine } from './formulas';
import { clearActiveInput, setActiveInput, type InputTarget } from '../keyboard';

interface Props {
  hf: HyperFormula;
  rows: number;
  cols: number;
  /** Последняя строка с данными (индекс) — до неё протягиваются формулы */
  lastDataRow: number;
  widths?: number[];
  /** Ячейки, которые менять нельзя (исходные данные) */
  locked: (row: number, col: number) => boolean;
  onChange: (changed: { row: number; col: number }[]) => void;
  initialSelection?: { row: number; col: number };
}

export function SheetGrid({ hf, rows, cols, lastDataRow, widths, locked, onChange, initialSelection }: Props) {
  const [sel, setSel] = useState(initialSelection ?? { row: 1, col: 0 });
  const [edit, setEdit] = useState(() => rawForEdit(hf, sel.row, sel.col));
  const [, setVersion] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const editingFormula = useRef(false);

  const select = (row: number, col: number) => {
    setSel({ row, col });
    setEdit(rawForEdit(hf, row, col));
    setHint(null);
  };

  const commit = (moveDown = true) => {
    if (locked(sel.row, sel.col)) {
      setHint('Это исходные данные — их менять не нужно. Выбери пустую ячейку справа или снизу.');
      return;
    }
    const value = edit.trim();
    hf.setCellContents(cell(sel.row, sel.col), value === '' ? null : toEngine(value));
    onChange([{ row: sel.row, col: sel.col }]);
    setVersion((v) => v + 1);
    editingFormula.current = false;
    if (moveDown && sel.row + 1 < rows) select(sel.row + 1, sel.col);
    else setEdit(rawForEdit(hf, sel.row, sel.col));
  };

  const fill = () => {
    if (!hf.doesCellHaveFormula(cell(sel.row, sel.col))) {
      setHint('Выбери ячейку с формулой — её и протянем вниз.');
      return;
    }
    fillDown(hf, sel.row, sel.col, lastDataRow);
    const changed = [];
    for (let r = sel.row; r <= lastDataRow; r++) changed.push({ row: r, col: sel.col });
    onChange(changed);
    setVersion((v) => v + 1);
    setHint(`Формула протянута до ${addrName(lastDataRow, sel.col)}.`);
  };

  const clear = () => {
    if (locked(sel.row, sel.col)) return;
    hf.setCellContents(cell(sel.row, sel.col), null);
    onChange([{ row: sel.row, col: sel.col }]);
    setEdit('');
    setVersion((v) => v + 1);
  };

  // Если набираем формулу и нажимаем на ячейку — вставляем её адрес
  const onCellPointerDown = (e: React.PointerEvent, row: number, col: number) => {
    const canInsert = editingFormula.current && edit.startsWith('=') && /[=(;:+\-*/<>&^]\s*$/.test(edit);
    if (canInsert) {
      e.preventDefault();
      setEdit(edit + addrName(row, col));
      input.current?.focus();
      return;
    }
    select(row, col);
  };

  // Панель быстрых символов над экранной клавиатурой вставляет текст в строку формул
  const editRef = useRef(edit);
  editRef.current = edit;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const target = useMemo<InputTarget>(
    () => ({
      kind: 'sheet',
      insert: (text) => {
        const el = input.current;
        if (!el) return;
        const v = editRef.current;
        const start = el.selectionStart ?? v.length;
        const end = el.selectionEnd ?? start;
        editingFormula.current = true;
        setEdit(v.slice(0, start) + text + v.slice(end));
        requestAnimationFrame(() => el.setSelectionRange(start + text.length, start + text.length));
      },
      move: (delta) => {
        const el = input.current;
        if (!el) return;
        const p = Math.max(0, Math.min(el.value.length, (el.selectionStart ?? 0) + delta));
        el.setSelectionRange(p, p);
      },
      enter: () => commitRef.current(true),
      blur: () => input.current?.blur(),
    }),
    [],
  );
  useEffect(() => () => clearActiveInput(target), [target]);

  // Выбранная ячейка всегда видна внутри таблицы (важно на узком экране телефона).
  // Прокручиваем только саму таблицу, а не всю страницу.
  useEffect(() => {
    const box = scrollBox.current;
    const td = box?.querySelector<HTMLElement>('.sheet-cell.selected');
    if (!box || !td) return;
    const rowHeader = box.querySelector<HTMLElement>('tbody th')?.offsetWidth ?? 0;
    const colHeader = box.querySelector<HTMLElement>('thead th')?.offsetHeight ?? 0;
    const { offsetLeft: left, offsetTop: top, offsetWidth: w, offsetHeight: h } = td;
    if (left - rowHeader < box.scrollLeft) box.scrollLeft = left - rowHeader;
    else if (left + w > box.scrollLeft + box.clientWidth) {
      // Останавливаемся ровно на границе столбца, чтобы слева не торчал его обрезанный край
      const need = left + w - box.clientWidth;
      const starts = [...box.querySelectorAll<HTMLElement>('thead th')].slice(1).map((th) => th.offsetLeft - rowHeader);
      box.scrollLeft = starts.find((s) => s >= need) ?? need;
    }
    if (top - colHeader < box.scrollTop) box.scrollTop = top - colHeader;
    else if (top + h > box.scrollTop + box.clientHeight) box.scrollTop = top + h - box.clientHeight;
  }, [sel]);

  const selShown = shown(hf, sel.row, sel.col);

  return (
    <div className="sheet">
      <div className="sheet-bar">
        <span className="sheet-addr">{addrName(sel.row, sel.col)}</span>
        <span className="sheet-fx">fx</span>
        <input
          ref={input}
          value={edit}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={locked(sel.row, sel.col) ? 'Исходные данные' : 'Число, текст или формула: =СУММ(B2:B10)'}
          enterKeyHint="done"
          onFocus={() => {
            editingFormula.current = true;
            setActiveInput(target);
          }}
          onBlur={() => {
            editingFormula.current = false;
            clearActiveInput(target);
          }}
          onChange={(e) => {
            editingFormula.current = true;
            setEdit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(true);
            } else if (e.key === 'Escape') {
              setEdit(rawForEdit(hf, sel.row, sel.col));
            }
          }}
        />
        <button className="btn btn-small btn-primary" onClick={() => commit(false)} title="Ввести (Enter)">
          ✓
        </button>
      </div>
      <div className="sheet-scroll" ref={scrollBox}>
        <table className="sheet-table">
          <colgroup>
            <col style={{ width: 36 }} />
            {Array.from({ length: cols }, (_, c) => (
              <col key={c} style={{ width: widths?.[c] ?? 110 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sheet-corner" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={c === sel.col ? 'active' : undefined}>
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={r === sel.row ? 'active' : undefined}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const v = shown(hf, r, c);
                  const cls = [
                    'sheet-cell',
                    v.kind,
                    r === 0 ? 'header' : '',
                    locked(r, c) ? 'locked' : 'free',
                    r === sel.row && c === sel.col ? 'selected' : '',
                    hf.doesCellHaveFormula(cell(r, c)) ? 'formula' : '',
                  ].join(' ');
                  return (
                    <td
                      key={c}
                      className={cls}
                      onPointerDown={(e) => onCellPointerDown(e, r, c)}
                      onDoubleClick={() => input.current?.focus()}
                      title={v.kind === 'error' && v.error ? ERROR_HELP[v.error]?.replace(/`/g, '') : undefined}
                    >
                      {v.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-small btn-secondary" onClick={fill}>
          ⤓ Протянуть вниз до строки {lastDataRow + 1}
        </button>
        <button className="btn btn-small btn-ghost" onClick={clear}>
          Очистить ячейку
        </button>
        {selShown.kind === 'error' && selShown.error && <span className="sheet-hint error">{ERROR_HELP[selShown.error]?.replace(/`/g, '')}</span>}
        {hint && <span className="sheet-hint">{hint}</span>}
      </div>
    </div>
  );
}
