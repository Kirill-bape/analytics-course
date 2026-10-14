// Блоки урока с материалами купленных курсов: видео (плеер с таймкодами)
// и документы (конспекты, презентации, задания, данные). Файлы идут с компьютера.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookText,
  ChevronDown,
  CircleCheck,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Globe,
  NotebookPen,
  Play,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { fileUrl, formatDuration, saveWatched, useWatched, type MediaDoc, type MediaDocKind, type MediaVideo } from '../../media/client';
import { plural } from '../../sql/compare';
import { MarkdownText } from '../Markdown';

export { useLessonMedia } from '../../media/client';

function totalTime(videos: MediaVideo[]): string {
  const sec = videos.reduce((s, v) => s + v.duration, 0);
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

function groupBy<T extends { course: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) map.set(it.course, [...(map.get(it.course) ?? []), it]);
  return [...map.entries()];
}

function Player({ video, onClose }: { video: MediaVideo; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSave = useRef(0);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [video.id]);
  const seek = (t: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => undefined);
  };
  return (
    <div className="player card">
      <video
        ref={ref}
        key={video.id}
        src={fileUrl(video.id)}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!v.duration || Date.now() - lastSave.current < 5000) return;
          lastSave.current = Date.now();
          saveWatched(video.id, v.currentTime / v.duration > 0.9 ? 1 : v.currentTime / v.duration);
        }}
        onEnded={() => saveWatched(video.id, 1)}
      />
      <div className="player-info">
        <div>
          <div className="player-title">{video.title}</div>
          <div className="small muted">
            {video.course} · {video.section}
          </div>
        </div>
        <button type="button" className="btn btn-small btn-ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {video.description && <MarkdownText text={video.description} className="player-desc markdown" />}
      {video.chapters && video.chapters.length > 0 && (
        <ol className="chapters">
          {video.chapters.map((c) => (
            <li key={c.t}>
              <button type="button" onClick={() => seek(c.t)}>
                <span className="chapter-time">{formatDuration(c.t) || '0:00'}</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function LessonVideos({ videos }: { videos: MediaVideo[] }) {
  const [playing, setPlaying] = useState<MediaVideo | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const watched = useWatched();
  const groups = useMemo(() => groupBy(videos), [videos]);
  const done = videos.filter((v) => (watched[v.id] ?? 0) >= 1).length;

  return (
    <>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        {videos.length} {plural(videos.length, 'видео', 'видео', 'видео')} из купленных курсов · {totalTime(videos)} · просмотрено {done}. Видео идут с
        компьютера — он должен быть включён.
      </p>
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
      {groups.map(([course, list], gi) => {
        const isOpen = open[course] ?? gi === 0;
        return (
          <div key={course} className="card media-group">
            <button type="button" className="media-group-head" onClick={() => setOpen({ ...open, [course]: !isOpen })} aria-expanded={isOpen}>
              <span className="media-group-title">{course}</span>
              <span className="small muted">
                {list.length} {plural(list.length, 'видео', 'видео', 'видео')} · {totalTime(list)}
              </span>
              <ChevronDown size={18} className={`chev${isOpen ? ' up' : ''}`} aria-hidden />
            </button>
            {isOpen && (
              <ul className="video-list">
                {list.map((v) => {
                  const w = watched[v.id] ?? 0;
                  return (
                    <li key={v.id}>
                      <button type="button" className={`video-row${playing?.id === v.id ? ' active' : ''}`} onClick={() => setPlaying(v)}>
                        <span className={`video-thumb${w >= 1 ? ' watched' : ''}`} aria-hidden>
                          {w >= 1 ? <CircleCheck size={20} /> : <Play size={18} fill="currentColor" />}
                        </span>
                        <span className="video-text">
                          <span className="video-title">{v.title}</span>
                          <span className="video-meta">
                            {formatDuration(v.duration) || 'длительность неизвестна'}
                            {v.chapters?.length ? ` · ${v.chapters.length} ${plural(v.chapters.length, 'раздел', 'раздела', 'разделов')}` : ''}
                          </span>
                          {v.description && <span className="video-desc">{v.description}</span>}
                          {w > 0 && w < 1 && (
                            <span className="progress-bar thin video-progress">
                              <span style={{ width: `${w * 100}%` }} />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

const DOC_ICON: Record<MediaDocKind, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  slides: Presentation,
  notebook: NotebookPen,
  data: FileSpreadsheet,
  code: FileCode,
  page: Globe,
  text: FileText,
  archive: FileArchive,
  book: BookText,
  other: FileText,
};

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1e3))} КБ`);

export function LessonMaterials({ items, title }: { items: MediaDoc[]; title: string }) {
  if (!items.length) return null;
  return (
    <div className="card materials">
      <h3>{title}</h3>
      <ul className="doc-list">
        {items.map((d) => {
          const Icon = DOC_ICON[d.kind] ?? FileText;
          return (
            <li key={d.id}>
              <a className="doc-row" href={fileUrl(d.id)} target="_blank" rel="noreferrer">
                <span className={`icon-tile tone-${d.kind === 'data' ? 'green' : d.kind === 'notebook' || d.kind === 'code' ? 'amber' : 'indigo'}`} style={{ width: 38, height: 38, borderRadius: 12 }} aria-hidden>
                  <Icon size={19} />
                </span>
                <span className="doc-text">
                  <span className="doc-title">{d.title}</span>
                  <span className="doc-meta">
                    {d.course} · {d.ext.toUpperCase()} · {fmtSize(d.size)}
                  </span>
                  {d.brief && <MarkdownText text={d.brief} className="doc-brief markdown" />}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
