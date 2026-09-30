// Редактор кода на CodeMirror 6: подсветка SQL, автодополнение названий
// таблиц и столбцов, Ctrl+Enter — запустить, Ctrl+Shift+Enter — проверить.

import { useEffect, useRef } from 'react';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { tables } from '../content';

export interface EditorApi {
  getSelection: () => string;
  focus: () => void;
}

interface Props {
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
  onCheck?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  apiRef?: React.RefObject<EditorApi | null>;
  compact?: boolean;
  language?: 'sql' | 'python';
}

const schema = Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.name)]));

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.lineComment, tags.blockComment, tags.comment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--code-operator)' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: 'var(--code-type)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.name)], color: 'var(--code-function)' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--code-fg)', fontSize: '14.5px', borderRadius: '10px' },
  '&.cm-focused': { outline: '2px solid var(--accent-soft)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { padding: '10px 0', caretColor: 'var(--code-fg)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--code-gutter)', border: 'none', borderRadius: '10px 0 0 10px' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--code-selection) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--code-fg)' },
  '.cm-placeholder': { color: 'var(--code-gutter)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'white' },
  '.cm-matchingBracket': { backgroundColor: 'var(--code-selection)', outline: 'none' },
});

export function CodeEditor({ value, onChange, onRun, onCheck, readOnly, placeholder, apiRef, compact, language = 'sql' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun, onCheck });
  callbacks.current = { onChange, onRun, onCheck };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', run: () => (callbacks.current.onRun?.(), true) },
              { key: 'Shift-Mod-Enter', run: () => (callbacks.current.onCheck?.(), true) },
            ]),
          ),
          basicSetup,
          language === 'python' ? python() : sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
          language === 'python' ? EditorState.tabSize.of(4) : [],
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorState.tabSize.of(2),
          EditorState.readOnly.of(Boolean(readOnly)),
          EditorView.editable.of(!readOnly),
          placeholder ? placeholderExt(placeholder) : [],
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    if (apiRef) {
      apiRef.current = {
        getSelection: () => {
          const { from, to } = v.state.selection.main;
          return v.state.sliceDoc(from, to);
        },
        focus: () => v.focus(),
      };
    }
    return () => {
      v.destroy();
      view.current = null;
    };
    // Редактор создаётся один раз; новое значение приходит через эффект ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Если значение поменяли снаружи (например, «Сбросить код») — обновляем редактор
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div className={`code-editor${compact ? ' compact' : ''}`} ref={host} />;
}
