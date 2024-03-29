import { ALL } from './unparsed';
import Papa from 'papaparse';
import { colors } from './colors';

export type Ident = string;
export type Iso2 = string;

// airport type
export interface Airport {
  // id: number;
  //ident: Ident;
  // type: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  // elevation_ft: number | string;
  // continent: string;
  iso_country: Iso2;
  // iso_region: string;
  // municipality: string;
  // scheduled_service: string;
  gps_code: string;
  // iata_code: string;
  // local_code: string;
  // home_link: string;
  // wikipedia_link: string;
  // keywords: string;
}

const filtermap = <T, U>(arr: T[], f: (t: T) => U | undefined): U[] => {
  const res = [];
  for (const t of arr) {
    const u = f(t);
    if (u !== undefined) {
      res.push(u);
    }
  }
  return res;
};

const toAirportMap = (airports: Airport[]) => {
  const res = new Map<Ident, Airport>();
  for (const airport of airports) {
    res.set(airport.gps_code, airport);
  }
  return res;
};

const addToMap = (
  acc: Map<string, Ident[]>,
  airport: Airport,
  prefixLength: number,
) => {
  const prefix = airport.gps_code.slice(0, prefixLength);
  if (acc.has(prefix)) {
    acc.get(prefix)!.push(airport.gps_code);
  } else {
    acc.set(prefix, [airport.gps_code]);
  }
};

// for each airport code ABCD,
// it will be included in A: ABCD, AB: ABCD, and ABC: ABCD
const indexByPrefix = (airports: Airport[]): Map<string, Ident[]> => {
  const res = new Map<string, Ident[]>();
  for (const airport of airports) {
    for (const prefixLength of [1, 2, 3]) {
      addToMap(res, airport, prefixLength);
    }
  }
  return res;
};

export class Airports {
  private map: Map<Ident, Airport>;
  private byPrefix: Map<string, Ident[]>;
  constructor(airports: Airport[]) {
    this.map = toAirportMap(airports);
    this.byPrefix = indexByPrefix(airports);
  }
  get(ident: Ident): Airport | undefined {
    return this.map.get(ident);
  }
  iterator(): IterableIterator<Airport> {
    return this.map.values();
  }
  all(): Airport[] {
    return Array.from(this.map.values());
  }
  byIdent(ident: Ident): Airport {
    const res = this.get(ident);
    if (res === undefined) {
      throw new Error(`no airport with ident ${ident}`);
    }
    return res;
  }
  getByPrefix(prefix: string): Airport[] {
    return this.byPrefix.get(prefix)!.map(ident => this.byIdent(ident));
  }

  listPrefix(length: number): string[] {
    return filtermap(Array.from(this.byPrefix.keys()), (prefix: string) => {
      if (prefix.length === length) {
        return prefix;
      }
    });
  }
  prefixColor(prefix: string, length: number): string {
    if (prefix.length !== length) {
      throw new Error(`prefix ${prefix} has length ${prefix.length}`);
    }
    return colors[this.listPrefix(length).indexOf(prefix) % colors.length];
  }

  getAllPrefixes(length: number): Airport[][] {
    return filtermap(
      Array.from(this.byPrefix.entries()),
      ([prefix, idents]: [string, Ident[]]) => {
        if (prefix.length === length) {
          return idents.map(ident => this.byIdent(ident));
        }
      },
    );
  }
  prefixesByCountry(length: number): Map<Iso2, Map<string, number>> {
    const res = new Map<Iso2, Map<string, number>>();
    for (const [prefix, idents] of this.byPrefix.entries()) {
      if (prefix.length === length) {
        for (const ident of idents) {
          const airport = this.get(ident)!;
          if (!res.has(airport.iso_country)) {
            res.set(airport.iso_country, new Map<string, number>());
          }
          const m = res.get(airport.iso_country)!;
          if (m.has(prefix)) {
            m.set(prefix, m.get(prefix)! + 1);
          } else {
            m.set(prefix, 1);
          }
        }
      }
    }
    return res;
  }
}

export const airports = new Airports(
  Papa.parse(ALL, { header: true }).data as Airport[],
);
