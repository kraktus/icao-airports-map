import * as L from 'leaflet';
import { Airports, Iso2, Airport, toCircle, toCircleMarker } from './airport';
import { countBy, getMostCommon, deepCopy } from './utils';
import { Borders, GeoData } from './borders';
import { Info } from './info';
import { CustomMap, main } from './main';
import { debug } from './config';
import * as Countries from '../country-borders-simplified-2.geo.json';
import { Feature, MultiPolygon } from 'geojson';

const highLightStyle = {
  weight: 3,
  color: '#666',
  dashArray: '',
  fillOpacity: 0.7,
};

const resetHighlight =
  (info: Info, originalStyle: OriginalStyle) => (e: L.LeafletMouseEvent) => {
    info.update();
    originalStyle.resetStyle();
    e.target.bringToBack();
  };

const highlightFeature =
  (info: Info, feature?: Feature<MultiPolygon>) => (e: L.LeafletMouseEvent) => {
    let layer = e.target;
    layer.setStyle(highLightStyle);
    info.update(feature);
    layer.bringToFront();
  };

const zoomToFeature =
  (info: Info, map: L.Map, feature: Feature<MultiPolygon>) =>
  (e: L.LeafletMouseEvent) => {
    map.fitBounds(e.target.getBounds());
    // TODO, is there a better way?
    main(info.getPrefix(feature.properties!.airports_gps_code));
  };

export const addGeo = (customMap: CustomMap, arp: Airports, info: Info) => {
  //console.log('full geojson', new Borders(prefixLength, arp).makeGeojson());
  const geoDataMap = new Borders(info, arp).makeGeojson();
  for (const [prefix, geoData] of geoDataMap) {
    const layerElm: (L.Path | L.GeoJSON)[] = [];
    const originalStyle = new OriginalStyle();
    const color = geoData.color;
    const airportCircles = geoData.airports.map(a => toCircle(a, color));
    airportCircles.forEach(c => originalStyle.addPath(c));
    if (geoData.feature !== undefined) {
      const multiPolygon = L.geoJson(geoData.feature, { style: style(arp) });
      multiPolygon.on({
        click: zoomToFeature(info, customMap.map, geoData.feature),
      });
      layerElm.push(multiPolygon);
      originalStyle.addGeoJson(multiPolygon, style(arp)(geoData.feature));
    }
    layerElm.push(...airportCircles);
    console.log('layerElm', layerElm);
    const layer = L.featureGroup(layerElm);
    layer.on({
      mouseover: highlightFeature(info, geoData.feature),
      mouseout: resetHighlight(info, originalStyle),
    });
    customMap.addLayer(layer);
  }
};

const style =
  (arp: Airports) =>
  (feature?: Feature): L.PathOptions => {
    console.log('feature', feature);
    let fillColor = debug ? 'black' : feature?.properties!.color;
    return {
      fillColor: fillColor,
      weight: 2,
      opacity: 1,
      color: undefined,
      dashArray: '3',
      fillOpacity: 0.6,
    };
  };

class OriginalStyle {
  private elm: [L.Path | L.GeoJSON, L.PathOptions][];
  constructor() {
    this.elm = [];
  }
  addPath(layer: L.Path) {
    // deepCopy is conservative here
    this.elm.push([layer, deepCopy(layer.options)]);
  }

  addGeoJson(geojson: L.GeoJSON, styleOptions: L.PathOptions) {
    // deepCopy is conservative here
    this.elm.push([geojson, styleOptions]);
  }

  resetStyle() {
    for (const [layer, style] of this.elm) {
      console.log('resetStyle, layer', layer, 'style', style);
      layer.setStyle(style);
    }
  }
}
