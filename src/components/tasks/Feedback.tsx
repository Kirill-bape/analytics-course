import { CircleCheck, CircleX, Sparkles } from 'lucide-react';
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
        <div className="feedback-title">
          <CircleCheck size={22} strokeWidth={2.4} aria-hidden /> Верно! Задание засчитано
        </div>
        {usedSolution && <div className="feedback-body">Решение было открыто — попробуй через пару дней решить это задание снова самостоятельно.</div>}
        {state.notes?.map((d, i) => (
          <div key={i} className="feedback-note">
            <Sparkles size={16} aria-hidden />
            <MarkdownText text={d} className="feedback-body markdown" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="feedback feedback-wrong" role="status">
      <div className="feedback-title">
        <CircleX size={22} strokeWidth={2.2} aria-hidden /> {state.title}
      </div>
      {state.details.map((d, i) => (
        <MarkdownText key={i} text={d} className="feedback-body markdown" />
      ))}
    </div>
  );
}
