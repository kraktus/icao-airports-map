import './style.css';
import './github.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
//import airports from '../extract.json';
import { airports, Airport } from './airport';
import hull from 'hull.js';

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
    L.polygon(points, {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.15,
    }).addTo(this.map);
    // polygon.on('click', () => {
    //   this.map.fitBounds(polygon.getBounds());
    // });
  }

  // TODO: check if http://andriiheonia.github.io/hull/#ex5 is necessary
  //
  // > All calculations in hull.js based on the cartesian coordinate system.
  // If you use it for the calculation and data visualization on the global map
  // please don't forget that globe has the shape of geoid, latitude and longitude
  // are angles (not points with X and Y), and after projection we have some
  // map distortion
  hullOf(ard: Airport[]) {
    const points = ard.map(airport => {
      const xyPt = this.map.latLngToContainerPoint({
        lng: airport.latitude_deg,
        lat: airport.longitude_deg,
      });
      return [xyPt.x, xyPt.y];
    });
    const hullPoints = hull(points) as number[][];
    return hullPoints.map(pt => {
      const latLongPt = this.map.containerPointToLatLng(L.point(pt[0], pt[1]));
      return [latLongPt.lat, latLongPt.lng];
    });
  }
}

// the config must show all the earth
const config: MapConfig = { center: [50, 10], zoom: 2 };

const customMap = new CustomMap('map', config);

const i = 0;
//console.log(airports.allOneLetterPrefixes()[0]);
airports
  .allOneLetterPrefixes()
  .slice(i, i + 1)
  //.filter((ard: Airport[]) => ard[0].gps_code.startsWith('D'))
  .map((ard: Airport[]) => {
    // for (const airport of ard) {
    //   customMap.addCircle(
    //     airport.latitude_deg,
    //     airport.longitude_deg,
    //     `${airport.gps_code}: ${airport.name}`,
    //   );
    // }
    const hullPoints = customMap.hullOf(ard);
    console.log('hullPoints', hullPoints);
    // @ts-ignore
    customMap.addPolygon(hullPoints);
  });
