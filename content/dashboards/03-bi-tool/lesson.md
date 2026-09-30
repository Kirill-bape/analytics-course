## BI-инструменты

Дашборды в компаниях собирают в **BI-системах** (Business Intelligence). Они подключаются к базе данных, строят графики без программирования, обновляются сами и дают доступ коллегам по ссылке.

| Инструмент | Цена | Где популярен |
|---|---|---|
| **Yandex DataLens** | бесплатный | российские компании, работает в браузере |
| **Looker Studio** (Google) | бесплатный | малый бизнес, маркетинг |
| **Power BI Desktop** | бесплатный для компьютера на Windows | крупные компании |
| **Apache Superset** | бесплатный, open source | IT-компании, ставится на свой сервер |
| **Tableau, FineBI** | платные | крупный бизнес |

Логика у всех одна: **источник данных → датасет (таблица с полями и формулами) → графики (чарты) → дашборд из графиков + фильтры**. Освоил один — переключиться на другой можно за пару дней. В вакансиях чаще всего встречаются DataLens, Power BI и Superset.

## Каждый график дашборда — это SQL-запрос

За каждым виджетом стоит запрос с группировкой. Ниже — три типичных виджета дашборда продаж. Запусти их: так выглядят данные, из которых BI-инструмент рисует графики.

**KPI-карточка с изменением к прошлому месяцу:**

```sql
WITH m AS (
    SELECT CAST(date_trunc('month', order_date) AS DATE) AS month, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'delivered'
    GROUP BY month
)
SELECT month, revenue,
       ROUND(100.0 * (revenue / LAG(revenue) OVER (ORDER BY month) - 1), 1) AS change_pct
FROM m
ORDER BY month DESC
LIMIT 1;
```

**Динамика по неделям:**

```sql
-- chart: line
SELECT CAST(date_trunc('week', order_date) AS DATE) AS week, SUM(amount) AS revenue
FROM orders
WHERE status = 'delivered' AND order_date >= '2026-01-01'
GROUP BY week
ORDER BY week;
```

**Разрез по городам:**

```sql
-- chart: bar
SELECT c.city, SUM(o.amount) AS revenue
FROM orders o
JOIN customers c USING (customer_id)
WHERE o.status = 'delivered' AND o.order_date >= '2026-01-01' AND c.city IS NOT NULL
GROUP BY c.city
ORDER BY revenue DESC
LIMIT 8;
```

## Практика в настоящем BI-инструменте

Самое полезное для портфолио — собрать дашборд в настоящем инструменте и вставить ссылку или скриншот в резюме. Рекомендую **Yandex DataLens**: он бесплатный, работает в браузере и часто встречается в вакансиях.

Учебные данные лежат в папке приложения: `public/data/shop/` — файлы `orders.csv`, `customers.csv`, `products.csv`, `order_items.csv`.

Общий порядок (названия кнопок могут немного отличаться — интерфейсы обновляются):

1. Зайди на datalens.yandex.ru и войди с Яндекс ID (регистрация бесплатная, аккаунт создаёшь сам).
2. Создай **подключение** → «Загрузка файлов» → загрузи `orders.csv` и `customers.csv`.
3. Создай **датасет** из этих файлов, свяжи таблицы по `customer_id`. Добавь вычисляемое поле «Выручка»: сумма `amount`, где статус = `delivered`.
4. Создай **чарты**: KPI-индикаторы (выручка, заказы, средний чек), линию по неделям, столбцы по городам.
5. Собери **дашборд**: чарты по раскладке из прошлого урока, сверху — селектор периода и города.
6. Сделай скриншот или публичную ссылку — это пойдёт в портфолио.

> 💡 Если что-то не получается в интерфейсе — спроси меня в Claude: опиши, что видишь на экране, разберём по шагам.
