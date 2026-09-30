## Оконные функции: считаем, не схлопывая строки

`GROUP BY` превращает группу в одну строку. А что если нужно **сохранить все строки** и рядом с каждой показать что-то о её группе — например, место товара в рейтинге своей категории? Для этого есть **оконные функции**. Это самая «продвинутая» тема SQL для джуниора и почти обязательный вопрос на собеседовании.

Узнать оконную функцию легко — у неё есть слово `OVER`:

```sql
SELECT category, product_name, price,
       ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
FROM products
ORDER BY category, rn
LIMIT 12;
```

Разберём `OVER (...)` — это описание «окна»:

- `PARTITION BY category` — разбить строки на группы по категории (как `GROUP BY`, но строки не схлопываются);
- `ORDER BY price DESC` — внутри каждой группы упорядочить по цене;
- `ROW_NUMBER()` — пронумеровать строки внутри группы: 1, 2, 3…

Без `PARTITION BY` окно — вся таблица целиком.

## Три функции ранжирования

Разница видна, когда есть одинаковые значения:

| Цена | `ROW_NUMBER()` | `RANK()` | `DENSE_RANK()` |
|---|---|---|---|
| 5000 | 1 | 1 | 1 |
| 4000 | 2 | 2 | 2 |
| 4000 | 3 | 2 | 2 |
| 3000 | 4 | **4** | **3** |

- `ROW_NUMBER` — всегда разные номера (при равенстве — в произвольном порядке, поэтому добавляй в `ORDER BY` второй столбец);
- `RANK` — одинаковым значениям одинаковое место, следующее место «перепрыгивает» (как в спорте);
- `DENSE_RANK` — одинаковое место, но без пропусков.

## Топ-N в каждой группе

Классическая задача: «самый дорогой товар в каждой категории», «три лучших клиента в каждом городе». Оконную функцию нельзя написать прямо в `WHERE` — она считается позже. Поэтому сначала нумеруем в подзапросе или CTE, а потом фильтруем:

```sql
WITH ranked AS (
    SELECT category, product_name, price,
           ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC, product_name) AS rn
    FROM products
)
SELECT category, product_name, price
FROM ranked
WHERE rn = 1
ORDER BY category;
```

> 💡 В DuckDB (и некоторых других базах) есть короткая запись `QUALIFY rn = 1` — фильтр по оконной функции без подзапроса. В PostgreSQL её нет, поэтому надёжнее знать способ через CTE.

## Первая покупка каждого клиента

`ROW_NUMBER` помогает найти первую (или последнюю) запись для каждого объекта:

```sql
WITH numbered AS (
    SELECT customer_id, order_id, order_date, amount,
           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS n
    FROM orders
)
SELECT customer_id, order_id, order_date, amount
FROM numbered
WHERE n = 1
ORDER BY customer_id
LIMIT 10;
```

## Порядок выполнения

Оконные функции считаются **после** `WHERE`, `GROUP BY` и `HAVING`, но **до** `ORDER BY` и `LIMIT`. Поэтому их можно применять к уже сгруппированным данным:

```sql
-- Место каждого города по выручке
SELECT c.city,
       SUM(o.amount) AS revenue,
       RANK() OVER (ORDER BY SUM(o.amount) DESC) AS place
FROM orders o
JOIN customers c USING (customer_id)
WHERE o.status = 'delivered' AND c.city IS NOT NULL
GROUP BY c.city
ORDER BY place
LIMIT 10;
```

## Шпаргалка

```text
ФУНКЦИЯ() OVER (PARTITION BY группа ORDER BY порядок)
```

| Задача | Как |
|---|---|
| нумерация в группе | `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …)` |
| место с учётом равенства | `RANK()` / `DENSE_RANK()` |
| топ-N в каждой группе | нумерация в CTE, потом `WHERE rn <= N` |
