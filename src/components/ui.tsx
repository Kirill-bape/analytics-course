// Общие детали дизайна «Чистый»: значки модулей, круг прогресса, звёзды сложности.

import type { ReactNode } from 'react';
import {
  BrainCircuit,
  Briefcase,
  ChartColumn,
  Code,
  Database,
  FlaskConical,
  Layers,
  LayoutDashboard,
  Network,
  PieChart,
  Sheet,
  Sigma,
  Star,
  TrendingUp,
  Trophy,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/** Значок и цвет каждого модуля курса */
const MODULE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  'sql-basics': { icon: Database, tone: 'indigo' },
  excel: { icon: Sheet, tone: 'green' },
  'sql-advanced': { icon: Layers, tone: 'violet' },
  statistics: { icon: Sigma, tone: 'pink' },
  python: { icon: Code, tone: 'amber' },
  visualization: { icon: ChartColumn, tone: 'teal' },
  dashboards: { icon: LayoutDashboard, tone: 'blue' },
  'ab-tests': { icon: FlaskConical, tone: 'orange' },
  'final-project': { icon: Trophy, tone: 'gold' },
  product: { icon: TrendingUp, tone: 'teal' },
  bi: { icon: PieChart, tone: 'blue' },
  dwh: { icon: Warehouse, tone: 'violet' },
  ml: { icon: BrainCircuit, tone: 'pink' },
  'neural-networks': { icon: Network, tone: 'indigo' },
  career: { icon: Briefcase, tone: 'gold' },
};

export function moduleStyle(moduleId: string) {
  return MODULE_STYLE[moduleId] ?? { icon: Layers, tone: 'indigo' };
}

/** Квадратная цветная плитка со значком модуля */
export function ModuleTile({ moduleId, size = 44 }: { moduleId: string; size?: number }) {
  const { icon: Icon, tone } = moduleStyle(moduleId);
  return (
    <span className={`icon-tile tone-${tone}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }} aria-hidden>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}

/** Плитка с любым значком и цветом */
export function IconTile({ icon: Icon, tone = 'indigo', size = 36 }: { icon: LucideIcon; tone?: string; size?: number }) {
  return (
    <span className={`icon-tile tone-${tone}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} aria-hidden>
      <Icon size={Math.round(size * 0.52)} strokeWidth={2} />
    </span>
  );
}

/** Круг прогресса с подписью в центре */
export function ProgressRing({ value, size = 68, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="ring-value"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <span className="ring-label">{children}</span>}
    </span>
  );
}

/** Сложность задания: 1–3 звезды */
export function Difficulty({ level }: { level: number }) {
  return (
    <span className="difficulty" title={`Сложность ${level} из 3`} aria-label={`Сложность ${level} из 3`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={15} strokeWidth={0} className={i <= level ? 'on' : 'off'} fill="currentColor" />
      ))}
    </span>
  );
}
