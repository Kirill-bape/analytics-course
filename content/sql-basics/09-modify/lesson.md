## Аналитик тоже создаёт таблицы

До сих пор мы только читали данные. Но в работе аналитику приходится и **создавать** таблицы:

- сохранить промежуточный результат сложного расчёта, чтобы не пересчитывать его каждый раз;
- завести небольшой справочник, которого нет в базе, например план продаж по категориям;
- подготовить очищенную таблицу для дашборда;
- исправить явную ошибку в данных.

Для этого есть команды, которые **меняют** базу: `CREATE`, `INSERT`, `UPDATE`, `DELETE`.

> 🧪 **В этой теме база работает как песочница.** Команды выполняются по-настоящему, но после запуска всё отменяется, и база возвращается к исходному виду. Каждый запуск начинается с чистого листа, поэтому пиши сценарий **целиком**: создать таблицу → заполнить → посмотреть результат через `SELECT`. Команды разделяй точкой с запятой `;` и запускай все вместе. На экране будет результат последней команды.

## CREATE TABLE: новая таблица

При создании таблицы перечисляют её столбцы и **тип** каждого (типы мы разобрали в прошлой теме):

```sql
CREATE TABLE sales_plan (
    category    VARCHAR,
    month       DATE,
    plan_amount DECIMAL(12,2)
);
SELECT * FROM sales_plan;
```

Таблица создана, но пока пустая: `SELECT` вернул только заголовки.

К столбцам можно добавить **ограничения**: правила, которые база будет проверять сама.

| Ограничение | Что значит |
|---|---|
| `PRIMARY KEY` | первичный ключ: значения уникальны и не пустые |
| `NOT NULL` | пустое значение запрещено |
| `DEFAULT значение` | что подставить, если значение не указали |

```sql
CREATE TABLE wishlist (
    id       INTEGER PRIMARY KEY,
    product  VARCHAR NOT NULL,
    price    DECIMAL(10,2),
    added_on DATE DEFAULT '2026-06-30'
);
INSERT INTO wishlist (id, product, price) VALUES (1, 'Наушники', 4990);
SELECT * FROM wishlist;
```

Дату добавления мы не указали, и база подставила значение по умолчанию.

## INSERT: добавляем строки

`INSERT INTO таблица (столбцы) VALUES (значения)`. Одной командой можно добавить сразу несколько строк через запятую:

```sql
CREATE TABLE sales_plan (category VARCHAR, month DATE, plan_amount DECIMAL(12,2));
INSERT INTO sales_plan (category, month, plan_amount) VALUES
    ('Электроника', '2026-07-01', 5000000),
    ('Книги',       '2026-07-01',  300000),
    ('Одежда и обувь', '2026-07-01', 1200000);
SELECT * FROM sales_plan ORDER BY plan_amount DESC;
```

> 💡 Всегда перечисляй столбцы после имени таблицы. Тогда запрос не сломается, если в таблицу добавят новый столбец, и сразу видно, какое значение куда попадает.

Строки можно взять и из другого запроса: `INSERT INTO … SELECT …`. Так удобно переложить в свою таблицу нужную выборку.

## CREATE TABLE … AS SELECT: таблица из запроса

Самый частый у аналитиков способ создать таблицу — сохранить результат запроса. Столбцы и их типы база возьмёт из самого запроса:

```sql
CREATE TABLE electronics AS
SELECT product_id, product_name, brand, price
FROM products
WHERE category = 'Электроника';

SELECT COUNT(*) AS products_cnt, MIN(price) AS min_price
FROM electronics;
```

## UPDATE: меняем значения

`UPDATE таблица SET столбец = новое значение WHERE условие`. Значение можно посчитать из старого:

```sql
-- Скидка 10% на книги
UPDATE products
SET price = ROUND(price * 0.9, 2)
WHERE category = 'Книги';

SELECT product_name, price
FROM products
WHERE category = 'Книги'
ORDER BY price DESC
LIMIT 5;
```

> ⚠️ **Без `WHERE` изменятся ВСЕ строки таблицы.** Это одна из самых дорогих ошибок в работе с базами. Правило: сначала напиши `SELECT … WHERE …` и посмотри, какие строки попадут под условие. Только потом замени `SELECT` на `UPDATE` с **тем же** `WHERE`.

## DELETE: удаляем строки

`DELETE FROM таблица WHERE условие`. Правило то же: без `WHERE` удалится всё.

```sql
DELETE FROM orders
WHERE status = 'cancelled';

SELECT COUNT(*) AS orders_left
FROM orders;
```

## ALTER и DROP: меняем саму таблицу

```sql
-- Добавить столбец и заполнить его
ALTER TABLE products ADD COLUMN margin DECIMAL(12,2);
UPDATE products SET margin = price - cost_price;

SELECT product_name, price, cost_price, margin
FROM products
ORDER BY margin DESC
LIMIT 5;
```

`DROP TABLE имя` удаляет таблицу целиком, вместе с данными. В песочнице это не страшно, а в настоящей базе отменить такое удаление обычно нельзя.

## Ограничения защищают данные

Если команда нарушает ограничение, база её не выполнит. Попробуй добавить второй товар с тем же номером:

```sql
-- ⛔ Этот пример нарочно с ошибкой: запусти и посмотри, что ответит база
CREATE TABLE wishlist (id INTEGER PRIMARY KEY, product VARCHAR NOT NULL);
INSERT INTO wishlist VALUES (1, 'Наушники');
INSERT INTO wishlist VALUES (1, 'Книга');
SELECT * FROM wishlist;
```

Это хорошо: ошибка сразу видна, а не всплывёт через месяц в отчёте с задвоенными строками.

> 💡 В настоящих базах изменения делают внутри **транзакции**: `BEGIN;` → команды → проверка → `COMMIT;` (сохранить) или `ROLLBACK;` (отменить). Наша песочница каждый раз делает именно `ROLLBACK`.

## Шпаргалка

| Задача | Как написать |
|---|---|
| создать таблицу | `CREATE TABLE t (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL)` |
| таблица из запроса | `CREATE TABLE t AS SELECT …` |
| добавить строки | `INSERT INTO t (id, name) VALUES (1, 'a'), (2, 'b')` |
| добавить из запроса | `INSERT INTO t (id, name) SELECT …` |
| изменить | `UPDATE t SET name = 'b' WHERE id = 1` |
| удалить строки | `DELETE FROM t WHERE id = 1` |
| новый столбец | `ALTER TABLE t ADD COLUMN price DECIMAL(10,2)` |
| удалить таблицу | `DROP TABLE t` |
