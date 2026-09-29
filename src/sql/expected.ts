// Результаты эталонных решений запоминаются, чтобы не пересчитывать их при каждой проверке.

import { runQuery, type QueryResult } from './engine';

const cache = new Map<string, QueryResult>();

export async function expectedResult(key: string, solution: string): Promise<QueryResult> {
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await runQuery(solution);
  cache.set(key, res);
  return res;
}
