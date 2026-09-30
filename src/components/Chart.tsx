// Простые графики по результату SQL-запроса: столбцы (bar) и линии (line).
// Цвета — из проверенной палитры (см. --series-* в styles.css).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChartSpec } from '../content';
import type { Cell } from '../sql/engine';

interface Props {
  spec: ChartSpec;
  columns: string[];
  rows: Cell[][];
}

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : nf.format(v));

function niceStep(max: number, ticks = 4): number {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Chart({ spec, columns, rows }: Props) {
  const xi = spec.x ?? 0;
  const yis = useMemo(() => {
    if (spec.y?.length) return spec.y;
    return columns.map((_, i) => i).filter((i) => i !== xi && rows.some((r) => typeof r[i] === 'number'));
  }, [spec.y, columns, rows, xi]);
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setHover(null), [rows]);

  if (!rows.length || !yis.length) {
    return <div className="chart-empty">Для графика нужен хотя бы один столбец с числами.</div>;
  }
  const data = rows.slice(0, 60);
  const labels = data.map((r) => String(r[xi] ?? '—'));
  const series = yis.slice(0, 3).map((i, s) => ({
    name: columns[i],
    color: `var(--series-${s + 1})`,
    values: data.map((r) => (typeof r[i] === 'number' ? (r[i] as number) : 0)),
  }));
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const min = Math.min(0, ...series.flatMap((s) => s.values));
  const step = niceStep(max - min || 1);
  const top = Math.ceil(max / step) * step || step;
  const bottom = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = bottom; t <= top + 1e-9; t += step) ticks.push(t);

  const legend =
    series.length > 1 ? (
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    ) : null;

  // ----- Горизонтальные столбцы -----
  if (spec.type === 'bar') {
    const labelW = Math.min(Math.max(...labels.map((l) => l.length)) * 7 + 12, width * 0.42);
    const barH = Math.min(24, Math.max(10, 36 / series.length));
    const rowH = barH * series.length + 12;
    const plotW = Math.max(60, width - labelW - 56);
    const h = rowH * data.length + 28;
    const xOf = (v: number) => labelW + ((v - bottom) / (top - bottom)) * plotW;
    return (
      <div className="chart" ref={box}>
        {legend}
        <svg width={width} height={h} role="img" aria-label={`График: ${series.map((s) => s.name).join(', ')}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={0} y2={h - 22} className="chart-grid" />
              <text x={xOf(t)} y={h - 6} className="chart-tick" textAnchor="middle">
                {fmt(t)}
              </text>
            </g>
          ))}
          {data.map((_, i) => {
            const y0 = i * rowH + 6;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="chart-row">
                <rect x={0} y={y0 - 4} width={width} height={rowH} className={hover === i ? 'chart-hit hover' : 'chart-hit'} />
                <text x={labelW - 8} y={y0 + (barH * series.length) / 2 + 4} className="chart-label" textAnchor="end">
                  {labels[i].length > 34 ? labels[i].slice(0, 33) + '…' : labels[i]}
                </text>
                {series.map((s, si) => {
                  const v = s.values[i];
                  const x0 = xOf(Math.min(0, v));
                  const w = Math.max(1, Math.abs(xOf(v) - xOf(0)));
                  const r = Math.min(4, w / 2, barH / 2);
                  const y = y0 + si * barH;
                  const hBar = barH - (series.length > 1 ? 2 : 0);
                  // Скруглён только конец столбца, у основания — прямой угол
                  const path =
                    v >= 0
                      ? `M${x0},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${hBar - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z`
                      : `M${x0 + w},${y} h${-(w - r)} a${r},${r} 0 0 0 ${-r},${r} v${hBar - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${w - r} z`;
                  return <path key={si} d={path} fill={s.color} />;
                })}
              </g>
            );
          })}
          <line x1={xOf(0)} x2={xOf(0)} y1={0} y2={h - 22} className="chart-axis" />
        </svg>
        {hover !== null && (
          <div className="chart-tooltip">
            <b>{labels[hover]}</b>
            {series.map((s) => (
              <div key={s.name}>
                <i style={{ background: s.color }} /> {s.name}: <b>{nf.format(s.values[hover])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ----- Линии -----
  const padL = 56;
  const padR = 16;
  const h = 260;
  const plotH = h - 44;
  const plotW = Math.max(60, width - padL - padR);
  const xOf = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yOf = (v: number) => 8 + plotH - ((v - bottom) / (top - bottom)) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 80))));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - padL) / plotW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className="chart" ref={box}>
      {legend}
      <svg width={width} height={h} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`График: ${series.map((s) => s.name).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + plotW} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? 'chart-axis' : 'chart-grid'} />
            <text x={padL - 8} y={yOf(t) + 4} className="chart-tick" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === labels.length - 1 ? (
            <text key={i} x={xOf(i)} y={h - 12} className="chart-tick" textAnchor="middle">
              {l.length > 10 ? l.slice(0, 10) : l}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={xOf(hover)} x2={xOf(hover)} y1={8} y2={8 + plotH} className="chart-crosshair" />}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={xOf(data.length - 1)} cy={yOf(s.values[data.length - 1])} r={4} fill={s.color} className="chart-dot" />
            {hover !== null && <circle cx={xOf(hover)} cy={yOf(s.values[hover])} r={5} fill={s.color} className="chart-dot" />}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip">
          <b>{labels[hover]}</b>
          {series.map((s) => (
            <div key={s.name}>
              <i style={{ background: s.color }} /> {s.name}: <b>{nf.format(s.values[hover])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Разбор подсказки графика из первой строки примера: -- chart: bar */
export function chartFromComment(code: string): ChartSpec | undefined {
  const m = code.match(/^\s*--\s*chart:\s*(bar|line)/im);
  return m ? { type: m[1] as 'bar' | 'line' } : undefined;
}
