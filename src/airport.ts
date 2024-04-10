import { ALL } from './unparsed';
import Papa from 'papaparse';
import { colors } from './colors';
import { filtermap } from './utils';
import * as L from 'leaflet'; // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/leaflet/index.d.ts

export type Oaci = string;
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
  gps_code: Oaci;
  // iata_code: string;
  // local_code: string;
  // home_link: string;
  // wikipedia_link: string;
  // keywords: string;
}

export const toCircle = (
  airport: Airport,
  color: string,
  fillOpacity: number = 0.6,
): L.Circle => {
  const circle = L.circle([airport.latitude_deg, airport.longitude_deg], {
    color: color,
    fillColor: color,
    fillOpacity: fillOpacity,
    radius: 1000,
  });
  circle.bindPopup(`${airport.name}: ${airport.gps_code}`);
  return circle;
};

export const toCircleMarker = (
  airport: Airport,
  color: string,
  fillOpacity: number = 0.6,
): L.CircleMarker => {
  const circleMarker = L.circleMarker(
    [airport.latitude_deg, airport.longitude_deg],
    {
      color: color,
      fillColor: color,
      fillOpacity: fillOpacity,
      radius: 2,
    },
  );
  circleMarker.bindPopup(`${airport.name}: ${airport.gps_code}`);
  return circleMarker;
};

export const toMarker = (airport: Airport): L.Marker => {
  const icon = isHeliport(airport) ? heliportIcon : L.Icon.Default;
  const marker = L.marker([airport.latitude_deg, airport.longitude_deg], {
    // @ts-ignore see if it works like that
    icon: icon,
  });
  marker.bindPopup(`${airport.name}: ${airport.gps_code}`);
  return marker;
};

const toAirportMap = (airports: Airport[]) => {
  const res = new Map<Oaci, Airport>();
  for (const airport of airports) {
    res.set(airport.gps_code, airport);
  }
  return res;
};

const addToMap = (
  acc: Map<string, Oaci[]>,
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
const indexByPrefix = (airports: Airport[]): Map<string, Oaci[]> => {
  const res = new Map<string, Oaci[]>();
  for (const airport of airports) {
    for (const prefixLength of [1, 2, 3]) {
      addToMap(res, airport, prefixLength);
    }
  }
  return res;
};

export class Airports {
  private map: Map<Oaci, Airport>;
  private byPrefix: Map<string, Oaci[]>;
  constructor(airports: Airport[]) {
    this.map = toAirportMap(airports);
    this.byPrefix = indexByPrefix(airports);
  }
  get(ident: Oaci): Airport | undefined {
    return this.map.get(ident);
  }
  iterator(): IterableIterator<Airport> {
    return this.map.values();
  }
  all(): Airport[] {
    return Array.from(this.map.values());
  }
  private byIdentMaybe(ident: Oaci): Airport | undefined {
    return this.get(ident);
  }

  private byIdent(ident: Oaci): Airport {
    const res = this.get(ident);
    if (res === undefined) {
      throw new Error(`no airport with ident ${ident}`);
    }
    return res;
  }
  byIdents(idents: Oaci[]): Airport[] {
    return idents
      .map(ident => this.byIdentMaybe(ident))
      .flatMap(item => (item ? [item] : [])); // no better way? where's Option
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
      ([prefix, idents]: [string, Oaci[]]) => {
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

const isHeliport = (airport: Airport): boolean =>
  airport.name.toLowerCase().includes('heliport');

const heliportIcon = L.icon({
  iconUrl: 'heliport.png',
  //iconSize: [32, 32],
  //iconAnchor: [16, 16],
  //popupAnchor: [0, -16],
});
