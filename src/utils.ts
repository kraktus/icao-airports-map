export function groupBy<T, V>(x: T[], key: (t: T) => V): Map<V, T[]> {
  const res = new Map<V, T[]>();
  for (const t of x) {
    const k = key(t);
    if (res.has(k)) {
      res.get(k)!.push(t);
    } else {
      res.set(k, [t]);
    }
  }
  return res;
}

export function countBy<T, V>(x: T[], count: (t: T) => V): Map<V, number> {
  const res = new Map<V, number>();
  for (const t of x) {
    const v = count(t);
    if (res.has(v)) {
      res.set(v, res.get(v)! + 1);
    } else {
      res.set(v, 1);
    }
  }
  return res;
}

export function getMostCommon<V>(x: Map<V, number>): V | undefined {
  if (x.size === 0) {
    return undefined;
  }
  return Array.from(x.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}
