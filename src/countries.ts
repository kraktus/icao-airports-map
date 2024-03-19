import * as Countries from '../country-borders-simplified.geo.json';
import * as L from 'leaflet';
import { colors } from './colors';
import { Airports } from './airport';

export const addGeo = (map: L.Map, arp: Airports) => {
  const prefixLength = 2;
  const prefixes = arp.listPrefix(prefixLength);
  const prefixesByCountry = arp.prefixesByCountry(prefixLength);
  const style = (feature: any) => {
    console.log('feature', feature);
    const countryCode = feature.properties.ISO_A2_EH;
    let fillColor = 'blue';
    if (countryCode !== undefined && countryCode !== '-99') {
      const prefixesOfCountry = prefixesByCountry.get(countryCode)!;
      let mostCommon = undefined;
      if (prefixesOfCountry) {
        mostCommon = Array.from(prefixesOfCountry.entries()).reduce((a, b) =>
          a[1] > b[1] ? a : b,
        )[0];
        fillColor = colors[prefixes.indexOf(mostCommon[0]) % colors.length];
      }
      console.log(
        'most common prefix of country',
        feature.properties.ISO_A2_EH,
        mostCommon,
        fillColor,
      );
    }
    return {
      fillColor: fillColor,
      weight: 2,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.4,
    };
  };
  L.geoJson(Countries as any, { style: style }).addTo(map);
};
