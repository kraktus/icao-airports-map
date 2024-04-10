import * as L from 'leaflet'; // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/leaflet/index.d.ts
import { Airports, toCircleMarker } from './airport';
import { deepCopy } from './utils';
import { Borders, toUpdateData, GeoData } from './borders';
import { Info, UpdateData } from './info';
import { CustomMap, main } from './main';
import { Feature } from 'geojson';

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
  (info: Info, styling: Styling, updateData?: UpdateData) =>
  (e: L.LeafletMouseEvent) => {
    let layer = e.target;
    styling.highlightStyle();
    info.update(updateData);
    layer.bringToFront();
  };

const zoomToFeature =
  (map: L.Map, prefix: string) => (e: L.LeafletMouseEvent) => {
    map.fitBounds(e.target.getBounds());
    // TODO, is there a better way?
    main(prefix);
  };

export const addGeo = (customMap: CustomMap, arp: Airports, info: Info) => {
  const geoDataMap = new Borders(info, arp).makeGeojson();
  for (const [prefix, geoData] of geoDataMap) {
    addGeoData(customMap, info, prefix, geoData);
  }
};

const addGeoData = (
  customMap: CustomMap,
  info: Info,
  prefix: string,
  geoData: GeoData,
) => {
  const maxedZoomPrefix = prefix.length == 3;
  const layerElm: (L.Path | L.GeoJSON)[] = [];
  const styling = new Styling();
  const airportCircles = geoData.airports.map(a =>
    toCircleMarker(a, geoData.color, maxedZoomPrefix),
  );
  airportCircles.forEach(styling.addPath.bind(styling));
  if (geoData.feature !== undefined) {
    const multiPolygon = L.geoJson(geoData.feature, {
      style: styleCallback,
    });
    layerElm.push(multiPolygon);
    styling.addGeoJson(multiPolygon, styleCallback(geoData.feature));
  }
  layerElm.push(...airportCircles);
  const layer = L.featureGroup(layerElm);
  layer.on({
    mouseover: highlightFeature(info, styling, toUpdateData(prefix, geoData)),
    mouseout: resetHighlight(info, styling),
  });
  if (!maxedZoomPrefix) {
    layer.on({
      click: zoomToFeature(customMap.map, prefix),
    });
  }
  customMap.addLayer(layer);
};

const styleCallback = (feature?: Feature): L.PathOptions => {
  return {
    fillColor: feature?.properties!.color,
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
    this.geoJsons.push([geojson, deepCopy(styleOptions)]);
  }

  highlightStyle() {
    for (const [layer, options] of this.paths) {
      layer.setRadius(options.radius! * 5);
      layer.setStyle(highLightStyle);
    }
    for (const [layer, _] of this.geoJsons) {
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
