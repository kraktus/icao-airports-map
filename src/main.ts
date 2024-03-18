import './style.css';
import './github.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { airports, Airport } from './airport';
import hull from 'hull.js';

console.log('ICAO airport v0.0');

const oldfHull = (ard: Airport[]): [number, number][] => {
  const points = ard.map(airport => [
    airport.latitude_deg,
    airport.longitude_deg,
  ]);
  const hullPoints = hull(points);
  return hullPoints as [number, number][];
};

export interface MapConfig {
  center: [number, number];
  zoom: number;
}

export class CustomMap {
  private map: L.Map;
  private layers: L.Layer[] = [];
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
    this.layers.push(marker);
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
    this.layers.push(circle);
  }
  // add polygon
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

  clear() {
    this.layers.forEach(layer => {
      this.map.removeLayer(layer);
    });
  }

  // TODO: check if http://andriiheonia.github.io/hull/#ex5 is necessary
  //
  // > All calculations in hull.js based on the cartesian coordinate system.
  // If you use it for the calculation and data visualization on the global map
  // please don't forget that globe has the shape of geoid, latitude and longitude
  // are angles (not points with X and Y), and after projection we have some
  // map distortion
  hullOf(ard: Airport[]): [number, number][] {
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
      return [latLongPt.lng, latLongPt.lat];
    }) as [number, number][];
  }
}

// the config must show all the earth
const config: MapConfig = { center: [50, 10], zoom: 2 };

const customMap = new CustomMap('map', config);

document.getElementById('slider')!.addEventListener('input', () => {
  main(Number((document.getElementById('slider') as HTMLInputElement).value));
});
const main = (i: number) => {
  customMap.clear();
  airports
    .allOneLetterPrefixes()
    .slice(i, i + 1)
    //.filter((ard: Airport[]) => ard[0].gps_code.startsWith('D'))
    .map((ard: Airport[]) => {
      console.log(
        'first airport code: ',
        ard[0].gps_code,
        'number of aprts: ',
        ard.length,
      );

      for (const airport of ard) {
        customMap.addCircle(
          airport.latitude_deg,
          airport.longitude_deg,
          `${airport.gps_code}: ${airport.name}`,
        );
      }
      //const hullPoints = customMap.hullOf(ard);
      //console.log('hullPoints', hullPoints);
      //console.log('OLD hullPoints', oldfHull(ard));
      // const p180 = oldfHull(ard).map((x: [number, number]) => {
      //   //console.log('in p180', x);
      //   const after = [Number(x[0]), Number(x[1]) - 180] as unknown as [
      //     number,
      //     number,
      //   ][];
      //   //console.log('after', after);
      //   return after;
      // });
      //console.log('OLD+180FFF  hullPoints', p180);
      console.log('before oldfHull');
      //const old_hull = oldfHull(ard);
      console.log('after oldfHull');
      // @ts-ignore
      //customMap.addPolygon(old_hull);
      //customMap.addPolygon(p180, 'blue');
    });
};
main(0);
