## Что такое NULL

В реальных данных всегда бывают пропуски: клиент не указал дату рождения, у товара ещё нет отзывов, заказ ещё не доставлен. В SQL такое пустое значение называется **`NULL`** — «неизвестно», «нет данных».

`NULL` — это **не ноль** и **не пустая строка**. Это отдельное особое значение. В нашей базе:

| Столбец | Что значит NULL |
|---|---|
| `customers.birth_date` | клиент не указал дату рождения |
| `customers.city` | город не указан |
| `products.rating` | у товара ещё нет отзывов |
| `orders.promo_code` | заказ сделан без промокода |
| `orders.delivery_date` | заказ отменён или ещё не доставлен |

В результате запроса такие ячейки показаны серым словом *NULL*.

## Почему = NULL не работает

Попробуй найти клиентов без города «очевидным» способом:

```sql
SELECT full_name, city
FROM customers
WHERE city = NULL;
```

Ноль строк, хотя такие клиенты есть! Дело в том, что сравнение с «неизвестно» даёт «неизвестно». Равен ли неизвестный город неизвестному городу? Неизвестно. А `WHERE` пропускает только строки, где условие **точно верно**.

Для проверки на пустоту есть специальные операторы — `IS NULL` и `IS NOT NULL`:

```sql
SELECT full_name, city
FROM customers
WHERE city IS NULL;
```

```sql
-- Товары, у которых уже есть рейтинг
SELECT product_name, rating
FROM products
WHERE rating IS NOT NULL
LIMIT 10;
```

## Ловушка: NULL и «не равно»

Нужны заказы, где **не** использовался промокод `BLACKFRIDAY`. Кажется, что достаточно `<>`:

```sql
SELECT order_id, promo_code
FROM orders
WHERE promo_code <> 'BLACKFRIDAY'
LIMIT 10;
```

Посмотри на результат: в нём **только заказы с другими промокодами**. Заказы вообще без промокода (`NULL`) пропали — ведь «NULL не равно BLACKFRIDAY» тоже даёт «неизвестно».

Правильно — явно добавить пустые значения:

```sql
SELECT order_id, promo_code
FROM orders
WHERE promo_code <> 'BLACKFRIDAY' OR promo_code IS NULL
LIMIT 10;
```

> ⚠️ Это одна из самых частых ошибок аналитиков — и любимый вопрос на собеседованиях. Когда пишешь `<>`, `NOT IN` или `NOT LIKE`, всегда спрашивай себя: «А что будет с пустыми значениями?»

## NULL в вычислениях

Любая арифметика с `NULL` даёт `NULL`: `5 + NULL = NULL`. Логично: пять плюс неизвестно сколько — неизвестно сколько.

```sql
SELECT product_name, rating, rating + 1 AS rating_plus_one
FROM products
WHERE rating IS NULL
LIMIT 5;
```

## Замена пустых значений: COALESCE

`COALESCE(a, b, ...)` возвращает **первое непустое** значение из списка. Обычно так пустоту заменяют на что-то понятное:

```sql
SELECT order_id,
       COALESCE(promo_code, 'без промокода') AS promo
FROM orders
LIMIT 10;
```

```sql
SELECT product_name, COALESCE(rating, 0) AS rating_or_zero
FROM products
WHERE category = 'Спорт и отдых';
```

> 💡 Заменять `NULL` нулём нужно осознанно: рейтинг 0 и «нет отзывов» — разные вещи. Для отчёта это бывает удобно, а для расчёта среднего рейтинга — нет.

## Шпаргалка

| Задача | Как написать |
|---|---|
| значение пустое | `WHERE city IS NULL` |
| значение заполнено | `WHERE city IS NOT NULL` |
| «не равно» с учётом пустых | `WHERE x <> 'A' OR x IS NULL` |
| заменить пустоту | `COALESCE(rating, 0)` |
