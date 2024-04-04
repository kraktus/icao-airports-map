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

export function groupByOne<T, V>(x: T[], key: (t: T) => V): Map<V, T> {
  const res = new Map<V, T>();
  for (const t of x) {
    const k = key(t);
    if (res.has(k)) {
      throw new Error('groupByOne: key is not unique');
    }
    res.set(k, t);
  }
  return res;
}

export function mergeGroupBy<T, V>(
  y: Map<V, T[]>,
  z: Map<V, T[]>,
): Map<V, T[]> {
  const x = new Map<V, T[]>(y);
  for (const [k, v] of z.entries()) {
    if (x.has(k)) {
      x.set(k, x.get(k)!.concat(v));
    } else {
      x.set(k, v);
    }
  }
  return x;
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

export function mapValues<K, V, W>(x: Map<K, V>, f: (v: V) => W): Map<K, W> {
  const res = new Map<K, W>();
  for (const [k, v] of x.entries()) {
    res.set(k, f(v));
  }
  return res;
}

export function setOf<T>(x: Iterable<T>, y: Iterable<T>): Set<T> {
  const res = new Set<T>();
  for (const z of x) {
    res.add(z);
  }
  for (const z of y) {
    res.add(z);
  }
  return res;
}

export function fold<T>(i: Iterable<T>, f: (a: T, b: T) => T): T {
  return Array.from(i).reduce(f);
}

export function mergeCountBy<T, V>(
  y: Map<V, number>,
  z: Map<V, number>,
): Map<V, number> {
  const x = new Map<V, number>(y);
  for (const [k, v] of z.entries()) {
    if (x.has(k)) {
      x.set(k, x.get(k)! + v);
    } else {
      x.set(k, v);
    }
  }
  return x;
}

export function deepCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function getMostCommon<V>(x: Map<V, number>): V | undefined {
  if (x.size === 0) {
    return undefined;
  }
  return Array.from(x.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}
