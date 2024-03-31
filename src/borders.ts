import * as Countries from '../country-borders-simplified-2.geo.json';
import { groupBy, countBy, getMostCommon } from './utils';
import { Airports } from './airport';
import { Info } from './info';

export class Borders {
  info: Info;
  arp: Airports;
  constructor(info: Info, arp: Airports) {
    this.info = info;
    this.arp = arp;
  }

  private toMultiPolygon(polygons: any[]) {
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
          getMostCommon(this.info.getPrefixes(airports))!,
          this.info.prefixLength(),
        ),
      },
    };
  }

  makeGeojson() {
    const withAirports = Countries.features.filter(feature => {
      return feature.properties.airports_gps_code.length > 0;
    });

    const polyByPrefix = groupBy(withAirports, (feature: any) =>
      this.info.getPrefix(feature.properties.airports_gps_code),
    );
    // console.log(
    //   'polyByPrefix',
    //   polyByPrefix,
    //   'withAirports[0]',
    //   withAirports[0],
    //   'test getPrefix',
    //   this.getPrefix(withAirports[0]),
    // );
    const multiPolygons = Array.from(polyByPrefix.values()).map(
      this.toMultiPolygon.bind(this),
    );
    return {
      type: 'FeatureCollection',
      features: multiPolygons,
    };
  }
}
