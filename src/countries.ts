import * as L from 'leaflet';
import { Airports, Iso2, Airport, toCircle, toCircleMarker } from './airport';
import { countBy, getMostCommon } from './utils';
import { Borders, GeoData } from './borders';
import { Info } from './info';
import { CustomMap, main } from './main';
import { debug } from './config';
import * as Countries from '../country-borders-simplified-2.geo.json';
import { Feature, MultiPolygon } from 'geojson';

const fillOpacity = 0.6;

const highLightStyle = {
  weight: 3,
  color: '#666',
  dashArray: '',
  fillOpacity: 0.7,
};

const defaultStyle = {
  weight: 2,
  opacity: 1,
  color: undefined,
  dashArray: '3',
  fillOpacity: fillOpacity,
};

// Global grr, but hard to do better
let currentlyHighlighted: L.Layer | undefined = undefined;
// interface OldStyle {
//   multiPolygon: Object;
//   circle: Object; // for now assume all circles have same style
// }
let oldStyle: any = undefined; // WIP

const resetHighlight = (info: Info) => (e: L.LeafletMouseEvent) => {
  if (currentlyHighlighted !== undefined) {
    info.update();
    // @ts-ignore
    currentlyHighlighted.setStyle(defaultStyle);
  } else {
    console.log('currentlyHighlighted is undefined');
  }
};

const highlightFeature =
  (info: Info, feature?: Feature<MultiPolygon>) => (e: L.LeafletMouseEvent) => {
    let layer = e.target;
    currentlyHighlighted = layer;
    oldStyle = [];
    layer.eachLayer((l: any) => oldStyle.push(l.options));
    layer.setStyle(highLightStyle);
    info.update(feature);
    layer.bringToFront();
  };

const zoomToFeature =
  (info: Info, map: L.Map, feature: Feature<MultiPolygon>) =>
  (e: L.LeafletMouseEvent) => {
    map.fitBounds(e.target.getBounds());
    // TODO, is there a better way?
    console.log('click target', feature.properties);
    main(info.getPrefix(feature.properties!.airports_gps_code));
  };

const colorOfAirport =
  (arp: Airports, info: Info) =>
  (airport: Airport): string =>
    arp.prefixColor(
      info.getGpsCodePrefix(airport.gps_code),
      info.prefixLength(),
    );

export const addGeo = (customMap: CustomMap, arp: Airports, info: Info) => {
  //console.log('full geojson', new Borders(prefixLength, arp).makeGeojson());
  const colorOf = colorOfAirport(arp, info);
  const layers: L.Layer[] = [];
  const geoDataMap = new Borders(info, arp).makeGeojson();
  for (const [prefix, geoData] of geoDataMap) {
    const layerElm: any[] = [];
    console.log('geoData.feature', geoData.feature);
    const color = geoData.color;
    console.log('geoData.color', color);
    const airportCircles = geoData.airports.map(a => toCircle(a, colorOf(a)));
    if (geoData.feature !== undefined) {
      const multiPolygon = L.geoJson(geoData.feature, { style: style(arp) });
      multiPolygon.on({
        click: zoomToFeature(info, customMap.map, geoData.feature),
      });
      layerElm.push(multiPolygon);
    }
    layerElm.push(...airportCircles);
    console.log('layerElm', layerElm);
    const layer = L.featureGroup(layerElm);
    layer.on({
      mouseover: highlightFeature(info, geoData.feature),
      mouseout: resetHighlight(info),
    });
    customMap.addLayer(layer);
  }
  layers.forEach(layer => {
    layer.addTo(customMap.map);
  });
};

const style = (arp: Airports) => (feature?: Feature) => {
  console.log('feature', feature);
  let fillColor = debug ? 'black' : feature?.properties!.color;
  // console.log(
  //   'most common prefix of country',
  //   feature.properties.ISO_A2_EH,
  //   mostCommon,
  //   fillColor,
  // );

  // only `fillOpacity` is different compared to `defaultStyle
  return {
    fillColor: fillColor,
    weight: 2,
    opacity: 1,
    color: undefined,
    dashArray: '3',
    fillOpacity: fillOpacity,
  };
};
