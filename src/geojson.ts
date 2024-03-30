import * as Countries from '../country-borders-simplified-2.geo.json';
import { groupBy, countBy, getMostCommon } from './utils';
import { Airports } from './airport';

export class Borders {
  prefixLength: number; // make private once finished
  arp: Airports;
  constructor(prefixLength: number, arp: Airports) {
    this.prefixLength = prefixLength;
    this.arp = arp;
  }

  getPrefixes(gps_codes: string[]): Map<string, number> {
    return countBy(gps_codes, (gps_code: string) =>
      gps_code.slice(0, this.prefixLength),
    );
  }
  getPrefix(feature: any) {
    getMostCommon(this.getPrefixes(feature.properties.airports_gps_code));
  }

  toMultiPolygon(polygons: any[]) {
    const coords = polygons.map(polygon => polygon.geometry.coordinates);
    const airports = polygons.flatMap(
      polygon => polygon.properties.airports_gps_code,
    );
    return {
      type: 'MultiPolygon',
      coordinates: coords,
      properties: {
        airports_gps_code: airports,
        // airports should be non-empty
        color: this.arp.prefixColor(
          getMostCommon(this.getPrefixes(airports))!,
          1,
        ),
      },
    };
  }

  makeGeojson() {
    const withAirports = Countries.features.filter(feature => {
      return feature.properties.airports_gps_code.length > 0;
    });

    const polyByPrefix = groupBy(withAirports, this.getPrefix.bind(this));
    const multiPolygons = Array.from(polyByPrefix.values()).map(
      this.toMultiPolygon.bind(this),
    );
    return {
      type: 'FeatureCollection',
      features: multiPolygons,
    };
  }
}
