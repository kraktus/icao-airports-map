import './style.css';
import './github.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// import { map, latLng, tileLayer } from "leaflet";

console.log('ICAO airport v0.0');

export interface MapConfig {
  center: [number, number];
  zoom: number;
}

export class CustomMap {
  private map: L.Map;
  constructor(elementId: string, config: MapConfig) {
    this.map = L.map(elementId).setView(config.center, config.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
  }
  addMarker(lat: number, lng: number, popupText: string) {
    const marker = L.marker([lat, lng]).addTo(this.map);
    marker.bindPopup(popupText).openPopup();
  }
}

// the config must show all the earth
const config: MapConfig = { center: [0, 0], zoom: 2 };

const customMap = new CustomMap('map', config);
customMap.addMarker(51.5, -0.09, 'Hello, this is a dynamic Leaflet map!');
