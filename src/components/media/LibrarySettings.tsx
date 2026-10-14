// «Настройки» → «Видеотека»: подключение к компьютеру, где лежат купленные курсы.

import { useEffect, useState } from 'react';
import { CircleCheck, CirclePlay, Download, ExternalLink, Link2, RefreshCw, Smartphone, Trash2, TriangleAlert, Unlink, X } from 'lucide-react';
import { connectServer, refreshCatalog, useMedia } from '../../media/client';
import { canDownload, cancelQueue, openInPhonePlayer, removeAll, removeVideo, savedBytes, useOffline } from '../../media/offline';
import { plural } from '../../sql/compare';

const isLocalApp = typeof location !== 'undefined' && ['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol === 'http:';

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  if (/^http:\/\/[^/:]+$/i.test(u)) u += ':3700';
  return u;
}

/** На компьютере: адрес и код, которые нужно ввести на телефоне */
function PhoneConnect({ url }: { url: string }) {
  const [info, setInfo] = useState<{ addresses: string[]; key: string } | null>(null);
  useEffect(() => {
    fetch(`${url}/api/phone`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [url]);
  if (!info?.addresses.length) return null;
  return (
    <div className="phone-connect">
      <div className="phone-connect-title">
        <Smartphone size={18} aria-hidden /> Подключить телефон
      </div>
      <p className="small muted">
        На телефоне открой «Настройки» → «Видеотека курсов» и впиши эти данные. Телефон должен быть подключён к домашнему Wi-Fi.
      </p>
      <dl>
        <dt>Адрес</dt>
        <dd>
          {info.addresses.map((a) => (
            <code key={a}>{a}</code>
          ))}
        </dd>
        <dt>Код доступа</dt>
        <dd>
          <code className="phone-code">{info.key}</code>
        </dd>
      </dl>
    </div>
  );
}

export function LibrarySettings() {
  const m = useMedia();
  const [url, setUrl] = useState(m.server && !isLocalApp ? m.server.url : '');
  const [key, setKey] = useState(m.server?.key ?? '');
  const [error, setError] = useState('');
  const videos = m.catalog?.courses.reduce((s, c) => s + c.videos, 0) ?? 0;
  const hours = m.catalog?.courses.reduce((s, c) => s + c.hours, 0) ?? 0;

  const connect = () => {
    const u = normalizeUrl(url);
    if (!u) {
      setError('Впиши адрес компьютера — он показан в окне «Видеотека» на компьютере.');
      return;
    }
    if (!/^\d{6}$/.test(key.trim())) {
      setError('Код доступа — 6 цифр из окна «Видеотека» на компьютере.');
      return;
    }
    setError('');
    connectServer({ url: u, key: key.trim() });
  };

  return (
    <section className="card settings-section">
      <h2>
        <CirclePlay size={22} aria-hidden /> Видеотека курсов
      </h2>
      <p className="muted">
        Видео и материалы купленных курсов лежат на твоём компьютере. Приложение показывает их прямо в уроках — как YouTube, без скачивания целиком.
        Компьютер при этом должен быть включён, а видеосервер запущен (он стартует вместе с <code>start.bat</code>).
        {canDownload && ' Чтобы смотреть вне дома, скачай нужные темы на телефон кнопкой «Скачать» в уроке — они будут играть без компьютера и интернета.'}
      </p>

      {m.status === 'ok' && m.catalog && (
        <p className="status-ok">
          <CircleCheck size={18} aria-hidden /> Подключено: {videos} {plural(videos, 'видео', 'видео', 'видео')}, около {Math.round(hours)} ч, из{' '}
          {m.catalog.courses.length} {plural(m.catalog.courses.length, 'курса', 'курсов', 'курсов')}.
        </p>
      )}
      {m.status === 'loading' && <p className="muted">Подключаюсь к компьютеру…</p>}
      {m.status === 'error' && (
        <p className="warn-text status-ok">
          <TriangleAlert size={18} aria-hidden /> {m.message}
        </p>
      )}
      {m.status === 'off' && isLocalApp && <p className="muted">Видеосервер на этом компьютере не запущен. Запусти приложение через start.bat.</p>}

      {!isLocalApp && (
        <div className="library-form">
          <label>
            <span>Адрес компьютера</span>
            <input className="number-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.1.20:3700" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label>
            <span>Код доступа</span>
            <input className="number-input" value={key} onChange={(e) => setKey(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 цифр" inputMode="numeric" />
          </label>
          {error && <p className="warn-text small" style={{ margin: 0 }}>{error}</p>}
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={connect}>
              <Link2 size={18} aria-hidden /> Подключить
            </button>
            {m.server && (
              <>
                <button className="btn btn-secondary" onClick={() => refreshCatalog()}>
                  <RefreshCw size={17} aria-hidden /> Обновить список
                </button>
                <button className="btn btn-ghost" onClick={() => connectServer(null)}>
                  <Unlink size={17} aria-hidden /> Отключить
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {isLocalApp && m.server && m.status === 'ok' && <PhoneConnect url={m.server.url} />}
      {isLocalApp && m.server && (
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={() => refreshCatalog()}>
            <RefreshCw size={17} aria-hidden /> Обновить список
          </button>
        </div>
      )}

      <details className="settings-help">
        <summary>Как смотреть видео с телефона</summary>
        <ol>
          <li>На компьютере запусти приложение через <code>start.bat</code> — вместе с ним откроется окно «Видеотека».</li>
          <li>В этом окне написаны адрес компьютера и код доступа из 6 цифр.</li>
          <li>Телефон должен быть в той же Wi-Fi-сети, что и компьютер. Впиши адрес и код выше и нажми «Подключить».</li>
          <li>Чтобы смотреть вне дома, заранее скачай темы на телефон (кнопка «Скачать» в уроке). А если компьютер дома включён, можно смотреть и без скачивания через Tailscale — бесплатную закрытую сеть для твоих устройств.</li>
        </ol>
      </details>
    </section>
  );
}

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} ГБ` : `${Math.max(1, Math.round(b / 1e6))} МБ`);

/** «Настройки» → «Скачанные видео»: что лежит на телефоне и сколько места занимает */
export function DownloadedVideos() {
  const off = useOffline();
  if (!canDownload) return null;
  const list = Object.values(off.saved).sort((a, b) => a.topic.localeCompare(b.topic, 'ru', { numeric: true }) || a.title.localeCompare(b.title, 'ru', { numeric: true }));
  const busy = off.queue.length + Object.keys(off.progress).length;
  return (
    <section className="card settings-section">
      <h2>
        <Download size={22} aria-hidden /> Скачанные видео
      </h2>
      <p className="muted">
        {list.length
          ? `На телефоне ${list.length} ${plural(list.length, 'видео', 'видео', 'видео')}, ${fmtSize(savedBytes(off))}. Они играют без компьютера и интернета.`
          : 'Пока ничего не скачано. В уроке нажми «Скачать все видео темы» — дома, по Wi-Fi, пока компьютер включён.'}
      </p>
      {busy > 0 && (
        <div className="settings-actions">
          <span className="muted">Скачивается: {busy}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={cancelQueue}>
            <X size={16} aria-hidden /> Остановить очередь
          </button>
        </div>
      )}
      {off.error && <p className="warn-text small">{off.error}</p>}
      {list.length > 0 && (
        <>
          <ul className="saved-list">
            {list.map((v) => (
              <li key={v.id}>
                <span className="saved-text">
                  <span className="saved-title">{v.title}</span>
                  <span className="small muted">
                    {v.course} · {fmtSize(v.size)}
                  </span>
                </span>
                <button type="button" className="icon-btn" title="Открыть в плеере телефона" aria-label="Открыть в плеере телефона" onClick={() => openInPhonePlayer(v.id)}>
                  <ExternalLink size={17} aria-hidden />
                </button>
                <button type="button" className="icon-btn" title="Удалить с телефона" aria-label="Удалить с телефона" onClick={() => removeVideo(v.id)}>
                  <Trash2 size={17} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Удалить все скачанные видео с телефона? На компьютере они останутся.')) removeAll();
              }}
            >
              <Trash2 size={17} aria-hidden /> Удалить все скачанные
            </button>
          </div>
        </>
      )}
    </section>
  );
}
