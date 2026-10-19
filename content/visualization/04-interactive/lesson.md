## Когда matplotlib мало

matplotlib умеет всё, но многое в нём делается вручную. Поверх него есть две популярные библиотеки:

- **seaborn** — статистические графики в одну строку: распределения по группам, ящики с усами, тепловые карты, графики с доверительными интервалами;
- **Plotly** — **интерактивные** графики: при наведении всплывают значения, можно приближать, скрывать серии и сохранить график как веб-страницу.

> 🧪 В приложении нет seaborn и Plotly, поэтому их код показан серым блоком для чтения. Рядом — как сделать то же самое в matplotlib: этот код можно запускать. В Jupyter или Colab оба варианта работают одинаково.

## seaborn: одна строка на график

seaborn работает с «длинными» таблицами: ты говоришь, какой столбец на ось X, какой на Y и каким разбить по цвету (`hue`).

```py
import seaborn as sns

sns.histplot(data=orders, x="amount", hue="payment_method", bins=50)       # распределения по группам
sns.boxplot(data=orders, x="status", y="amount")                           # ящики с усами
sns.barplot(data=orders, x="payment_method", y="amount")                   # среднее + доверительный интервал
sns.heatmap(production[cols].corr(), annot=True, cmap="RdBu_r", center=0)   # тепловая карта корреляций
sns.scatterplot(data=products, x="price", y="rating", hue="category")
```

Главные плюсы: аккуратный стиль по умолчанию, автоматические легенды и статистика (среднее с доверительным интервалом в `barplot`).

## Ящик с усами (boxplot)

**Ящик с усами** — компактный способ сравнить распределения нескольких групп:

- линия в ящике — медиана;
- ящик — от 25-го до 75-го процентиля (половина данных);
- усы — до самых дальних значений в пределах 1,5 × IQR;
- точки за усами — выбросы.

В matplotlib его строят так:

```python
import matplotlib.pyplot as plt

lines = [1, 2, 3, 4]
data = [production.loc[production["line_id"] == i, "produced_units"] for i in lines]
plt.boxplot(data, tick_labels=[f"Линия {i}" for i in lines])
plt.title("Выпуск за смену на линиях сборки")
plt.ylabel("Изделий за смену")
plt.show()
```

## Тепловая карта

**Тепловая карта** показывает таблицу цветом: удобно для матрицы корреляций или для «день недели × месяц». Сначала данные готовят сводной таблицей, потом рисуют:

```python
import matplotlib.pyplot as plt

d = orders.assign(weekday=orders["order_date"].dt.dayofweek,
                  month=orders["order_date"].dt.month)
table = d.pivot_table(index="weekday", columns="month", values="order_id", aggfunc="count")

plt.imshow(table, cmap="Blues", aspect="auto")
plt.colorbar(label="Заказов")
plt.yticks(range(7), ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"])
plt.xticks(range(12), table.columns)
plt.xlabel("Месяц")
plt.title("Заказы по дням недели и месяцам")
plt.show()
```

## Несколько графиков рядом: subplots

Когда нужно сравнить одно и то же в разных группах, лучше несколько маленьких графиков с одинаковыми осями, чем один перегруженный. Это приём **small multiples**:

```python
import matplotlib.pyplot as plt

daily = production.groupby(["prod_date", "line_id"])["produced_units"].sum().unstack()
fig, axes = plt.subplots(2, 3, figsize=(12, 6), sharey=True)
for ax, line in zip(axes.flat, daily.columns):
    ax.plot(daily.index, daily[line].rolling(7).mean())
    ax.set_title(f"Линия {line}")
    ax.tick_params(axis="x", labelrotation=45)
fig.suptitle("Выпуск по линиям, скользящее среднее за 7 дней")
plt.tight_layout()
plt.show()
```

`sharey=True` делает общую шкалу Y — так графики честно сравнимы между собой. В seaborn то же делается параметром `col=` у `relplot` и `catplot`.

## Plotly: интерактивность

```py
import plotly.express as px

fig = px.line(monthly, x="month", y="revenue", color="city",
              title="Выручка по городам", markers=True)
fig.show()                        # в Jupyter — интерактивный график
fig.write_html("revenue.html")    # отдельная страница, откроется в любом браузере
```

`plotly.express` устроен как seaborn: таблица + имена столбцов. Основные функции: `px.line`, `px.bar`, `px.scatter`, `px.histogram`, `px.box`, `px.imshow`, карты `px.choropleth`.

Когда Plotly особенно полезен:

- **разведка данных**: навёл мышь на странную точку — сразу видишь, что это за заказ;
- **отчёт для руководителя без BI**: HTML-файл с интерактивными графиками открывается в браузере;
- **много серий**: щелчком по легенде скрываешь лишние.

Когда не нужен: в статичной презентации и PDF интерактивность пропадает, и обычный аккуратный график читается лучше.

## Что выбрать

| Задача | Инструмент |
|---|---|
| быстро посмотреть распределения и связи при анализе | seaborn |
| полный контроль над каждым элементом, график для публикации | matplotlib |
| интерактивный график или HTML-отчёт | Plotly |
| регулярный отчёт для многих людей | BI-система (модуль про дашборды) |

## Шпаргалка

| Задача | matplotlib | seaborn |
|---|---|---|
| распределение | `plt.hist(x)` | `sns.histplot(data=df, x=…)` |
| сравнение распределений | `plt.boxplot([a, b])` | `sns.boxplot(data=df, x=…, y=…)` |
| тепловая карта | `plt.imshow(table)` + `plt.colorbar()` | `sns.heatmap(table, annot=True)` |
| несколько графиков | `plt.subplots(rows, cols)` | `sns.relplot(…, col=…)` |
| разбить по группам цветом | цикл по группам | `hue="столбец"` |
| интерактивный график | — | Plotly: `px.line(df, x=…, y=…)` |
