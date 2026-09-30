## groupby — GROUP BY в pandas

Итоги по группам в pandas считаются в три шага: **разделить** по группам → **посчитать** в каждой → **собрать** результат.

```python
orders.groupby("status")["amount"].sum()
```

Читается: «сгруппируй заказы по статусу, возьми столбец `amount`, посчитай сумму в каждой группе». Результат — Series, где **индекс** — значения группы (статусы).

## Несколько показателей сразу: agg

Метод `.agg()` с **именованными агрегатами** — самый понятный способ:

```python
delivered = orders[orders["status"] == "delivered"]

delivered.groupby("payment_method").agg(
    orders_cnt=("order_id", "count"),
    revenue=("amount", "sum"),
    avg_check=("amount", "mean"),
).round(2)
```

Каждая строка внутри `agg` — «новый столбец = (какой столбец, какая функция)». Функции: `"sum"`, `"mean"`, `"median"`, `"count"`, `"nunique"`, `"min"`, `"max"`, `"std"`.

## Индекс или столбец

После `groupby` колонка группировки становится **индексом** таблицы. Если нужен обычный столбец (например, для дальнейших объединений), добавь `.reset_index()` или сразу `groupby(..., as_index=False)`:

```python
products.groupby("category", as_index=False)["price"].mean().round(0)
```

## Сортировка итогов

```python
(
    orders[orders["status"] == "delivered"]
    .groupby("payment_method")["amount"]
    .sum()
    .sort_values(ascending=False)
)
```

Длинные цепочки удобно писать в скобках — каждый шаг с новой строки.

## Группировка по датам

У столбца с датами есть «аксессор» `.dt` с частями даты: `.dt.year`, `.dt.month`, `.dt.day_name()`, `.dt.to_period("M")`.

```python
d = orders[(orders["status"] == "delivered") & (orders["order_date"].dt.year == 2025)]
d.groupby(d["order_date"].dt.month)["amount"].sum()
```

## Сводная таблица: pivot_table

`pivot_table` — полный аналог сводной таблицы Excel: строки, столбцы, значения, функция.

```python
production.pivot_table(index="line_id", columns="shift", values="produced_units", aggfunc="sum")
```

## Шпаргалка

| Задача | pandas | SQL |
|---|---|---|
| сумма по группам | `df.groupby("a")["x"].sum()` | `GROUP BY a` + `SUM(x)` |
| несколько метрик | `.agg(n=("x", "count"), s=("x", "sum"))` | несколько агрегатов |
| группа — столбцом | `as_index=False` или `.reset_index()` | — |
| размер групп | `df.groupby("a").size()` | `COUNT(*)` |
| сводная | `df.pivot_table(index=…, columns=…, values=…, aggfunc="sum")` | — |
