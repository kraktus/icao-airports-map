import * as FeatureCollection from '../country-borders-simplified-2.geo.json';
import {
  groupBy,
  countBy,
  getMostCommon,
  mergeCountBy,
  fold,
  mapValues,
  setOf,
} from './utils';
import { Airport, Airports, Oaci } from './airport';
import { Info } from './info';
import { qualifiedMajority } from './config';
import {
  Feature,
  MultiPolygon,
  MultiPoint,
  GeoJsonProperties,
  Polygon,
  Geometry,
} from 'geojson';

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
    ).filter(border => border.prefix().startsWith(this.info.filter));

    const polyByPrefix: Map<string, Border[]> = groupBy(
      withAirports,
      (border: Border) => border.prefix(),
    );
    const mergedBorders: Map<string, Border> = mapValues(
      polyByPrefix,
      mergeBorders,
    );
    const geoDataMap = new Map<string, GeoData>();
    // TODO/FIXME, this currently ignore prefix for which there are no polygons
    for (const prefix of this.arp.listPrefix(this.info.prefixLength())) {
      const border = mergedBorders.get(prefix);
      if (border) {
        geoDataMap.set(prefix, border.toGeoData(this.info, this.arp));
      }
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
    };
  }

  toGeoData(info: Info, arp: Airports): GeoData {
    let multiPolygon = this.toMultiPolygon(info, arp);
    let airports = multiPolygon ? this.minorityAirports() : this.airports();
    return {
      feature: multiPolygon,
      airports: arp.byIdents(airports),
      color: arp.prefixColor(this.prefix(), info.prefixLength()),
    };
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

const toMultiPoints = (
  airports: Airport[],
  props: GeoJsonProperties,
): Feature<MultiPoint> => {
  return writemultiPoint(
    airports.map(airport => [airport.longitude_deg, airport.latitude_deg]),
    props,
  );
};

const writemultiPoint = (
  coords: number[][],
  props: GeoJsonProperties,
): Feature<MultiPoint> => {
  return {
    type: 'Feature',
    geometry: {
      type: 'MultiPoint',
      coordinates: coords,
    },
    properties: props,
  };
};

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

// for the same Border
export interface GeoData {
  // feature is always multipolygon in this case
  feature?: Feature<MultiPolygon>; // TODO add geojson package or typing
  // minority airports in the multipolygon,
  // or in case the polygon is not shown, all airports
  airports: Airport[];
  color: string; // for easier access, TODO not useful anymore I think, since airports
  // are colored individually, and the mPoly has its color stored
}
