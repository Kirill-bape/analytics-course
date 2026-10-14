// Результаты эталонных решений запоминаются, чтобы не пересчитывать их при каждой проверке.

import { runQuery, runSandbox, type QueryResult } from './engine';

const cache = new Map<string, QueryResult>();

export async function expectedResult(key: string, solution: string, sandbox = false): Promise<QueryResult> {
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await (sandbox ? runSandbox(solution) : runQuery(solution));
  cache.set(key, res);
  return res;
}
