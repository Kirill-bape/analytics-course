## Анализ: от общего к частному

Порядок, который работает почти в любом проекте:

1. **Общая картина** — ключевые метрики и их динамика (выручка, заказы, средний чек по месяцам).
2. **Разрезы** — где рост и где проблемы (категории, города, каналы).
3. **Клиенты** — возвращаются ли они и кто самые ценные (когорты, RFM).
4. **Эксперименты** — что показали A/B-тесты.
5. **Выводы** — 3–5 главных находок и рекомендации.

Первые два пункта ты уже умеешь. Разберём два приёма, которые обязательно стоит показать в портфолио.

## Когортный анализ

**Когорта** — группа клиентов, которые пришли в одно время (например, сделали первый заказ в одном месяце). Когортный анализ отвечает на вопрос: **какая доля клиентов возвращается** через 1, 2, 3 месяца после первой покупки. Это главный способ измерить удержание (retention).

Шаг 1 — для каждого клиента месяц первого заказа (когорта):

```sql
WITH first AS (
    SELECT customer_id, CAST(date_trunc('month', MIN(order_date)) AS DATE) AS cohort
    FROM orders
    GROUP BY customer_id
)
SELECT cohort, COUNT(*) AS customers
FROM first
GROUP BY cohort
ORDER BY cohort;
```

Шаг 2 — для каждого заказа считаем, через сколько месяцев после когорты он сделан, и считаем долю вернувшихся:

```sql
WITH first AS (
    SELECT customer_id, CAST(date_trunc('month', MIN(order_date)) AS DATE) AS cohort
    FROM orders
    GROUP BY customer_id
),
activity AS (
    SELECT DISTINCT f.cohort, o.customer_id,
           date_diff('month', f.cohort, CAST(date_trunc('month', o.order_date) AS DATE)) AS month_n
    FROM orders o
    JOIN first f USING (customer_id)
)
SELECT cohort,
       COUNT(DISTINCT customer_id) FILTER (WHERE month_n = 0) AS size,
       ROUND(100.0 * COUNT(DISTINCT customer_id) FILTER (WHERE month_n = 1)
             / COUNT(DISTINCT customer_id) FILTER (WHERE month_n = 0), 1) AS m1_pct,
       ROUND(100.0 * COUNT(DISTINCT customer_id) FILTER (WHERE month_n = 3)
             / COUNT(DISTINCT customer_id) FILTER (WHERE month_n = 0), 1) AS m3_pct
FROM activity
WHERE cohort >= '2025-01-01' AND cohort < '2026-01-01'
GROUP BY cohort
ORDER BY cohort;
```

`date_diff('month', a, b)` — сколько месяцев между датами. `FILTER (WHERE …)` — агрегат только по строкам с условием (короче, чем `SUM(CASE WHEN …)`).

> 💡 В портфолио когорты обычно показывают **тепловой картой** (heatmap): строки — когорты, столбцы — месяцы жизни, цвет — доля вернувшихся.

## RFM-анализ

**RFM** делит клиентов на сегменты по трём признакам:

- **R**ecency — давность: сколько дней прошло с последнего заказа;
- **F**requency — частота: сколько заказов;
- **M**onetary — деньги: сколько потратил.

```sql
SELECT customer_id,
       DATE '2026-06-30' - MAX(order_date) AS recency_days,
       COUNT(*)                            AS frequency,
       SUM(amount)                         AS monetary
FROM orders
WHERE status = 'delivered'
GROUP BY customer_id
ORDER BY monetary DESC
LIMIT 10;
```

Дальше клиентов делят на группы (например, по квантилям или простым порогам) и называют сегменты: «лучшие» (недавно, часто, много), «уходящие» (давно не покупали, хотя раньше покупали часто), «новички» и т. д. Каждому сегменту — своё действие: «лучшим» — программа лояльности, «уходящим» — письмо с персональным предложением.

## Где делать анализ

Удобнее всего — **Jupyter Notebook** (бесплатно в Google Colab: colab.research.google.com): код, графики и текст выводов в одном документе, который потом выкладывается на GitHub. SQL-запросы можно выполнять в этом приложении, а данные для Python брать из файлов в папке `public/data`.
