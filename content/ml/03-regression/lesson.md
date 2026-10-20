## Линейная регрессия

**Линейная регрессия** предсказывает число как взвешенную сумму признаков:

`прогноз = w₀ + w₁·x₁ + w₂·x₂ + …`

- `w₀` — свободный член (сдвиг), `w₁, w₂…` — **коэффициенты** (веса);
- обучение — подбор весов, при которых сумма квадратов ошибок минимальна (**метод наименьших квадратов**).

Главный плюс линейной модели — **интерпретируемость**: коэффициент показывает, на сколько изменится прогноз при росте признака на единицу, если остальные признаки не меняются.

## Один признак: np.polyfit

Насколько простой линии снижает выпуск? Возьмём линию 1, где план почти всегда одинаковый:

```python
p = production.dropna(subset=["downtime_min"])
line1 = p[p["line_id"] == 1]

slope, intercept = np.polyfit(line1["downtime_min"], line1["produced_units"], 1)
print(f"выпуск ≈ {intercept:.1f} {slope:+.3f} × минуты простоя")
```

> ⚠️ В `downtime_min` есть пропуски. numpy не умеет обучаться на `NaN` — их нужно убрать (`dropna`) или заполнить заранее.

## Несколько признаков: np.linalg.lstsq

Для нескольких признаков строят **матрицу признаков** `X`: строка — объект, столбец — признак, плюс столбец из единиц для свободного члена. `np.linalg.lstsq` находит веса методом наименьших квадратов:

```python
p = production.dropna(subset=["downtime_min"])
X = np.column_stack([np.ones(len(p)), p["planned_units"], p["downtime_min"]])
y = p["produced_units"].to_numpy()

w, *_ = np.linalg.lstsq(X, y, rcond=None)
print("веса:", np.round(w, 3))

pred = X @ w                     # прогноз для каждой смены
print("первые прогнозы:", np.round(pred[:5]), "факт:", y[:5])
```

`X @ w` — матричное умножение: для каждой строки считается `w₀·1 + w₁·план + w₂·простой`.

## Метрики регрессии

| Метрика | Формула | Смысл |
|---|---|---|
| **MAE** | среднее `|факт − прогноз|` | средняя ошибка в единицах цели |
| **RMSE** | корень из среднего квадрата ошибки | сильнее штрафует большие промахи |
| **MAPE** | среднее `|ошибка| / факт` | средняя ошибка в процентах |
| **R²** | `1 − SS_ост / SS_общ` | какую долю разброса объяснила модель: 1 — идеально, 0 — не лучше среднего |

```python
p = production.dropna(subset=["downtime_min"])
y = p["produced_units"].to_numpy()
pred_mean = np.full(len(y), y.mean())        # baseline: всегда среднее
print("MAE baseline:", round(np.abs(y - pred_mean).mean(), 1))
```

## Логистическая регрессия

Для классификации нужна не любая сумма, а **вероятность** от 0 до 1. Логистическая регрессия считает ту же взвешенную сумму `z = w₀ + w₁x₁ + …` и пропускает её через **сигмоиду**:

`p = 1 / (1 + e^(−z))`

- `z = 0` → `p = 0,5`; большие положительные `z` → почти 1; большие отрицательные → почти 0;
- класс получают сравнением с **порогом**: `p ≥ 0,5` → «вернётся». Порог можно двигать — об этом урок про метрики.

```python
z = np.array([-4, -1, 0, 1, 4])
print(np.round(1 / (1 + np.exp(-z)), 3))
```

### Градиентный спуск

Готовой формулы для весов логистической регрессии нет, поэтому их ищут **градиентным спуском**: начинают с нулей и много раз сдвигают веса в сторону уменьшения ошибки (**log-loss**):

1. посчитать вероятности `p` для всех объектов;
2. посчитать градиент: `Xᵀ · (p − y) / n`;
3. сдвинуть веса: `w = w − скорость_обучения × градиент`.

```python
cut = pd.Timestamp("2026-04-01")
hist = orders[orders["order_date"] < cut]
df = hist.groupby("customer_id").agg(frequency=("order_id", "count"), last=("order_date", "max"))
df["recency"] = (cut - df["last"]).dt.days
df["returned"] = df.index.isin(orders.loc[orders["order_date"] >= cut, "customer_id"]).astype(int)

feats = df[["recency", "frequency"]]
Xs = ((feats - feats.mean()) / feats.std()).to_numpy()     # стандартизация обязательна
X = np.column_stack([np.ones(len(Xs)), Xs])
y = df["returned"].to_numpy()

w = np.zeros(3)
for step in range(2000):
    p = 1 / (1 + np.exp(-X @ w))
    w -= 0.1 * X.T @ (p - y) / len(y)

print("веса:", np.round(w, 2))
print("accuracy:", round(((X @ w > 0).astype(int) == y).mean(), 3))
```

Знаки весов читаются сразу: чем больше `recency` (давно не покупал), тем ниже вероятность возврата; чем больше `frequency`, тем выше. Признаки стандартизированы, поэтому веса можно сравнивать между собой: давность влияет сильнее.

## В scikit-learn

```py
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import mean_absolute_error, r2_score

reg = LinearRegression().fit(X_train, y_train)
print(reg.intercept_, reg.coef_, r2_score(y_test, reg.predict(X_test)))

clf = LogisticRegression().fit(X_train, y_train)
proba = clf.predict_proba(X_test)[:, 1]      # вероятности класса 1
```

## Шпаргалка

| Задача | Код |
|---|---|
| прямая по одному признаку | `np.polyfit(x, y, 1)` |
| веса по нескольким признакам | `np.linalg.lstsq(X, y, rcond=None)` |
| столбец единиц | `np.column_stack([np.ones(n), ...])` |
| прогноз | `X @ w` |
| R² | `1 - ((y - pred)**2).sum() / ((y - y.mean())**2).sum()` |
| сигмоида | `1 / (1 + np.exp(-z))` |
| шаг градиентного спуска | `w -= lr * X.T @ (p - y) / n` |
