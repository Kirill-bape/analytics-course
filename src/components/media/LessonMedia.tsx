// Блоки урока с материалами купленных курсов: видео (плеер с таймкодами,
// скачивание на телефон) и документы (конспекты, презентации, задания, данные).
// Сверху — три основных курса, остальные — под кнопкой «Ещё из других курсов».

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookText,
  ChevronDown,
  CircleCheck,
  Clock,
  Download,
  ExternalLink,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  Globe,
  NotebookPen,
  Play,
  Presentation,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { fileUrl, formatDuration, saveWatched, useMedia, useWatched, type MediaDoc, type MediaDocKind, type MediaVideo } from '../../media/client';
import { canDownload, download, offlineSrc, openInPhonePlayer, removeVideo, useOffline } from '../../media/offline';
import { plural } from '../../sql/compare';
import { MarkdownText } from '../Markdown';

export { useLessonMedia } from '../../media/client';

function totalTime(videos: MediaVideo[]): string {
  const sec = videos.reduce((s, v) => s + v.duration, 0);
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} ГБ` : b > 1e6 ? `${Math.round(b / 1e6)} МБ` : `${Math.max(1, Math.round(b / 1e3))} КБ`);

function groupBy<T extends { course: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) map.set(it.course, [...(map.get(it.course) ?? []), it]);
  return [...map.entries()];
}

/** Основные материалы и дополнительные (если основных нет — показываем все сразу) */
function splitTiers<T extends { tier?: 'main' | 'extra' }>(items: T[]): { main: T[]; extra: T[] } {
  const main = items.filter((i) => i.tier !== 'extra');
  const extra = items.filter((i) => i.tier === 'extra');
  return main.length ? { main, extra } : { main: extra, extra: [] };
}

function Player({ video, onClose }: { video: MediaVideo; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSave = useRef(0);
  const offline = useOffline();
  const [failed, setFailed] = useState(false);
  const local = offline.saved[video.id] ? offlineSrc(video.id) : null;
  useEffect(() => {
    setFailed(false);
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
        key={video.id + (local ? '-local' : '')}
        src={local ?? fileUrl(video.id)}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!v.duration || Date.now() - lastSave.current < 5000) return;
          lastSave.current = Date.now();
          saveWatched(video.id, v.currentTime / v.duration > 0.9 ? 1 : v.currentTime / v.duration);
        }}
        onEnded={() => saveWatched(video.id, 1)}
      />
      {failed && (
        <p className="player-error">
          {local
            ? 'Встроенный плеер не открыл этот файл. Открой его в плеере телефона — кнопка ниже.'
            : 'Видео не загрузилось: компьютер сейчас недоступен. Скачай видео дома, чтобы смотреть его без компьютера.'}
        </p>
      )}
      <div className="player-info">
        <div>
          <div className="player-title">{video.title}</div>
          <div className="small muted">
            {video.course} · {video.section}
            {local ? ' · скачано на телефон' : ''}
          </div>
        </div>
        <div className="player-actions">
          {local && (
            <button type="button" className="btn btn-small btn-secondary" onClick={() => openInPhonePlayer(video.id)}>
              <ExternalLink size={15} aria-hidden /> В плеере телефона
            </button>
          )}
          <button type="button" className="btn btn-small btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
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

function DownloadButton({ video, topic }: { video: MediaVideo; topic: string }) {
  const off = useOffline();
  const { status } = useMedia();
  if (!canDownload) return null;
  const p = off.progress[video.id];
  if (off.saved[video.id]) {
    return (
      <button type="button" className="icon-btn saved" title="Скачано. Нажми, чтобы удалить с телефона" aria-label="Удалить скачанное видео" onClick={() => removeVideo(video.id)}>
        <Trash2 size={17} aria-hidden />
      </button>
    );
  }
  if (p !== undefined) return <span className="icon-btn busy">{Math.round(p * 100)}%</span>;
  if (status !== 'ok') return null;
  if (off.queue.includes(video.id)) {
    return (
      <span className="icon-btn" title="В очереди на скачивание">
        <Clock size={17} aria-hidden />
      </span>
    );
  }
  return (
    <button type="button" className="icon-btn" title={`Скачать на телефон (${fmtSize(video.size)})`} aria-label="Скачать видео на телефон" onClick={() => download([video], topic)}>
      <Download size={17} aria-hidden />
    </button>
  );
}

function VideoGroups({ videos, topic, playing, setPlaying, firstOpen }: { videos: MediaVideo[]; topic: string; playing: MediaVideo | null; setPlaying: (v: MediaVideo) => void; firstOpen: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const watched = useWatched();
  const off = useOffline();
  const { status } = useMedia();
  const groups = useMemo(() => groupBy(videos), [videos]);
  return (
    <>
      {groups.map(([course, list], gi) => {
        const isOpen = open[course] ?? (firstOpen && gi === 0);
        const notSaved = list.filter((v) => !off.saved[v.id]);
        return (
          <div key={course} className="card media-group">
            <div className="media-group-bar">
              <button type="button" className="media-group-head" onClick={() => setOpen({ ...open, [course]: !isOpen })} aria-expanded={isOpen}>
                <span className="media-group-title">{course}</span>
                <span className="small muted">
                  {list.length} {plural(list.length, 'видео', 'видео', 'видео')} · {totalTime(list)}
                </span>
                <ChevronDown size={18} className={`chev${isOpen ? ' up' : ''}`} aria-hidden />
              </button>
              {canDownload && status === 'ok' && notSaved.length > 0 && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => download(notSaved, topic)} title="Скачать все видео этого курса по теме">
                  <Download size={15} aria-hidden /> {fmtSize(notSaved.reduce((s, v) => s + v.size, 0))}
                </button>
              )}
            </div>
            {isOpen && (
              <ul className="video-list">
                {list.map((v) => {
                  const w = watched[v.id] ?? 0;
                  return (
                    <li key={v.id} className="video-item">
                      <button type="button" className={`video-row${playing?.id === v.id ? ' active' : ''}`} onClick={() => setPlaying(v)}>
                        <span className={`video-thumb${w >= 1 ? ' watched' : ''}`} aria-hidden>
                          {w >= 1 ? <CircleCheck size={20} /> : <Play size={18} fill="currentColor" />}
                        </span>
                        <span className="video-text">
                          <span className="video-title">{v.title}</span>
                          <span className="video-meta">
                            {formatDuration(v.duration) || 'длительность уточняется'}
                            {v.chapters?.length ? ` · ${v.chapters.length} ${plural(v.chapters.length, 'раздел', 'раздела', 'разделов')}` : ''}
                            {off.saved[v.id] ? ' · на телефоне' : ''}
                            {v.damaged ? ' · файл частично повреждён, местами может прерываться' : ''}
                          </span>
                          {v.description && <span className="video-desc">{v.description}</span>}
                          {w > 0 && w < 1 && (
                            <span className="progress-bar thin video-progress">
                              <span style={{ width: `${w * 100}%` }} />
                            </span>
                          )}
                        </span>
                      </button>
                      <DownloadButton video={v} topic={topic} />
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

export function LessonVideos({ videos, topic = '' }: { videos: MediaVideo[]; topic?: string }) {
  const [playing, setPlaying] = useState<MediaVideo | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const watched = useWatched();
  const off = useOffline();
  const { status } = useMedia();
  const { main, extra } = useMemo(() => splitTiers(videos), [videos]);
  const done = main.filter((v) => (watched[v.id] ?? 0) >= 1).length;
  const notSaved = main.filter((v) => !off.saved[v.id]);

  return (
    <>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        {main.length} {plural(main.length, 'видео', 'видео', 'видео')} · {totalTime(main)} · просмотрено {done}.{' '}
        {canDownload
          ? 'Дома видео идут с компьютера, а скачанные — играют где угодно без интернета.'
          : 'Видео идут с компьютера — он должен быть включён.'}
      </p>
      {canDownload && status === 'ok' && notSaved.length > 0 && (
        <button type="button" className="btn btn-secondary download-all" onClick={() => download(notSaved, topic)}>
          <Download size={18} aria-hidden /> Скачать все видео темы · {fmtSize(notSaved.reduce((s, v) => s + v.size, 0))}
        </button>
      )}
      {status === 'error' && (
        <p className="warn-text small">
          Компьютер сейчас недоступен — играют только скачанные на телефон видео{canDownload ? ' (с пометкой «на телефоне»)' : ''}.
        </p>
      )}
      {off.error && <p className="warn-text small">{off.error}</p>}
      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
      <VideoGroups videos={main} topic={topic} playing={playing} setPlaying={setPlaying} firstOpen />
      {extra.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost show-extra" onClick={() => setShowExtra(!showExtra)} aria-expanded={showExtra}>
            <ChevronDown size={18} className={`chev${showExtra ? ' up' : ''}`} aria-hidden />
            {showExtra ? 'Скрыть другие курсы' : `Ещё из других курсов: ${extra.length} ${plural(extra.length, 'видео', 'видео', 'видео')}`}
          </button>
          {showExtra && <VideoGroups videos={extra} topic={topic} playing={playing} setPlaying={setPlaying} firstOpen={false} />}
        </>
      )}
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

function DocList({ items }: { items: MediaDoc[] }) {
  return (
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
  );
}

export function LessonMaterials({ items, title }: { items: MediaDoc[]; title: string }) {
  const [showExtra, setShowExtra] = useState(false);
  const { main, extra } = useMemo(() => splitTiers(items), [items]);
  if (!items.length) return null;
  return (
    <div className="card materials">
      <h3>{title}</h3>
      <DocList items={main} />
      {extra.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost btn-small show-extra" onClick={() => setShowExtra(!showExtra)} aria-expanded={showExtra}>
            <ChevronDown size={16} className={`chev${showExtra ? ' up' : ''}`} aria-hidden />
            {showExtra ? 'Скрыть другие курсы' : `Ещё из других курсов: ${extra.length}`}
          </button>
          {showExtra && <DocList items={extra} />}
        </>
      )}
    </div>
  );
}
