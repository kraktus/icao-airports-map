import * as L from 'leaflet';
import { Airports, Iso2, Airport } from './airport';
import { countBy, getMostCommon } from './utils';
import { Borders } from './geojson';
import { Info } from './info';
import { debug } from './config';
import * as Countries from '../country-borders-simplified-2.geo.json';

const highlightFeature = (info: Info) => (e: L.LeafletMouseEvent) => {
  let layer = e.target;
  layer.setStyle({
    weight: 3,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.7,
  });
  info.update(layer.feature);
  layer.bringToFront();
};

const zoomToFeature = (map: L.Map) => (e: L.LeafletMouseEvent) => {
  map.fitBounds(e.target.getBounds());
};

const onEachFeature =
  (map: L.Map, resetHighlight: any, info: Info) =>
  (feature: any, layer: L.Layer) => {
    layer.on({
      mouseover: highlightFeature(info),
      mouseout: resetHighlight,
      click: zoomToFeature(map),
    });
  };

export const addGeo = (map: L.Map, arp: Airports, info: Info) => {
  let geojson: any; // required for resetHighlight
  const resetHighlight = (e: L.LeafletMouseEvent) => {
    if (geojson !== undefined) {
      info.update();
      geojson.resetStyle(e.target);
    } else {
      console.log('geojson is undefined');
    }
  };
  //console.log('full geojson', new Borders(prefixLength, arp).makeGeojson());
  const borders = debug
    ? Countries
    : new Borders(info.filter, arp).makeGeojson();
  geojson = L.geoJson(borders as any, {
    style: style(arp),
    onEachFeature: onEachFeature(map, resetHighlight, info),
  });
  info.addTo(map);
  geojson.addTo(map);
};

const style = (arp: Airports) => (feature: any) => {
  //console.log('feature', feature);
  let fillColor = debug ? 'black' : feature.geometry.properties.color;
  let fillOpacity = 0.4;
  // console.log(
  //   'most common prefix of country',
  //   feature.properties.ISO_A2_EH,
  //   mostCommon,
  //   fillColor,
  // );

  return {
    fillColor: fillColor,
    weight: 2,
    opacity: 1,
    color: undefined,
    dashArray: '3',
    fillOpacity: fillOpacity,
  };
};
