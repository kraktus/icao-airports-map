import './style.css';
import './github.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
//import airports from '../extract.json';
import {airports, Airport} from './airport';
import hull from 'hull.js';

// import { map, latLng, tileLayer } from "leaflet";

console.log('ICAO airport v0.0');

export interface MapConfig {
  center: [number, number];
  zoom: number;
}

// TODO: check if http://andriiheonia.github.io/hull/#ex5 is necessary
//
// > All calculations in hull.js based on the cartesian coordinate system.
// If you use it for the calculation and data visualization on the global map
// please don't forget that globe has the shape of geoid, latitude and longitude
// are angles (not points with X and Y), and after projection we have some
// map distortion
const hullOf = (airports: Airport[]) => {
  const points = airports.map(airport => [
    airport.latitude_deg,
    airport.longitude_deg,
  ]);
  const hullPoints = hull(points);
  return hullPoints;
};

export class CustomMap {
  private map: L.Map;
  constructor(elementId: string, config: MapConfig) {
    this.map = L.map(elementId).setView(config.center, config.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      //maxZoom: 8,
    }).addTo(this.map);
  }
  addMarker(lat: number, lng: number, popupText: string) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon(),
    }).addTo(this.map);
    marker.bindPopup(popupText);
  }
  // addcircle
  addCircle(lat: number, lng: number, popupText: string) {
    const circle = L.circle([lat, lng], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5,
      radius: 1000,
    }).addTo(this.map);
    circle.bindPopup(popupText);
  }
  // add polygon
  addPolygon(points: [number, number][]) {
    const polygon = L.polygon(points, {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.15,
    }).addTo(this.map);
    polygon.on('click', () => {
      this.map.fitBounds(polygon.getBounds());
    });
  }
}

// the config must show all the earth
const config: MapConfig = { center: [50, 10], zoom: 6 };

const customMap = new CustomMap('map', config);
//customMap.addMarker(51.5, -0.09, 'Hello, this is a dynamic Leaflet map!');
console.log(hullOf(airports));
for (const airport of airports) {
  customMap.addCircle(
    airport.latitude_deg,
    airport.longitude_deg,
    `${airport.ident}: ${airport.name}`,
  );
}
// @ts-ignore
customMap.addPolygon(hullOf(airports));
