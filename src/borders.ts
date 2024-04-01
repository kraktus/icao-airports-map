import * as FeatureCollection from '../country-borders-simplified-2.geo.json';
import { groupBy, countBy, getMostCommon, mergeCountBy, fold } from './utils';
import { Airport, Airports, Oaci } from './airport';
import { Info } from './info';
import {qualifiedMajority} from './config';

interface Feature {
  geometry: { coordinates: number[][][]; type: string };
  id: number;
  properties: { ISO_A2_EH: string; airports_gps_code: string[] };
  type: string;
}

// TODO, should these empty features be removed by rust directly?
const Countries: Feature[] = FeatureCollection.features.filter(
  feature => feature.properties.airports_gps_code.length > 0,
);

export class Borders {
  info: Info;
  arp: Airports;
  constructor(info: Info, arp: Airports) {
    this.info = info;
    this.arp = arp;
  }

  // private toMultiPolygon(borders: Border[]) {
  //   const coords = borders.map(border => border.feature.geometry.coordinates);
  //   const airports = borders.flatMap(
  //     border => border.feature.properties.airports_gps_code,
  //   );
  //   return {
  //     type: 'MultiPolygon',
  //     coordinates: coords,
  //     properties: {
  //       airports_gps_code: airports,
  //       // airports should be non-empty
  //       color: this.arp.prefixColor(
  //         getMostCommon(this.info.getPrefixes(airports))!,
  //         this.info.prefixLength(),
  //       ),
  //     },
  //   };
  // }

  makeGeojson(): any {
    const withAirports: Border[] = Countries.map(
      feature => Border.new(this.info, [feature]),
    ).filter(border => border.prefix().startsWith(this.info.filter));

    const polyByPrefix: Map<string, Border[]> = groupBy(
      withAirports,
      (border: Border) => border.prefix(),
    );
    console.log("polyByPrefix", polyByPrefix)
    // for (const [prefix, feature] of polyByPrefix.entries()) {
    //   const x = countBy(feature.properties, (gps_code: any) =>
    //     this.info.getGpsCodePrefix(gps_code),
    //   );
    // }
    // console.log(
    //   'polyByPrefix',
    //   polyByPrefix,
    //   'withAirports[0]',
    //   withAirports[0],
    //   'test getPrefix',
    //   this.getPrefix(withAirports[0]),
    // );
    const multiPolygons = Array.from(polyByPrefix.values())
    .map(mergeBorders).map(border => border.toGeojson(this.info, this.arp));
    return {
      type: 'FeatureCollection',
      features: multiPolygons,
    };
  }
}

const mergeBorders = (borders: Border[]): Border => {
  return borders.reduce((acc, border) => acc.merge(border));
}

class Border {
  // we know the airports are not empty
  private prefixes: Map<string, number>;
  private _prefix: string | undefined; // memoize
  private constructor(
    prefixes: Map<string, number>,
    readonly features: Feature[],
  ) {
    this.prefixes = prefixes;
  }

  static new(info: Info, features: Feature[]): Border {
    let airports = features.flatMap(feature => feature.properties.airports_gps_code);
    let prefixes = info.getPrefixes(airports);
    return new Border(prefixes, features);
  }

  private airports(): Oaci[] {
    return this.features.flatMap(f => f.properties.airports_gps_code);
  }
  private minorityAirports(): Oaci[] {
    return this.airports().filter(airport => !airport.startsWith(this.prefix()));
  }

  merge = (border: Border): Border => {
    return new Border(
      mergeCountBy(this.prefixes, border.prefixes),
      this.features.concat(border.features),
    );
  };

  prefix(): string {
    // airports should be non-empty
    if (this._prefix) {
      return this._prefix;
    }
    this._prefix = getMostCommon(this.prefixes)!;
    return this._prefix;
  }

  private shouldShowPolygon(): ShouldShowPolygon {
    // nb airports not starting by prefix
    const totalAirports = fold(this.prefixes.values(), (a, b) => a + b);
    const minorityAirports = this.minorityAirports();
    const majorityRatio = (totalAirports - minorityAirports.length)/totalAirports;
    const shouldShowPolygon = majorityRatio > qualifiedMajority;
    return { minorityAirports, shouldShowPolygon };
    }

  toGeojson(info: Info, arp: Airports): any {
    const { minorityAirports, shouldShowPolygon } = this.shouldShowPolygon();
    const features = []
    const props = {
        airports_gps_code: this.airports(),
        color: arp.prefixColor(
          this.prefix(),
          info.prefixLength(),
        ),
      }
    if (minorityAirports.length > 0) {
       const multiPoints = toMultiPoints(arp.byIdents(minorityAirports), props);
      features.push(multiPoints);
    }
    if (shouldShowPolygon) {
      const multiPolygon = this.toMultiPolygon(info, arp, props);
      features.push(multiPolygon);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      properties: props
    };

  }

  private toMultiPolygon(info: Info, arp: Airports, props: Object) {
    const coords = this.features.map(f => f.geometry.coordinates);
    return {
      type: 'MultiPolygon',
      coordinates: coords,
      properties: props    };
  }
}

const toMultiPoints = (airports: Airport[], props: Object): any => {
  return {
    type: 'MultiPoint',
    coordinates: airports.map(airport => [
      airport.longitude_deg,
      airport.latitude_deg,
    ]),
    properties: props
  };
}

interface ShouldShowPolygon {
  minorityAirports: Oaci[];
  shouldShowPolygon: boolean;
}
