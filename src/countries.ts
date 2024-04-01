import * as L from 'leaflet';
import { Airports, Iso2, Airport, toCircle, toCircleMarker } from './airport';
import { countBy, getMostCommon } from './utils';
import { Borders } from './borders';
import { Info } from './info';
import { CustomMap, main } from './main';
import { debug } from './config';
import * as Countries from '../country-borders-simplified-2.geo.json';

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

const resetHighlight = (info: Info) => (e: L.LeafletMouseEvent) => {
  if (currentlyHighlighted !== undefined) {
    info.update();
    currentlyHighlighted.setStyle(defaultStyle);
  } else {
    console.log('currentlyHighlighted is undefined');
  }
};

const highlightFeature = (info: Info) => (e: L.LeafletMouseEvent) => {
  let layer = e.target;
  currentlyHighlighted = layer;
  layer.setStyle({
    weight: 3,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.7,
  });
  info.update(layer.feature);
  layer.bringToFront();
};

const zoomToFeature = (info: Info, map: L.Map) => (e: L.LeafletMouseEvent) => {
  map.fitBounds(e.target.getBounds());
  main(info.getPrefix(e.target.feature.geometry.properties.airports_gps_code));
};

const onEachFeature =
  (map: L.Map, resetHighlight: any, info: Info) =>
  (feature: any, layer: L.Layer) => {
    layer.on({
      mouseover: highlightFeature(info),
      mouseout: resetHighlight,
      click: zoomToFeature(info, map),
    });
  };

export const addGeo = (customMap: CustomMap, arp: Airports, info: Info) => {
  //console.log('full geojson', new Borders(prefixLength, arp).makeGeojson());
  const layers: L.Layer[] = [];
  const foo = new Borders(info, arp).makeGeojson();
  for (const [feature, minorityAirports] of foo) {
    console.log('feature feature', feature);
    const color = feature.properties.color;
    console.log('color', color);
    const airportCircles = minorityAirports.map(a => toCircleMarker(a, color));
    airportCircles.forEach(circle => {
      circle.addTo(customMap.map);
    });
    const multiPolygon = L.geoJson(feature, { style: style(arp) });
    //customMap.addGeoJson(multiPolygon);
    const layer = L.featureGroup([multiPolygon, ...airportCircles]);
    layer.on({
      mouseover: highlightFeature(info),
      mouseout: resetHighlight(info),
      click: zoomToFeature(info, customMap.map),
    });
    layer.addTo(customMap.map);
  }
  layers.forEach(layer => {
    layer.addTo(customMap.map);
  });
  // geojson = L.geoJson(borders as any, {
  //   style: style(arp),
  //   onEachFeature: onEachFeature(customMap.map, resetHighlight, info),
  // });
  //customMap.addGeoJson(geojson);
};

const style = (arp: Airports) => (feature: any) => {
  console.log('feature', feature);
  let fillColor = debug ? 'black' : feature.geometry.properties.color;
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
