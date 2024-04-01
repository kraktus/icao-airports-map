import * as FeatureCollection from '../country-borders-simplified-2.geo.json';
import { groupBy, countBy, getMostCommon, mergeCountBy } from './utils';
import { Airports } from './airport';
import { Info } from './info';

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
    const withAirports: Border[] = Countries.map(feature =>
      Border.new(this.info, [feature]),
    ).filter(border => border.prefix().startsWith(this.info.filter));

    const polyByPrefix: Map<string, Border[]> = groupBy(
      withAirports,
      (border: Border) => border.prefix(),
    );
    console.log('polyByPrefix', polyByPrefix);
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
      .map(mergeBorders)
      .map(border => border.toMultiPolygon(this.info, this.arp));
    return {
      type: 'FeatureCollection',
      features: multiPolygons,
    };
  }
}

const mergeBorders = (borders: Border[]): Border => {
  return borders.reduce((acc, border) => acc.merge(border));
};

class Border {
  // we know the airports are not empty
  private prefixes: Map<string, number>;
  private constructor(
    prefixes: Map<string, number>,
    readonly features: Feature[],
  ) {
    this.prefixes = prefixes;
  }

  static new(info: Info, features: Feature[]): Border {
    let airports = features.flatMap(
      feature => feature.properties.airports_gps_code,
    );
    let prefixes = info.getPrefixes(airports);
    return new Border(prefixes, features);
  }

  merge = (border: Border): Border => {
    return new Border(
      mergeCountBy(this.prefixes, border.prefixes),
      this.features.concat(border.features),
    );
  };

  prefix(): string {
    return getMostCommon(this.prefixes)!;
  }

  toMultiPolygon(info: Info, arp: Airports) {
    const coords = this.features.map(f => f.geometry.coordinates);
    const airports = this.features.flatMap(f => f.properties.airports_gps_code);
    return {
      type: 'MultiPolygon',
      coordinates: coords,
      properties: {
        airports_gps_code: airports,
        // airports should be non-empty
        color: arp.prefixColor(this.prefix(), info.prefixLength()),
      },
    };
  }
}
