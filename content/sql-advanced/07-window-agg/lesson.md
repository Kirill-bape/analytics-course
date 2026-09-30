## Агрегаты в окне

Обычные агрегаты (`SUM`, `AVG`, `COUNT`) тоже бывают оконными — с `OVER`. Тогда итог считается по окну, а строки остаются на месте. Это открывает три главных приёма аналитика: **доля от итога**, **накопительный итог** и **сравнение с прошлым периодом**.

## Доля от итога

`SUM(x) OVER ()` с пустыми скобками — сумма по **всей** таблице, которая повторяется в каждой строке. Делим на неё — получаем долю:

```sql
WITH cat AS (
    SELECT p.category, SUM(oi.quantity * oi.price) AS revenue
    FROM order_items oi
    JOIN products p USING (product_id)
    GROUP BY p.category
)
SELECT category, revenue,
       ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS share_pct
FROM cat
ORDER BY revenue DESC;
```

С `PARTITION BY` получится доля внутри группы — например, доля каждого товара в выручке своей категории.

## Накопительный итог

Если в окне есть `ORDER BY`, сумма становится **накопительной**: для каждой строки складываются все строки от начала до текущей.

```sql
-- chart: line
WITH m AS (
    SELECT CAST(date_trunc('month', order_date) AS DATE) AS month, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'delivered' AND order_date < '2026-01-01'
    GROUP BY month
)
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month) AS cumulative
FROM m
ORDER BY month;
```

Так отвечают на вопрос «выполняем ли мы годовой план»: накопленная выручка сравнивается с целью.

## LAG и LEAD: соседние строки

- `LAG(x)` — значение из **предыдущей** строки окна;
- `LEAD(x)` — из **следующей**.

Главное применение — рост к прошлому периоду:

```sql
WITH m AS (
    SELECT CAST(date_trunc('month', order_date) AS DATE) AS month, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'delivered'
    GROUP BY month
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM m
ORDER BY month;
```

У первого месяца предыдущего нет, поэтому там `NULL` — это нормально.

С `PARTITION BY` `LAG` работает внутри каждого объекта: например, дни между заказами одного клиента — `order_date - LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date)`.

## Скользящее среднее

Ежедневные данные «шумят». Чтобы увидеть тренд, берут среднее за последние 7 дней. Размер окна задают рамкой `ROWS BETWEEN`:

```sql
-- chart: line
WITH d AS (
    SELECT order_date, COUNT(*) AS orders_cnt
    FROM orders
    WHERE order_date >= '2025-11-01' AND order_date < '2026-01-01'
    GROUP BY order_date
)
SELECT order_date, orders_cnt,
       ROUND(AVG(orders_cnt) OVER (ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) AS ma7
FROM d
ORDER BY order_date;
```

`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` — текущая строка и 6 предыдущих, всего 7 дней. На графике хорошо видны всплеск Чёрной пятницы и предновогодний рост.

## Шпаргалка

| Задача | Как |
|---|---|
| доля от итога | `x / SUM(x) OVER ()` |
| доля внутри группы | `x / SUM(x) OVER (PARTITION BY группа)` |
| накопительный итог | `SUM(x) OVER (ORDER BY дата)` |
| прошлое значение | `LAG(x) OVER (ORDER BY дата)` |
| скользящее среднее | `AVG(x) OVER (ORDER BY дата ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)` |
