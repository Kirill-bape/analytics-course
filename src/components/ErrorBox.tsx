import { TriangleAlert } from 'lucide-react';
import type { ExplainedError } from '../sql/errors';
import { MarkdownText } from './Markdown';

export function ErrorBox({ error }: { error: ExplainedError }) {
  return (
    <div className="feedback feedback-error">
      <div className="feedback-title">
        <TriangleAlert size={20} strokeWidth={2.2} aria-hidden /> {error.title}
      </div>
      <MarkdownText text={error.text} className="feedback-body markdown" />
      {error.raw && (
        <details className="raw-error">
          <summary>Текст ошибки от базы данных</summary>
          <pre>{error.raw}</pre>
        </details>
      )}
    </div>
  );
}
