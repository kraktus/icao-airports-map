import { ALL } from './unparsed';
import Papa from 'papaparse';
import hull from 'hull.js';

export type Ident = string;

// airport type
export interface Airport {
  // id: number;
  ident: Ident;
  // type: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  // elevation_ft: number | string;
  // continent: string;
  // iso_country: string;
  // iso_region: string;
  // municipality: string;
  // scheduled_service: string;
  // gps_code: string;
  // iata_code: string;
  // local_code: string;
  // home_link: string;
  // wikipedia_link: string;
  // keywords: string;
}

const filtermap = <T, U>(arr: T[], f: (t: T) => U | undefined): U[] => {
  const res = [];
  for (const t of arr) {
    console.log('filtermap', t);
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
    res.set(airport.ident, airport);
  }
  return res;
};

// TODO: check if http://andriiheonia.github.io/hull/#ex5 is necessary
//
// > All calculations in hull.js based on the cartesian coordinate system.
// If you use it for the calculation and data visualization on the global map
// please don't forget that globe has the shape of geoid, latitude and longitude
// are angles (not points with X and Y), and after projection we have some
// map distortion
const hullOf = (ard: Airport[]) => {
  const points = ard.map(airport => [
    airport.latitude_deg,
    airport.longitude_deg,
  ]);
  const hullPoints = hull(points);
  return hullPoints;
};

const addToMap = (
  acc: Map<string, Ident[]>,
  airport: Airport,
  prefixLength: number,
) => {
  const prefix = airport.ident.slice(0, prefixLength);
  if (acc.has(prefix)) {
    acc.get(prefix)!.push(airport.ident);
  } else {
    acc.set(prefix, [airport.ident]);
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
  console.log('indexByPrefix', res);
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
  allOneLetterPrefixes(): Airport[][] {
    return filtermap(
      this.byPrefix.entries(),
      ([prefix, idents]: [string, Ident[]]) => {
        console.log('in', prefix, idents);
        if (prefix.length === 1) {
          return idents.map(ident => this.byIdent(ident));
        }
      },
    );
  }
}

export const airports = new Airports(
  Papa.parse(ALL, { header: true }).data as Airport[],
);
