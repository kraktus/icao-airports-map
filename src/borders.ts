import * as FeatureCollection from './data/country-borders.geo.json';
import {
  groupBy,
  getMostCommon,
  mergeCountBy,
  fold,
  groupByOne,
  mapValues,
} from './utils';
import { Airport, Airports, Oaci } from './airport';
import { Info, UpdateData } from './info';
import { qualifiedMajority } from './config';
import { Feature, MultiPolygon, GeoJsonProperties, Polygon } from 'geojson';

// interface LocalFeature {
//   geometry: { coordinates: number[][][]; type: string };
//   id: number;
//   properties: { ISO_A2_EH: string; airports_gps_code: string[] };
//   type: string;
// }

// TODO, should these empty features be removed by rust directly?
const Countries: Feature<Polygon>[] = FeatureCollection.features.filter(
  feature => feature.properties.airports_gps_code.length > 0,
) as Feature<Polygon>[];

export class Borders {
  info: Info;
  arp: Airports;
  constructor(info: Info, arp: Airports) {
    this.info = info;
    this.arp = arp;
  }

  // map by prefix
  makeGeojson(): Map<string, GeoData> {
    const withAirports: Border[] = Countries.map(feature =>
      Border.new(this.info, [feature]),
    );

    const polyByPrefix: Map<string, Border[]> = groupBy(
      withAirports,
      (border: Border) => border.prefix(),
    );
    const mergedBorders: Map<string, Border> = mapValues(
      polyByPrefix,
      mergeBorders,
    );

    const individualAiports: Oaci[] = [];
    const polys: Feature<MultiPolygon>[] = [];
    for (const border of mergedBorders.values()) {
      const [airports, poly] = border.airportsAndPoly(this.info, this.arp);
      individualAiports.push(...airports);
      if (poly) {
        polys.push(poly);
      }
    }
    const individualAiportsByPrefix =
      this.info.groupByPrefixes(individualAiports);
    const polysByPrefix = groupByOne(
      polys,
      (poly: Feature<MultiPolygon>) => poly.properties!.prefix,
    );

    const geoDataMap = new Map<string, GeoData>();
    for (const prefix of this.arp.listPrefix(this.info.prefixLength())) {
      if (!prefix.startsWith(this.info.filter)) {
        continue;
      }

      const poly = polysByPrefix.get(prefix);
      const airports = individualAiportsByPrefix.get(prefix) || [];
      geoDataMap.set(prefix, {
        feature: poly,
        airports: this.arp.byIdents(airports),
        color: this.arp.prefixColor(prefix, this.info.prefixLength()),
      });
    }
    return geoDataMap;
  }
}

const mergeBorders = (borders: Border[]): Border => {
  return borders.reduce((acc, border) => acc.merge(border));
};

class Border {
  // we know the airports are not empty
  private prefixes: Map<string, number>;
  private _prefix: string | undefined; // memoize
  private constructor(
    prefixes: Map<string, number>,
    readonly features: Feature<Polygon>[],
  ) {
    this.prefixes = prefixes;
  }

  static new(info: Info, features: Feature<Polygon>[]): Border {
    let airports = features.flatMap(
      feature => feature.properties!.airports_gps_code,
    );
    let prefixes = info.countByPrefixes(airports);
    return new Border(prefixes, features);
  }

  private airports(): Oaci[] {
    return this.features.flatMap(f => f.properties!.airports_gps_code);
  }
  minorityAirports(): Oaci[] {
    return this.airports().filter(
      airport => !airport.startsWith(this.prefix()),
    );
  }

  merge = (border: Border): Border => {
    return new Border(
      mergeCountBy(this.prefixes, border.prefixes),
      this.features.concat(border.features),
    );
  };

  prefix(): string {
    if (this._prefix) {
      return this._prefix;
    }
    // airports should be non-empty
    this._prefix = getMostCommon(this.prefixes)!;
    return this._prefix;
  }

  private shouldShowPolygon(): boolean {
    // Always bail out when prefix is of length 3
    if (this.prefix().length === 3) {
      return false;
    }

    // nb airports not starting by prefix
    const totalAirports = fold(this.prefixes.values(), (a, b) => a + b);
    const minorityAirports = this.minorityAirports();
    const majorityRatio =
      (totalAirports - minorityAirports.length) / totalAirports;

    const shouldShowPolygon = majorityRatio > qualifiedMajority;
    return shouldShowPolygon;
  }

  private properties(info: Info, arp: Airports): GeoJsonProperties {
    return {
      airports_gps_code: this.airports(),
      color: arp.prefixColor(this.prefix(), info.prefixLength()),
      prefix: this.prefix(),
    };
  }
  // return airports that should be shown indivially, and the multipolygon, if possible
  airportsAndPoly(
    info: Info,
    arp: Airports,
  ): [Oaci[], Feature<MultiPolygon> | undefined] {
    let multiPolygon = this.toMultiPolygon(info, arp);
    let airports = multiPolygon ? this.minorityAirports() : this.airports();
    return [airports, multiPolygon];
  }

  private toMultiPolygon(
    info: Info,
    arp: Airports,
  ): Feature<MultiPolygon> | undefined {
    if (this.shouldShowPolygon()) {
      const coords = this.features.map(f => f.geometry.coordinates);
      return writeMultiPolygon(coords, this.properties(info, arp));
    }
  }
}

const writeMultiPolygon = (
  coords: number[][][][],
  props: GeoJsonProperties,
): Feature<MultiPolygon> => {
  return {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: coords,
    },
    properties: props,
  };
};

// for the same `prefix`!
export interface GeoData {
  feature?: Feature<MultiPolygon>;
  // minority airports other multipolygons,
  // or in case the polygon is not shown, all airports
  airports: Airport[];
  color: string;
}

export const toUpdateData = (prefix: string, geoData: GeoData): UpdateData => {
  const inPoly = geoData.feature?.properties!.airports_gps_code.filter(
    (icao: string) => icao.startsWith(prefix),
  ).length;
  return {
    prefix: prefix,
    nbAirports: (inPoly || 0) + geoData.airports.length,
  };
};
