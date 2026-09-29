// Показ текста уроков (Markdown). Примеры ```sql становятся «живыми»:
// их можно менять и запускать прямо в уроке.

import { useMemo } from 'react';
import { marked, type Token, type Tokens, type TokensList } from 'marked';
import { SqlExample } from './SqlExample';

type Segment = { kind: 'html'; html: string } | { kind: 'sql'; code: string };

export function mdInline(text: string): string {
  return marked.parseInline(text, { async: false });
}

export function mdBlock(text: string): string {
  return marked.parse(text, { async: false });
}

export function Markdown({ source, runnable = false }: { source: string; runnable?: boolean }) {
  const segments = useMemo(() => {
    const tokens = marked.lexer(source);
    const out: Segment[] = [];
    let buffer: Token[] = [];
    const flush = () => {
      if (!buffer.length) return;
      const list = Object.assign(buffer, { links: tokens.links }) as TokensList;
      out.push({ kind: 'html', html: marked.parser(list) });
      buffer = [];
    };
    for (const t of tokens) {
      if (runnable && t.type === 'code' && (t as Tokens.Code).lang === 'sql') {
        flush();
        out.push({ kind: 'sql', code: (t as Tokens.Code).text });
      } else {
        buffer.push(t);
      }
    }
    flush();
    return out;
  }, [source, runnable]);

  return (
    <div className="markdown">
      {segments.map((s, i) =>
        s.kind === 'html' ? <div key={i} dangerouslySetInnerHTML={{ __html: s.html }} /> : <SqlExample key={i} code={s.code} />,
      )}
    </div>
  );
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  return <div className={className ?? 'markdown'} dangerouslySetInnerHTML={{ __html: mdBlock(text) }} />;
}
