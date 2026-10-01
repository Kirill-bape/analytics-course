// Настройки: перенос прогресса между устройствами, офлайн-режим, установка приложения.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { makeBackup, parseBackup, SANDBOX, useProgress } from '../progress';
import { taskTotals } from '../stats';
import { plural } from '../sql/compare';
import { ANDROID, canShareFiles, IOS, isStandalone, MAC, NATIVE, SAFARI, saveTextFile, shareTextFile, type SaveResult } from '../platform';
import { getPwa, promptInstall, storageInfo, subscribePwa } from '../pwa';
import { APK_URL, REPO_URL, SITE_URL } from '../links';

type Msg = { kind: 'ok' | 'error' | 'info'; text: string } | null;

const fmtDate = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const fmtMb = (bytes: number) => `${(bytes / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: bytes < 1e7 ? 1 : 0 })} МБ`;

function backupName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `put-analitika-progress-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ProgressSection() {
  const { data, loaded, importProgress, markBackedUp } = useProgress();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const totals = taskTotals(data);
  const share = canShareFiles();
  const since = daysSince(data.lastBackup);

  const exportText = () => JSON.stringify(makeBackup({ ...data, lastBackup: new Date().toISOString() }), null, 2);

  const report = (r: SaveResult) => {
    if (r.kind === 'cancelled') return;
    markBackedUp();
    if (r.kind === 'saved') setMsg({ kind: 'ok', text: `Файл сохранён: ${r.where}.` });
    else if (r.kind === 'shared') setMsg({ kind: 'ok', text: 'Файл с прогрессом отправлен.' });
    else setMsg({ kind: 'ok', text: 'Файл с прогрессом скачан — он в папке «Загрузки». Перенеси его на другое устройство и нажми там «Загрузить из файла».' });
  };

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    try {
      report(await saveTextFile(backupName(), exportText()));
    } catch (e) {
      setMsg({ kind: 'error', text: `Не удалось сохранить файл: ${String((e as Error)?.message ?? e)}` });
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    setBusy(true);
    setMsg(null);
    report(await shareTextFile(backupName(), exportText()));
    setBusy(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    try {
      const incoming = parseBackup(await file.text());
      const s = importProgress(incoming);
      if (s.newSolved === 0 && s.newDays === 0) {
        setMsg({ kind: 'info', text: `В файле нет ничего нового — весь этот прогресс уже есть на устройстве. Всего решено: ${s.totalSolved}.` });
      } else {
        const parts = [];
        if (s.newSolved) parts.push(`${s.newSolved} ${plural(s.newSolved, 'решённое задание', 'решённых задания', 'решённых заданий')}`);
        if (s.newDays) parts.push(`${s.newDays} ${plural(s.newDays, 'день', 'дня', 'дней')} занятий`);
        setMsg({ kind: 'ok', text: `Прогресс объединён: добавлено ${parts.join(' и ')}. Всего решено: ${s.totalSolved}.` });
      }
    } catch (e) {
      setMsg({ kind: 'error', text: String((e as Error)?.message ?? e) });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section className="card settings-section">
      <h2>💾 Мой прогресс</h2>
      {SANDBOX && <p className="banner banner-accent">Тестовый режим (?sandbox): прогресс не сохраняется на устройстве.</p>}
      <p>
        Прогресс хранится в памяти этого устройства.{' '}
        {loaded && (
          <>
            Решено <b>{totals.solved}</b> из {totals.total} {plural(totals.total, 'задания', 'заданий', 'заданий')}, дней занятий: <b>{data.activeDays.length}</b>.
          </>
        )}
      </p>
      <p className={`muted small${since !== null && since >= 7 ? ' warn-text' : ''}`}>
        {data.lastBackup ? `Последняя копия в файл: ${fmtDate(data.lastBackup)}${since && since > 0 ? ` (${since} ${plural(since, 'день', 'дня', 'дней')} назад)` : ''}.` : 'Копию прогресса в файл ещё не сохраняли.'}
      </p>
      <div className="settings-actions">
        <button className="btn btn-primary" onClick={onSave} disabled={busy || !loaded}>
          💾 Сохранить прогресс в файл
        </button>
        <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={busy || !loaded}>
          📂 Загрузить из файла
        </button>
        {share && !NATIVE && (
          <button className="btn btn-secondary" onClick={onShare} disabled={busy || !loaded}>
            📤 Отправить…
          </button>
        )}
        {NATIVE && (
          <button className="btn btn-secondary" onClick={onShare} disabled={busy || !loaded}>
            📤 Отправить в Telegram, на почту…
          </button>
        )}
        <input ref={fileInput} type="file" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {msg && <div className={`feedback feedback-${msg.kind === 'ok' ? 'success' : msg.kind === 'error' ? 'error' : 'info'}`}>{msg.text}</div>}
      <details className="settings-help">
        <summary>Как перенести прогресс на другое устройство</summary>
        <ol>
          <li>Здесь нажми «Сохранить прогресс в файл»{share ? ' или «Отправить…»' : ''}.</li>
          <li>Передай файл на другое устройство: через Telegram («Избранное»), почту, Google Диск{IOS || MAC ? ', AirDrop' : ''} или кабель.</li>
          <li>На другом устройстве открой «Настройки» → «Загрузить из файла» и выбери этот файл.</li>
        </ol>
        <p className="muted small">
          Загрузка ничего не стирает: прогресс <b>объединяется</b>. Задание считается решённым, если оно решено хотя бы на одном устройстве, а дни занятий складываются. Поэтому можно спокойно заниматься то на телефоне, то на компьютере и время от времени обмениваться файлом.
        </p>
        <p className="muted small">Сохраняй копию раз в неделю: если удалить приложение или очистить данные браузера, прогресс на устройстве пропадёт, а файл останется.</p>
      </details>
    </section>
  );
}

function OfflineSection() {
  const pwa = useSyncExternalStore(subscribePwa, getPwa);
  const [storage, setStorage] = useState<{ usage?: number; persisted?: boolean }>({});
  useEffect(() => {
    storageInfo().then(setStorage);
  }, [pwa.offline.kind]);
  const o = pwa.offline;

  return (
    <section className="card settings-section">
      <h2>📶 Работа без интернета</h2>
      {o.kind === 'native' && <p>✅ Всё нужное уже внутри приложения: уроки, база данных и Python работают без интернета.</p>}
      {o.kind === 'ready' && <p>✅ Приложение полностью скачано на устройство: уроки, база данных и Python работают без интернета.</p>}
      {o.kind === 'preparing' && (
        <>
          <p>⏳ Скачиваю приложение на устройство, чтобы оно работало без интернета. Это нужно один раз: около 85 МБ, лучше по Wi-Fi. Можно заниматься, не дожидаясь конца.</p>
          {o.total > 0 && (
            <div className="offline-progress">
              <div className="progress-bar">
                <div style={{ width: `${(o.done / o.total) * 100}%` }} />
              </div>
              <span className="small muted">
                {fmtMb(o.done)} из {fmtMb(o.total)}
              </span>
            </div>
          )}
        </>
      )}
      {o.kind === 'error' && <p className="warn-text">⚠️ {o.message}</p>}
      {o.kind === 'unsupported' && <p>Этот браузер не умеет работать без интернета. Открой приложение в Chrome, Safari или Samsung Internet.</p>}
      {o.kind === 'dev' && (
        <p className="muted">
          Сейчас приложение запущено на компьютере (через start.bat) — интернет ему и так не нужен. Офлайн-режим для телефона и iPad включается в опубликованной версии сайта.
        </p>
      )}
      {storage.usage !== undefined && o.kind !== 'dev' && (
        <p className="muted small">
          Занято на устройстве: {fmtMb(storage.usage)}.{' '}
          {storage.persisted ? 'Данные защищены от автоматической очистки ✓' : 'Браузер может удалить данные, если на устройстве закончится место, — поэтому сохраняй копию прогресса в файл.'}
        </p>
      )}
    </section>
  );
}

function InstallSection() {
  const pwa = useSyncExternalStore(subscribePwa, getPwa);
  const standalone = isStandalone();
  if (NATIVE) return null;

  return (
    <section className="card settings-section">
      <h2>📲 Установить как приложение</h2>
      {standalone ? (
        <p>✅ Приложение установлено и открыто со своего значка.</p>
      ) : (
        <>
          <p className="muted">Значок появится на главном экране или в Dock, а приложение будет открываться в своём окне — как обычная программа.</p>
          {pwa.canInstall && (
            <div className="settings-actions">
              <button className="btn btn-primary" onClick={() => promptInstall()}>
                📲 Установить приложение
              </button>
            </div>
          )}
          <ul className="install-list">
            {(IOS || (!ANDROID && !MAC)) && (
              <li className={IOS ? 'current' : undefined}>
                <b>iPad и iPhone</b> (Safari): кнопка «Поделиться» <span aria-hidden>⎋</span> → «На экран „Домой"» → «Добавить».
              </li>
            )}
            {(MAC || (!ANDROID && !IOS)) && (
              <li className={MAC ? 'current' : undefined}>
                <b>MacBook</b>: в Safari — меню «Файл» → «Добавить в Dock»; в Chrome — значок установки в адресной строке.
              </li>
            )}
            {(ANDROID || (!IOS && !MAC)) && (
              <li className={ANDROID ? 'current' : undefined}>
                <b>Android</b>: {APK_URL ? <a href={APK_URL}>скачай APK</a> : 'установи APK'} (самый надёжный вариант) или в Chrome — меню ⋮ → «Добавить на главный экран».
              </li>
            )}
            {!IOS && !ANDROID && !MAC && (
              <li className="current">
                <b>Компьютер</b>: в Chrome или Edge — значок установки справа в адресной строке.
              </li>
            )}
          </ul>
          {IOS && !SAFARI && <p className="muted small">На iPad и iPhone установка работает только из Safari.</p>}
        </>
      )}
    </section>
  );
}

function AboutSection() {
  return (
    <section className="card settings-section">
      <h2>ℹ️ О приложении</h2>
      <p className="muted small">
        «Путь аналитика», версия {__APP_VERSION__}
        {__BUILD_TIME__ && <> от {new Date(__BUILD_TIME__).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</>}
        {NATIVE ? ' · Android' : ''}. Работает бесплатно и без регистрации, ничего не отправляет в интернет.
      </p>
      {(SITE_URL || APK_URL || REPO_URL) && (
        <ul className="about-links small">
          {SITE_URL && (
            <li>
              Сайт (для iPad, MacBook и компьютера): <a href={SITE_URL}>{SITE_URL.replace(/^https:\/\//, '')}</a>
            </li>
          )}
          {APK_URL && (
            <li>
              Приложение для Android: <a href={APK_URL}>скачать APK</a>
            </li>
          )}
          {REPO_URL && (
            <li>
              Исходный код: <a href={REPO_URL}>{REPO_URL.replace(/^https:\/\//, '')}</a>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="page settings-page">
      <div className="page-head">
        <h1>Настройки</h1>
        <p className="lead">Перенос прогресса между устройствами, работа без интернета и установка.</p>
      </div>
      <ProgressSection />
      <OfflineSection />
      <InstallSection />
      <AboutSection />
    </div>
  );
}
