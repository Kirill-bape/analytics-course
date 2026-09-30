## Запрос внутри запроса

Иногда для ответа нужно сначала что-то посчитать, а потом использовать результат. Например: «товары дороже **средней** цены». Средняя цена — это отдельный запрос. Его можно вставить прямо внутрь — это **подзапрос**:

```sql
SELECT product_name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;
```

Подзапрос в скобках выполняется первым и возвращает одно число — его и сравнивает `WHERE`.

## Три места для подзапроса

| Где | Что возвращает | Пример |
|---|---|---|
| в `WHERE` со сравнением | одно значение | `price > (SELECT AVG(price) FROM products)` |
| в `WHERE … IN (…)` | список значений | `customer_id IN (SELECT customer_id FROM orders WHERE promo_code = 'BLACKFRIDAY')` |
| в `FROM` | целую таблицу | `FROM (SELECT …) AS t` — дальше работаем с `t` как с таблицей |

```sql
-- Клиенты, которые хоть раз пользовались промокодом BLACKFRIDAY
SELECT full_name, city
FROM customers
WHERE customer_id IN (
    SELECT customer_id FROM orders WHERE promo_code = 'BLACKFRIDAY'
)
LIMIT 10;
```

## CTE: WITH — подзапросы с именами

Когда подзапросов несколько, запрос превращается в «матрёшку» и его трудно читать. **CTE** (Common Table Expression) позволяет вынести шаги наверх и дать им имена:

```sql
WITH monthly AS (
    SELECT CAST(date_trunc('month', order_date) AS DATE) AS month,
           SUM(amount) AS revenue
    FROM orders
    WHERE status = 'delivered'
    GROUP BY month
)
SELECT ROUND(AVG(revenue), 0) AS avg_monthly_revenue,
       MAX(revenue)            AS best_month_revenue
FROM monthly;
```

Читается как рецепт: «шаг 1 — посчитай выручку по месяцам и назови это `monthly`; шаг 2 — посчитай по `monthly` среднее и максимум».

Шагов может быть несколько — через запятую, и каждый следующий может использовать предыдущие:

```sql
WITH first_orders AS (
    -- шаг 1: дата первого заказа каждого клиента
    SELECT customer_id, MIN(order_date) AS first_date
    FROM orders
    GROUP BY customer_id
),
new_by_month AS (
    -- шаг 2: сколько новых покупателей пришло в каждом месяце
    SELECT CAST(date_trunc('month', first_date) AS DATE) AS month,
           COUNT(*) AS new_customers
    FROM first_orders
    GROUP BY month
)
SELECT *
FROM new_by_month
WHERE month >= '2026-01-01'
ORDER BY month;
```

> 💡 CTE — это стиль, который любят в командах аналитиков: запрос из понятных шагов легко проверить и поправить. На собеседовании решение через CTE почти всегда выглядит выигрышно.

## Когда что использовать

- **Одно число для сравнения** — подзапрос в `WHERE`.
- **Список для фильтра** — `IN (подзапрос)`.
- **Многошаговый расчёт** — CTE (`WITH`).

## Шпаргалка

```text
WITH шаг1 AS (
    SELECT ...
),
шаг2 AS (
    SELECT ... FROM шаг1 ...
)
SELECT ... FROM шаг2;
```
