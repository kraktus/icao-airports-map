import './style.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { airports, Airport } from './airport';
import { colors } from './colors';
import hull from 'hull.js';
import { addGeo } from './countries';
import { Info } from './info';

//  L.geoJSON(geojsonFeature).addTo(map);

console.log('ICAO airport v0.0');

const HULL_FACTOR = 50;

// const writeToOutput = (...text: string[]) => {
//   const output = document.getElementById('output')!;
//   output.innerHTML = output.innerHTML + text.join(' ') + '\n';
// };

export interface MapConfig {
  center: [number, number];
  zoom: number;
}

export class CustomMap {
  map: L.Map; // make private once finished
  private layers: L.Layer[] = [];
  constructor(elementId: string, config: MapConfig) {
    this.map = L.map(elementId).setView(config.center, config.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      //maxZoom: 8,
    }).addTo(this.map);
    L.control.scale().addTo(this.map);
  }
  addMarker(lat: number, lng: number, popupText: string) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon(),
    }).addTo(this.map);
    marker.bindPopup(popupText);
    this.layers.push(marker);
  }

  addCircle(
    lat: number,
    lng: number,
    popupText: string,
    color: string = 'red',
  ) {
    const circle = L.circle([lat, lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.5,
      radius: 1000,
    }).addTo(this.map);
    circle.bindPopup(popupText);
    this.layers.push(circle);
  }

  addPolygon(points: [number, number][], color: string = 'red') {
    const polygon = L.polygon(points, {
      color: color,
      fillColor: color,
      fillOpacity: 0.15,
    }).addTo(this.map);
    this.layers.push(polygon);
    // polygon.on('click', () => {
    //   this.map.fitBounds(polygon.getBounds());
    // });
  }

  addGeoJson(geoJson: any) {
    L.geoJSON(geoJson).addTo(this.map);
  }

  clear() {
    this.layers.forEach(layer => {
      this.map.removeLayer(layer);
    });
  }

  hullOf(ard: Airport[]): [number, number][] {
    const points = ard.map(airport => {
      const xyPt = this.map.latLngToContainerPoint({
        lat: airport.latitude_deg,
        lng: airport.longitude_deg,
      });
      return [xyPt.x, xyPt.y];
    });
    const hullPoints = hull(points, HULL_FACTOR) as [number, number][];
    return hullPoints.map(([x, y]) => {
      const latLongPt = this.map.containerPointToLatLng(L.point(x, y));
      return [latLongPt.lat, latLongPt.lng];
    });
  }
}

// the config must show all the earth
const config: MapConfig = { center: [0, 0], zoom: 2 };

const customMap = new CustomMap('map', config);
const info = new Info('');

const main = (filter: string) => {
  console.log('main called');
  customMap.clear();
  info.update(filter);
  addGeo(customMap.map, airports, info);

  // DEBUG
  Array.from(airports.getAllPrefixes(1).entries()).map(([i, ard]) => {
    const color = colors[i % colors.length];

    // for (const airport of ard) {
    //   customMap.addCircle(
    //     airport.latitude_deg,
    //     airport.longitude_deg,
    //     `${airport.gps_code}: ${airport.name}`,
    //     color,
    //   );
    // }
    //const hullPoints = customMap.hullOf(ard);
    // @ts-ignore
    //customMap.addPolygon(hullPoints, color);
  });
  console.log('end of main');
};
main('');
// get info by class name
const infoDiv = document.getElementsByClassName('info')[0];
const infoInput = document.getElementById('info-input') as HTMLInputElement;

console.log('infoInput', infoDiv);
// listen to input text changing
infoDiv.addEventListener('keypress', () => {
  console.log('infoInput', infoInput.value);
  main(infoInput.value);
});
console.log('callback added');
