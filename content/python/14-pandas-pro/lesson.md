## Следующий уровень pandas

Фильтры, группировки и `merge` закрывают большую часть задач. Эта тема — про приёмы, которые отличают уверенного аналитика: менять **форму** таблицы, считать **внутри групп** без лишних `merge`, писать код **цепочкой** и не тормозить на больших данных.

## Длинная и широкая таблица: melt и pivot

Одни и те же данные можно хранить двумя способами.

**Широкий** формат — удобен человеку, как в отчёте:

| city | 2025 | 2026 |
|---|---|---|
| Москва | 120 | 150 |
| Казань | 40 | 52 |

**Длинный** формат — удобен для расчётов и графиков: одна строка = одно наблюдение.

| city | year | revenue |
|---|---|---|
| Москва | 2025 | 120 |
| Москва | 2026 | 150 |

`melt` превращает широкую таблицу в длинную, `pivot` (или `pivot_table`) — обратно:

```python
wide = pd.DataFrame({"city": ["Москва", "Казань"], "2025": [120, 40], "2026": [150, 52]})
long = wide.melt(id_vars="city", var_name="year", value_name="revenue")
print(long)
print(long.pivot(index="city", columns="year", values="revenue"))
```

`pivot` требует, чтобы каждая пара «строка × столбец» встречалась один раз. Если повторы есть, используй `pivot_table` с агрегацией (`aggfunc="sum"`).

## transform: итог группы в каждой строке

`groupby(...).sum()` сжимает группу в одну строку. А `transform` возвращает итог группы **для каждой строки**, сохраняя исходный размер таблицы. Так легко посчитать долю строки в группе:

```python
d = orders[orders["status"] == "delivered"].copy()
d["customer_total"] = d.groupby("customer_id")["amount"].transform("sum")
d["share"] = (d["amount"] / d["customer_total"]).round(3)
print(d[["customer_id", "amount", "customer_total", "share"]].head())
```

Без `transform` пришлось бы сгруппировать, а потом присоединить итоги через `merge`.

## Расчёты внутри групп: cumsum, shift, rank

Оконные функции SQL в pandas тоже есть:

| SQL | pandas |
|---|---|
| `SUM(x) OVER (PARTITION BY g ORDER BY t)` | `df.sort_values(t).groupby(g)[x].cumsum()` |
| `LAG(x) OVER (PARTITION BY g ORDER BY t)` | `df.sort_values(t).groupby(g)[x].shift(1)` |
| `ROW_NUMBER() OVER (PARTITION BY g ORDER BY t)` | `df.sort_values(t).groupby(g).cumcount() + 1` |
| `RANK() OVER (PARTITION BY g ORDER BY x DESC)` | `df.groupby(g)[x].rank(ascending=False, method="min")` |

```python
d = orders[orders["status"] == "delivered"].sort_values(["customer_id", "order_date"]).copy()
d["order_number"] = d.groupby("customer_id").cumcount() + 1          # какой по счёту заказ
d["days_since_prev"] = d.groupby("customer_id")["order_date"].diff().dt.days
print(d[["customer_id", "order_date", "order_number", "days_since_prev"]].head(8))
```

`diff()` — разница с предыдущей строкой группы. Здесь это дни между соседними заказами клиента: основа анализа повторных покупок.

## Цепочки методов

Код можно писать «лесенкой»: каждая строка — один шаг преобразования. Так не появляются десятки промежуточных переменных, и порядок шагов читается сверху вниз:

```python
top_cities = (
    orders
    .query("status == 'delivered'")
    .merge(customers[["customer_id", "city"]], on="customer_id")
    .groupby("city", as_index=False)
    .agg(revenue=("amount", "sum"), orders=("order_id", "count"))
    .assign(avg_check=lambda t: (t["revenue"] / t["orders"]).round(0))
    .sort_values("revenue", ascending=False)
    .head(5)
)
print(top_cities)
```

- `query("…")` — фильтр строкой условия;
- `assign(новый=…)` — добавить столбец, не ломая цепочку. `lambda t:` получает таблицу на текущем шаге;
- скобки вокруг всей цепочки позволяют переносить строки.

## Скорость: векторно, а не построчно

Медленнее всего в pandas работают **циклы по строкам** (`for`, `iterrows`) и `apply(axis=1)`. Почти всегда есть векторная замена:

| Медленно | Быстро |
|---|---|
| `df.apply(lambda r: r["a"] * r["b"], axis=1)` | `df["a"] * df["b"]` |
| `apply` с `if` | `np.where(cond, a, b)`, `np.select(...)` |
| цикл со словарём замен | `df["c"].map(словарь)` |
| `apply(lambda s: s.lower())` | `df["c"].str.lower()` |
| ручные границы через `if` | `pd.cut(df["x"], bins=[…], labels=[…])` |

На тысячах строк разница незаметна, на миллионах — секунды против минут.

## Память: тип category

Текстовые столбцы с небольшим набором повторяющихся значений (город, статус, канал) удобно хранить типом **category**. Каждое значение хранится один раз, а в строках остаются короткие коды. Память сокращается в разы, группировки работают быстрее:

```python
before = orders["status"].memory_usage(deep=True)
after = orders["status"].astype("category").memory_usage(deep=True)
print(before, "→", after, "байт")
```

Для больших файлов указывай типы сразу при чтении: `pd.read_csv(…, dtype={"status": "category"}, usecols=[…])`.

## Шпаргалка

| Задача | Код |
|---|---|
| широкая → длинная | `df.melt(id_vars="key", var_name="col", value_name="val")` |
| длинная → широкая | `df.pivot(index=…, columns=…, values=…)` |
| итог группы в каждой строке | `df.groupby(g)[x].transform("sum")` |
| накопительная сумма в группе | `df.groupby(g)[x].cumsum()` |
| предыдущее значение в группе | `df.groupby(g)[x].shift(1)` |
| номер строки в группе | `df.groupby(g).cumcount() + 1` |
| ранг в группе | `df.groupby(g)[x].rank(ascending=False)` |
| фильтр строкой | `df.query("status == 'delivered'")` |
| новый столбец в цепочке | `.assign(col=lambda t: …)` |
| группы по границам | `pd.cut(x, bins=[…], labels=[…])` |
| экономия памяти | `.astype("category")` |
