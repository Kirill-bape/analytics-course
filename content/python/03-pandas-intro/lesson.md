## pandas — Excel внутри Python

**pandas** — главная библиотека аналитика. Её основной объект — **DataFrame** (датафрейм): таблица со строками и именованными столбцами, как лист Excel или таблица в базе. Один столбец DataFrame называется **Series**.

Обычно работа начинается так:

```python
import pandas as pd

orders = pd.read_csv("orders.csv", parse_dates=["order_date", "delivery_date"])
orders.head()
```

- `import pandas as pd` — подключаем библиотеку под коротким именем `pd` (так принято везде);
- `pd.read_csv(...)` — читаем CSV-файл в DataFrame; `parse_dates` сразу превращает текстовые даты в настоящие;
- `.head()` — первые 5 строк (`.head(10)` — первые 10).

> 💡 В этом приложении все учебные таблицы **уже загружены** в переменные с такими же именами: `orders`, `customers`, `products`, `order_items`, `production`, `operators`, `production_lines`, `ab_users`. А `pd` и `np` (numpy) уже импортированы. Файлы `orders.csv` и другие тоже доступны — можно тренироваться с `read_csv`.

## Первый взгляд на таблицу

```python
print(orders.shape)       # (строк, столбцов)
print(orders.columns)     # названия столбцов
print(orders.dtypes)      # типы данных столбцов
```

```python
orders.describe()
```

`describe()` за одну команду показывает по числовым столбцам количество, среднее, стандартное отклонение, минимум, квартили и максимум — всё, что мы считали в модуле статистики.

## Выбор столбцов

| Код | Что вернёт |
|---|---|
| `orders["amount"]` | один столбец — **Series** |
| `orders[["order_id", "amount"]]` | несколько столбцов — **DataFrame** (обрати внимание на двойные скобки) |

```python
products[["product_name", "category", "price"]].head(3)
```

## Быстрые расчёты по столбцу

У Series есть те же функции, что в SQL и Excel:

```python
print(orders["amount"].sum())
print(orders["amount"].mean())
print(orders["amount"].median())
print(orders["customer_id"].nunique())   # число уникальных значений
```

## value_counts — частоты значений

Самая частая команда для категорий: сколько раз встречается каждое значение (как `GROUP BY` + `COUNT` одной строкой):

```python
orders["status"].value_counts()
```

С `normalize=True` получатся доли вместо количеств.

## Шпаргалка

| Задача | pandas | SQL |
|---|---|---|
| первые строки | `df.head(10)` | `LIMIT 10` |
| размер | `df.shape` | `COUNT(*)` |
| столбцы | `df[["a", "b"]]` | `SELECT a, b` |
| сумма / среднее | `df["x"].sum()`, `.mean()` | `SUM`, `AVG` |
| уникальных | `df["x"].nunique()` | `COUNT(DISTINCT x)` |
| частоты | `df["x"].value_counts()` | `GROUP BY x` + `COUNT(*)` |
