import type { ExplainedError } from '../sql/errors';
import { MarkdownText } from './Markdown';

export function ErrorBox({ error }: { error: ExplainedError }) {
  return (
    <div className="feedback feedback-error">
      <div className="feedback-title">⚠️ {error.title}</div>
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
