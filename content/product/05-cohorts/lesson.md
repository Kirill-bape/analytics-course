## Когорта — пользователи одного «призыва»

Средние по всей базе обманывают. Если удержание за месяц упало, это могут быть плохие новые клиенты из нового рекламного канала, а могут быть старые клиенты, которые разочаровались. В общей цифре это смешано. **Когорта** — группа пользователей, пришедших в один период: в одну неделю или в один месяц. Сравнивая когорты, видно, как меняется качество продукта и аудитории **со временем**.

В итоговом проекте мы уже считали долю вернувшихся. Здесь соберём полную **когортную таблицу** и посчитаем **LTV по когортам**.

## Когортная таблица удержания

Строки — когорты (месяц первого заказа), столбцы — месяц жизни (0, 1, 2…), в ячейках — доля клиентов когорты, сделавших заказ в этот месяц жизни.

```sql
WITH firsts AS (
    SELECT customer_id, CAST(date_trunc('month', MIN(order_date)) AS DATE) AS cohort
    FROM orders
    GROUP BY customer_id
),
activity AS (
    SELECT DISTINCT f.cohort, o.customer_id,
           datediff('month', f.cohort, date_trunc('month', o.order_date)) AS month_n
    FROM orders o
    JOIN firsts f ON f.customer_id = o.customer_id
),
sizes AS (
    SELECT cohort, COUNT(*) AS size FROM firsts GROUP BY cohort
)
SELECT a.cohort, s.size, a.month_n,
       ROUND(100.0 * COUNT(*) / s.size, 1) AS retention_pct
FROM activity a
JOIN sizes s ON s.cohort = a.cohort
WHERE a.cohort >= '2025-10-01' AND a.month_n BETWEEN 1 AND 3
GROUP BY a.cohort, s.size, a.month_n
ORDER BY a.cohort, a.month_n;
```

`datediff('month', начало, конец)` — сколько месяцев прошло между датами. В Python ту же таблицу удобно развернуть через `pivot`:

```python
o = orders.copy()
o["month"] = o["order_date"].dt.to_period("M")
o["cohort"] = o.groupby("customer_id")["month"].transform("min")
o["month_n"] = (o["month"] - o["cohort"]).apply(lambda d: d.n)

active = o.drop_duplicates(["customer_id", "month_n"])
table = active.pivot_table(index="cohort", columns="month_n", values="customer_id", aggfunc="count")
retention = table.div(table[0], axis=0).round(3)
print(retention.loc["2025-10":"2026-01", [1, 2, 3]])
```

Как читать таблицу:

- **по строке** — как одна когорта «тает» со временем;
- **по столбцу** — меняется ли удержание у новых когорт: если удержание 1-го месяца у свежих когорт ниже, значит, продукт или аудитория стали хуже;
- **по диагонали** — события в конкретный календарный месяц (например, акция в декабре подняла всех).

> ⚠️ Последние когорты всегда «короткие»: у когорты мая ещё нет 3-го месяца жизни. Не сравнивай их с полными.

## LTV по когортам

**Накопленная выручка на клиента** когорты — сколько в среднем принёс клиент к N-му месяцу жизни. Эта кривая растёт и со временем выходит на плато — это и есть оценка LTV по выручке. Умножив на маржу, получим LTV по прибыли.

```sql
WITH firsts AS (
    SELECT customer_id, CAST(date_trunc('month', MIN(order_date)) AS DATE) AS cohort
    FROM orders
    GROUP BY customer_id
),
rev AS (
    SELECT f.cohort,
           datediff('month', f.cohort, date_trunc('month', o.order_date)) AS month_n,
           SUM(o.amount) AS revenue
    FROM orders o
    JOIN firsts f ON f.customer_id = o.customer_id
    WHERE o.status = 'delivered'
    GROUP BY f.cohort, month_n
),
sizes AS (SELECT cohort, COUNT(*) AS size FROM firsts GROUP BY cohort)
SELECT r.cohort, r.month_n,
       ROUND(SUM(r.revenue) OVER (PARTITION BY r.cohort ORDER BY r.month_n) / s.size) AS cum_revenue_per_client
FROM rev r
JOIN sizes s ON s.cohort = r.cohort
WHERE r.cohort = '2025-01-01' AND r.month_n <= 5
ORDER BY r.month_n;
```

## Воронка

**Воронка** — последовательность шагов к цели и доля пользователей, дошедших до каждого шага: зашёл → карточка товара → корзина → оформление → оплата → получение. Анализ воронки показывает, **где теряется больше всего людей** — туда и направляют усилия.

В наших данных есть «хвост» воронки — путь заказа после оформления:

```sql
SELECT COUNT(*)                                                       AS created,
       COUNT(*) FILTER (WHERE status IN ('shipped', 'delivered', 'returned')) AS shipped,
       COUNT(*) FILTER (WHERE status IN ('delivered', 'returned'))           AS delivered,
       COUNT(*) FILTER (WHERE status = 'delivered')                          AS kept
FROM orders
WHERE order_date < '2026-06-01';
```

Две конверсии стоит различать:

- **пошаговая** — от предыдущего шага: где именно провал;
- **от начала воронки** — какая доля всех дошла до конца.

Воронку считают **по одним и тем же пользователям** (или заказам) и за **одинаковое окно времени**. Иначе можно получить «конверсию больше 100%» или сравнить несравнимое.

## Шпаргалка

| Задача | Как |
|---|---|
| когорта клиента | месяц его первого заказа: `date_trunc('month', MIN(order_date))` |
| месяц жизни | `datediff('month', cohort, date_trunc('month', order_date))` |
| удержание | активные в месяц N / размер когорты |
| таблица в pandas | `pivot_table(index="cohort", columns="month_n", …)`, деление на столбец 0 |
| LTV когорты | накопленная выручка / размер когорты, `SUM(…) OVER (PARTITION BY cohort ORDER BY month_n)` |
| воронка | число дошедших до каждого шага, пошаговая и сквозная конверсия |
