import { MarkdownText } from '../Markdown';
import { ErrorBox } from '../ErrorBox';
import type { ExplainedError } from '../../sql/errors';

export type FeedbackState =
  | { kind: 'ok'; notes?: string[] }
  | { kind: 'wrong'; title: string; details: string[] }
  | { kind: 'error'; error: ExplainedError }
  | null;

export function Feedback({ state, usedSolution }: { state: FeedbackState; usedSolution?: boolean }) {
  if (!state) return null;
  if (state.kind === 'error') return <ErrorBox error={state.error} />;
  if (state.kind === 'ok') {
    return (
      <div className="feedback feedback-success" role="status">
        <div className="feedback-title">🎉 Верно! Задание засчитано.</div>
        {usedSolution && <div className="feedback-body">Решение было открыто — попробуй через пару дней решить это задание снова самостоятельно.</div>}
        {state.notes?.map((d, i) => <MarkdownText key={i} text={`📝 ${d}`} className="feedback-body markdown" />)}
      </div>
    );
  }
  return (
    <div className="feedback feedback-wrong" role="status">
      <div className="feedback-title">✗ {state.title}</div>
      {state.details.map((d, i) => (
        <MarkdownText key={i} text={d} className="feedback-body markdown" />
      ))}
    </div>
  );
}
