import * as L from 'leaflet'; // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/leaflet/index.d.ts
import { Airports, Iso2, Airport, toCircle, toCircleMarker } from './airport';
import { countBy, getMostCommon, deepCopy } from './utils';
import { Borders, GeoData } from './borders';
import { Info } from './info';
import { CustomMap, main } from './main';
import { debug } from './config';
import { Feature, MultiPolygon } from 'geojson';

const highLightStyle = {
  weight: 3,
  color: '#666',
  dashArray: '',
  fillOpacity: 0.7,
};

const resetHighlight =
  (info: Info, styling: Styling) => (e: L.LeafletMouseEvent) => {
    info.update();
    styling.resetStyle();
    e.target.bringToBack();
  };

const highlightFeature =
  (info: Info, styling: Styling, feature?: Feature<MultiPolygon>) =>
  (e: L.LeafletMouseEvent) => {
    let layer = e.target;
    styling.highlightStyle();
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
    const styling = new Styling();
    const color = geoData.color;
    const airportCircles = geoData.airports.map(a => toCircleMarker(a, color));
    airportCircles.forEach(c => styling.addPath(c));
    if (geoData.feature !== undefined) {
      const multiPolygon = L.geoJson(geoData.feature, {
        style: styleCallback(arp),
      });
      multiPolygon.on({
        click: zoomToFeature(info, customMap.map, geoData.feature),
      });
      layerElm.push(multiPolygon);
      styling.addGeoJson(multiPolygon, styleCallback(arp)(geoData.feature));
    }
    layerElm.push(...airportCircles);
    const layer = L.featureGroup(layerElm);
    layer.on({
      mouseover: highlightFeature(info, styling, geoData.feature),
      mouseout: resetHighlight(info, styling),
    });
    customMap.addLayer(layer);
  }
};

const styleCallback =
  (arp: Airports) =>
  (feature?: Feature): L.PathOptions => {
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

class Styling {
  private paths: [L.CircleMarker, L.CircleMarkerOptions][];
  private geoJsons: [L.GeoJSON, L.PathOptions][];
  constructor() {
    this.paths = [];
    this.geoJsons = [];
  }
  addPath(layer: L.CircleMarker) {
    // deepCopy is conservative here
    this.paths.push([layer, deepCopy(layer.options)]);
  }

  addGeoJson(geojson: L.GeoJSON, styleOptions: L.PathOptions) {
    // deepCopy is conservative here
    console.log('styleOptions', styleOptions);
    this.geoJsons.push([geojson, deepCopy(styleOptions)]);
  }

  highlightStyle() {
    for (const [layer, options] of this.paths) {
      layer.setRadius(options.radius! * 5);
      layer.setStyle(highLightStyle);
    }
    for (const [layer, style] of this.geoJsons) {
      layer.setStyle(highLightStyle);
    }
  }

  resetStyle() {
    for (const [layer, options] of this.paths) {
      layer.setStyle(options);
      layer.setRadius(options.radius!);
    }
    for (const [layer, style] of this.geoJsons) {
      layer.setStyle(style);
    }
  }
}
