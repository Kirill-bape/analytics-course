# Служебный код, который выполняется один раз после запуска Python.
# Загружает учебные таблицы и умеет превращать результаты в таблицы для проверки.

import base64
import io
import json
import math
import os
import sys
import datetime
import warnings

os.environ["MPLBACKEND"] = "agg"
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd

pd.set_option("display.max_columns", 30)
pd.set_option("display.width", 140)

_DATA = {}


def _load_table(name, file_name, date_cols):
    _DATA[name] = pd.read_csv(file_name, parse_dates=list(date_cols) or False)


def _make_ns():
    ns = {"__name__": "__main__", "pd": pd, "np": np}
    for key, df in _DATA.items():
        ns[key] = df.copy()
    return ns


def _cell(v):
    if v is None:
        return None
    try:
        if v is pd.NA or v is pd.NaT:
            return None
    except Exception:
        pass
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    if isinstance(v, (int, np.integer)):
        return int(v)
    if isinstance(v, (float, np.floating)):
        return None if math.isnan(v) else float(v)
    if isinstance(v, pd.Timestamp):
        if v.hour == 0 and v.minute == 0 and v.second == 0:
            return v.strftime("%Y-%m-%d")
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, pd.Timedelta):
        return str(v)
    return str(v)


def _col_name(c):
    if isinstance(c, tuple):
        return "_".join(str(x) for x in c if str(x) != "")
    return str(c)


def _frame_to_table(df, limit=None):
    idx = df.index
    # Безымянный числовой индекс (номера строк после фильтра) не показываем и не сравниваем.
    # Именованный индекс (например, после groupby) превращаем в обычный столбец.
    plain = isinstance(idx, pd.RangeIndex) or (
        not isinstance(idx, pd.MultiIndex) and idx.name is None and pd.api.types.is_integer_dtype(idx)
    )
    if plain:
        df = df.reset_index(drop=True)
    else:
        df = df.reset_index()
    total = len(df)
    if limit is not None:
        df = df.head(limit)
    columns = [_col_name(c) for c in df.columns]
    rows = [[_cell(v) for v in row] for row in df.itertuples(index=False, name=None)]
    return {"kind": "table", "columns": columns, "rows": rows, "total": total}


def _to_table(obj, limit=None):
    if isinstance(obj, pd.DataFrame):
        return _frame_to_table(obj, limit)
    if isinstance(obj, pd.Series):
        name = obj.name if obj.name is not None else "value"
        if isinstance(obj.index, pd.RangeIndex) and obj.index.name is None:
            return _frame_to_table(obj.to_frame(name=name), limit)
        return _frame_to_table(obj.to_frame(name=name), limit)
    if isinstance(obj, pd.Index):
        return _to_table(pd.Series(obj, name=obj.name or "value"), limit)
    if isinstance(obj, np.ndarray):
        return _to_table(pd.Series(obj.ravel(), name="value"), limit)
    if isinstance(obj, (list, tuple, set)):
        return _to_table(pd.Series(list(obj), name="value", dtype=object), limit)
    if isinstance(obj, dict):
        items = list(obj.items())
        return {"kind": "table", "columns": ["key", "value"], "rows": [[_cell(k), _cell(v)] for k, v in items], "total": len(items)}
    return {"kind": "table", "columns": ["value"], "rows": [[_cell(obj)]], "total": 1}


def _display(value):
    """Как показать значение последней строки кода (как в Jupyter)."""
    if isinstance(value, (pd.DataFrame, pd.Series, pd.Index, np.ndarray)):
        return _to_table(value, limit=200)
    return {"kind": "text", "text": repr(value)}


def _figures():
    if "matplotlib.pyplot" not in sys.modules:
        return [], []
    import matplotlib.pyplot as plt
    from matplotlib.container import BarContainer
    from matplotlib.patches import Wedge

    images, info = [], []
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
        images.append(base64.b64encode(buf.getvalue()).decode())
        for ax in fig.axes:
            kinds = set()
            bars = [c for c in ax.containers if isinstance(c, BarContainer)]
            if bars or (ax.patches and not any(isinstance(p, Wedge) for p in ax.patches)):
                kinds.add("bar")
            if any(isinstance(p, Wedge) for p in ax.patches):
                kinds.add("pie")
            if any(len(l.get_xdata()) > 1 for l in ax.get_lines()):
                kinds.add("line")
            if ax.collections:
                kinds.add("scatter")
            info.append({
                "kinds": sorted(kinds),
                "title": ax.get_title() or fig._suptitle.get_text() if fig._suptitle else ax.get_title(),
                "xlabel": ax.get_xlabel(),
                "ylabel": ax.get_ylabel(),
                "n_bars": sum(len(c) for c in bars),
                "n_lines": len(ax.get_lines()),
            })
    plt.close("all")
    return images, info


def _cleanup():
    if "matplotlib.pyplot" in sys.modules:
        import matplotlib.pyplot as plt
        plt.close("all")


async def _run_user(code, result_var):
    from pyodide.code import eval_code_async

    ns = _make_ns()
    out = {"display": None, "result": None, "has_result": False}
    try:
        value = await eval_code_async(code, globals=ns, filename="<code>")
        # Служебные объекты matplotlib (Text, Line2D…) не показываем — под графиком они только мешают
        probe = value[0] if isinstance(value, list) and value else value
        if value is not None and not type(probe).__module__.startswith("matplotlib"):
            out["display"] = _display(value)
        if result_var:
            if result_var in ns:
                out["result"] = _to_table(ns[result_var])
                out["has_result"] = True
        out["figures"], out["plot_info"] = _figures()
    finally:
        _cleanup()
    return json.dumps(out, ensure_ascii=False, default=str)
