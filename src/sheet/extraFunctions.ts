// Функции Excel, которых нет в HyperFormula: линейный прогноз и отрезок прямой тренда.
// ПРЕДСКАЗ(x; известные_y; известные_x) и ПРЕДСКАЗ.ЛИНЕЙН — значение линии тренда в точке x,
// ОТРЕЗОК(известные_y; известные_x) — где линия тренда пересекает ось Y.

import { CellError, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula, SimpleRangeValue, type ImplementedFunctions } from 'hyperformula';

/** Пары чисел (x, y). Пары, где хоть одно значение не число (текст, пусто), пропускаются — как в Excel */
function pairs(ys: SimpleRangeValue, xs: SimpleRangeValue): [number[], number[]] | CellError {
  const yv = ys.valuesFromTopLeftCorner();
  const xv = xs.valuesFromTopLeftCorner();
  if (yv.length !== xv.length) return new CellError(ErrorType.NA, 'Диапазоны должны быть одного размера');
  const X: number[] = [];
  const Y: number[] = [];
  for (let i = 0; i < yv.length; i++) {
    const x = num(xv[i]);
    const y = num(yv[i]);
    if (x instanceof CellError) return x;
    if (y instanceof CellError) return y;
    if (x !== null && y !== null) {
      X.push(x);
      Y.push(y);
    }
  }
  return [X, Y];
}

function num(v: unknown): number | null | CellError {
  if (v instanceof CellError) return v;
  if (typeof v === 'number') return v;
  // Даты и проценты хранятся как объект с полем val
  if (v && typeof v === 'object' && 'val' in v && typeof (v as { val: unknown }).val === 'number') return (v as { val: number }).val;
  return null;
}

/** Коэффициенты прямой y = a + b·x по методу наименьших квадратов */
function line(ys: SimpleRangeValue, xs: SimpleRangeValue): { a: number; b: number } | CellError {
  const p = pairs(ys, xs);
  if (p instanceof CellError) return p;
  const [X, Y] = p;
  const n = X.length;
  if (n < 2) return new CellError(ErrorType.DIV_BY_ZERO, 'Нужно хотя бы две точки');
  const mx = X.reduce((s, v) => s + v, 0) / n;
  const my = Y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (X[i] - mx) * (Y[i] - my);
    sxx += (X[i] - mx) ** 2;
  }
  if (sxx === 0) return new CellError(ErrorType.DIV_BY_ZERO, 'Все значения x одинаковые');
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

const RANGE = { argumentType: FunctionArgumentType.RANGE };
const NUMBER = { argumentType: FunctionArgumentType.NUMBER };

// Типы аргументов внутренних методов HyperFormula не экспортируются — описываем минимально нужное
type Ast = { args: never[]; procedureName: string };

class ForecastPlugin extends FunctionPlugin {
  static implementedFunctions: ImplementedFunctions = {
    FORECAST: { method: 'forecast', parameters: [NUMBER, RANGE, RANGE] },
    'FORECAST.LINEAR': { method: 'forecast', parameters: [NUMBER, RANGE, RANGE] },
    INTERCEPT: { method: 'intercept', parameters: [RANGE, RANGE] },
  };

  forecast(ast: Ast, state: never) {
    return this.runFunction(ast.args, state, this.metadata(ast.procedureName), (x: number, ys: SimpleRangeValue, xs: SimpleRangeValue) => {
      const l = line(ys, xs);
      return l instanceof CellError ? l : l.a + l.b * x;
    });
  }

  intercept(ast: Ast, state: never) {
    return this.runFunction(ast.args, state, this.metadata('INTERCEPT'), (ys: SimpleRangeValue, xs: SimpleRangeValue) => {
      const l = line(ys, xs);
      return l instanceof CellError ? l : l.a;
    });
  }
}

HyperFormula.registerFunctionPlugin(ForecastPlugin, {
  enGB: { FORECAST: 'FORECAST', 'FORECAST.LINEAR': 'FORECAST.LINEAR', INTERCEPT: 'INTERCEPT' },
});

/** Русские названия, которые в HyperFormula отличаются от русского Excel или отсутствуют */
export const RU_EXTRA: Record<string, string> = {
  IFS: 'ЕСЛИМН',
  SWITCH: 'ПЕРЕКЛЮЧ',
  FILTER: 'ФИЛЬТР',
  FORECAST: 'ПРЕДСКАЗ',
  'FORECAST.LINEAR': 'ПРЕДСКАЗ.ЛИНЕЙН',
  INTERCEPT: 'ОТРЕЗОК',
};
