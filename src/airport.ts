import { ALL } from './unparsed';
import Papa from 'papaparse';

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

export const airports = Papa.parse(ALL, { header: true }).data as Airport[];

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
  return res;
};
