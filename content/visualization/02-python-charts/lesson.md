## matplotlib — графики в Python

Главная библиотека графиков в Python — **matplotlib**. Её подключают так:

```python
import matplotlib.pyplot as plt

categories = ["Электроника", "Одежда", "Дом и кухня"]
revenue = [68.2, 24.1, 18.7]

plt.barh(categories, revenue)
plt.title("Выручка по категориям, млн ₽")
plt.xlabel("Выручка, млн ₽")
```

Здесь график появится прямо под кодом. В обычном Python в конце пишут `plt.show()`.

## Основные функции

| График | Функция |
|---|---|
| столбцы вертикальные / горизонтальные | `plt.bar(x, y)` / `plt.barh(y, x)` |
| линия | `plt.plot(x, y)` |
| гистограмма | `plt.hist(values, bins=30)` |
| точки | `plt.scatter(x, y)` |

И оформление:

| Что | Функция |
|---|---|
| заголовок | `plt.title("…")` |
| подписи осей | `plt.xlabel("…")`, `plt.ylabel("…")` |
| размер | `plt.figure(figsize=(8, 4))` — в самом начале |
| сетка | `plt.grid(alpha=0.3)` |
| повернуть подписи | `plt.xticks(rotation=45)` |

## Линейный график из pandas

Данные обычно готовят в pandas, а рисуют — одной-двумя строками:

```python
import matplotlib.pyplot as plt

d = orders[orders["status"] == "delivered"]
monthly = d.groupby(d["order_date"].dt.to_period("M"))["amount"].sum() / 1_000_000

plt.figure(figsize=(9, 4))
plt.plot(monthly.index.astype(str), monthly.values, marker="o")
plt.title("Выручка по месяцам, млн ₽")
plt.xlabel("Месяц")
plt.ylabel("Выручка, млн ₽")
plt.xticks(rotation=45)
plt.grid(alpha=0.3)
```

У pandas есть и короткий путь — метод `.plot()`: `monthly.plot(kind="line")`, `series.plot(kind="barh")`. Он вызывает тот же matplotlib.

## Гистограмма

```python
import matplotlib.pyplot as plt

amounts = orders.loc[(orders["status"] == "delivered") & (orders["amount"] < 50000), "amount"]
plt.hist(amounts, bins=40)
plt.title("Распределение сумм заказов (до 50 000 ₽)")
plt.xlabel("Сумма заказа, ₽")
plt.ylabel("Число заказов")
```

Хорошо видна форма «скошено вправо» из модуля статистики.

## Точечная диаграмма

```python
import matplotlib.pyplot as plt

line3 = production[production["line_id"] == 3]
plt.scatter(line3["downtime_min"], line3["produced_units"], alpha=0.4, s=12)
plt.title("Линия Б1: чем больше простой, тем меньше выпуск")
plt.xlabel("Простой за смену, мин")
plt.ylabel("Выпуск за смену, шт.")
```

`alpha` делает точки полупрозрачными — там, где их много, цвет гуще.

## Как сдавать задания с графиками

Приложение проверяет, что график **построен**, что у него **нужный тип** и есть **заголовок и подписи осей**, если их просят в задании.

## Шпаргалка

```text
import matplotlib.pyplot as plt
plt.figure(figsize=(8, 4))
plt.bar / plt.barh / plt.plot / plt.hist / plt.scatter
plt.title("…"); plt.xlabel("…"); plt.ylabel("…")
```
