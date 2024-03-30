import * as Countries from '../country-borders-simplified-2.geo.json';
import * as L from 'leaflet';
import { Airports, Iso2, Airport } from './airport';
import { countBy, getMostCommon } from './utils';

const prefixLength = 1;

const toBr = (...l: string[]) => {
  // place each element into <b> /<b><br /> tag
  return l.map(y => `${y}<br />`).join('');
};

const text = (...l: string[]) => {
  return toBr(`id ${l[0]}`, `nb arps ${l[1]}`);
};

// method that we will use to update the control based on feature properties passed
const update = (div: HTMLElement, feature?: any) => {
  const p = feature?.properties;
  return (div.innerHTML =
    '<h4>Airport info</h4>' +
    (p
      ? text(feature.id, p.airports_gps_code.length)
      : 'Hover over a country'));
};

const getInfo = () => {
  // @ts-ignore
  let info = L.control();

  info.onAdd = function (map: L.Map) {
    // @ts-ignore
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    console.log('_div', this._div);
    // @ts-ignore
    update(this._div);
    // @ts-ignore
    return this._div;
  };
  return info;
};
let info = getInfo(); // FIXME, temporary, eventually move this to customMap

const highlightFeature = (e: L.LeafletMouseEvent) => {
  let layer = e.target;
  layer.setStyle({
    weight: 5,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.7,
  });
  update(info._div, layer.feature);
  layer.bringToFront();
};

const zoomToFeature = (map: L.Map) => (e: L.LeafletMouseEvent) => {
  map.fitBounds(e.target.getBounds());
};

const onEachFeature =
  (map: L.Map, resetHighlight: any) => (feature: any, layer: L.Layer) => {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: zoomToFeature(map),
    });
  };

export const addGeo = (map: L.Map, arp: Airports) => {
  const prefixesByCountry = arp.prefixesByCountry(prefixLength);
  console.log('prefixesByCountry', prefixesByCountry);
  let geojson: any;
  const resetHighlight = (e: L.LeafletMouseEvent) => {
    if (geojson !== undefined) {
      console.log('tested!');
      update(info._div);
      geojson.resetStyle(e.target);
    } else {
      console.log('geojson is undefined');
    }
  };
  geojson = L.geoJson(Countries as any, {
    style: style(prefixesByCountry, arp),
    onEachFeature: onEachFeature(map, resetHighlight),
  });
  info.addTo(map);
  geojson.addTo(map);
};

// interface GeoFeature {
//   type: string;
//   geometry: {
//     type: string;
//     coordinates: [number, number][][][];
//   };
//   properties: { ISO_A2_EH: string };
// }

const getPrefixes = (gps_codes: string[]): Map<string, number> => {
  return countBy(gps_codes, (gps_code: string) =>
    gps_code.slice(0, prefixLength),
  );
};

const style =
  (prefixesByCountry: Map<Iso2, Map<string, number>>, arp: Airports) =>
  (feature: any) => {
    //console.log('feature', feature);
    const countryCode = feature.properties.ISO_A2_EH;
    let fillColor = 'blue';
    if (countryCode !== undefined && countryCode !== '-99') {
      // only works for polygon, not multipolygon
      let prefixesOfCountry = undefined;
      if (feature.geometry.type === 'Polygon') {
        //console.log('before airportsInCountry', countryCode);
        prefixesOfCountry = getPrefixes(feature.properties.airports_gps_code);
      }
      // if (prefixesOfCountry === undefined || prefixesOfCountry.size === 0) {
      //   //console.log('fallback');
      //   prefixesOfCountry = prefixesByCountry.get(countryCode);
      // }
      if (countryCode == 'FR') {
        console.log(
          'countryCode',
          countryCode,
          'prefixesOfCountry',
          prefixesOfCountry,
        );
      }
      let mostCommonPrefix = undefined;
      if (prefixesOfCountry !== undefined) {
        mostCommonPrefix = getMostCommon(prefixesOfCountry);
        if (mostCommonPrefix !== undefined) {
          fillColor = arp.prefixColor(mostCommonPrefix, prefixLength);
        }
      }
      // console.log(
      //   'most common prefix of country',
      //   feature.properties.ISO_A2_EH,
      //   mostCommon,
      //   fillColor,
      // );
    }
    return {
      fillColor: fillColor,
      weight: 2,
      opacity: 1,
      color: undefined,
      dashArray: '3',
      fillOpacity: 0.4,
    };
  };
