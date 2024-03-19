import './style.css';
import './github.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { airports, Airport } from './airport';
import hull from 'hull.js';

console.log('ICAO airport v0.0');

// const oldfHull = (ard: Airport[]): [number, number][] => {
//   const points = ard.map(airport => [
//     airport.latitude_deg,
//     airport.longitude_deg,
//   ]);
//   const hullPoints = hull(points);
//   return hullPoints as [number, number][];
// };

// const writeToOutput = (...text: string[]) => {
//   const output = document.getElementById('output')!;
//   output.innerHTML = output.innerHTML + text.join(' ') + '\n';
// };

// const colors = [
//   '#9e0142',
//   '#d53e4f',
//   '#f46d43',
//   '#fdae61',
//   '#fee08b',
//   '#ffffbf',
//   '#e6f598',
//   '#abdda4',
//   '#66c2a5',
//   '#3288bd',
//   '#5e4fa2',
// ];

// https://graphicdesign.stackexchange.com/questions/3682/where-can-i-find-a-large-palette-set-of-contrasting-colors-for-coloring-many-d
// http://godsnotwheregodsnot.blogspot.com/2012/09/color-distribution-methodology.html

const colors = [
  '#000000',
  '#FFFF00',
  '#1CE6FF',
  '#FF34FF',
  '#FF4A46',
  '#008941',
  '#006FA6',
  '#A30059',
  '#FFDBE5',
  '#7A4900',
  '#0000A6',
  '#63FFAC',
  '#B79762',
  '#004D43',
  '#8FB0FF',
  '#997D87',
  '#5A0007',
  '#809693',
  '#FEFFE6',
  '#1B4400',
  '#4FC601',
  '#3B5DFF',
  '#4A3B53',
  '#FF2F80',
  '#61615A',
  '#BA0900',
  '#6B7900',
  '#00C2A0',
  '#FFAA92',
  '#FF90C9',
  '#B903AA',
  '#D16100',
  '#DDEFFF',
  '#000035',
  '#7B4F4B',
  '#A1C299',
  '#300018',
  '#0AA6D8',
  '#013349',
  '#00846F',
  '#372101',
  '#FFB500',
  '#C2FFED',
  '#A079BF',
  '#CC0744',
  '#C0B9B2',
  '#C2FF99',
  '#001E09',
  '#00489C',
  '#6F0062',
  '#0CBD66',
  '#EEC3FF',
  '#456D75',
  '#B77B68',
  '#7A87A1',
  '#788D66',
  '#885578',
  '#FAD09F',
  '#FF8A9A',
  '#D157A0',
  '#BEC459',
  '#456648',
  '#0086ED',
  '#886F4C',
  '#34362D',
  '#B4A8BD',
  '#00A6AA',
  '#452C2C',
  '#636375',
  '#A3C8C9',
  '#FF913F',
  '#938A81',
  '#575329',
  '#00FECF',
  '#B05B6F',
  '#8CD0FF',
  '#3B9700',
  '#04F757',
  '#C8A1A1',
  '#1E6E00',
  '#7900D7',
  '#A77500',
  '#6367A9',
  '#A05837',
  '#6B002C',
  '#772600',
  '#D790FF',
  '#9B9700',
  '#549E79',
  '#FFF69F',
  '#201625',
  '#72418F',
  '#BC23FF',
  '#99ADC0',
  '#3A2465',
  '#922329',
  '#5B4534',
  '#FDE8DC',
  '#404E55',
  '#0089A3',
  '#CB7E98',
  '#A4E804',
  '#324E72',
  '#6A3A4C',
];

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
    L.control.scale().addTo(this.map);
  }
  addMarker(lat: number, lng: number, popupText: string) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon(),
    }).addTo(this.map);
    marker.bindPopup(popupText);
    this.layers.push(marker);
  }
  // addcircle
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
        lat: airport.latitude_deg,
        lng: airport.longitude_deg,
      });
      return [xyPt.x, xyPt.y];
    });
    const hullPoints = hull(points, 0) as [number, number][];
    return hullPoints.map(([x, y]) => {
      const latLongPt = this.map.containerPointToLatLng(L.point(x, y));
      return [latLongPt.lat, latLongPt.lng];
    });
  }
}

// the config must show all the earth
const config: MapConfig = { center: [50, 10], zoom: 2 };

const customMap = new CustomMap('map', config);

document.getElementById('slider')!.addEventListener('input', () => {
  main(Number((document.getElementById('slider') as HTMLInputElement).value));
});

// js foreach combined with index
const sliceSize = 1;
const main = (sliceIndex: number) => {
  customMap.clear();
  Array.from(airports.getAllPrefixes(1).entries())
    //.slice(sliceSize * sliceIndex, (sliceSize + 1) * sliceIndex)
    // customMap
    //   .getByPrefix('LF')
    // .filter(
    //   ([_, ard]) =>
    //     ard[0].gps_code.startsWith('SO') || ard[0].gps_code.startsWith('SY'),
    // )
    .map(([i, ard]) => {
      console.log(
        'first airport code: ',
        ard[0].gps_code,
        'number of aprts: ',
        ard.length,
      );
      const color = colors[i % colors.length];

      // for (const airport of ard) {
      //   customMap.addCircle(
      //     airport.latitude_deg,
      //     airport.longitude_deg,
      //     `${airport.gps_code}: ${airport.name}`,
      //     color,
      //   );
      // }
      const hullPoints = customMap.hullOf(ard);
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
      //const old_hull = oldfHull(ard);
      // @ts-ignore
      customMap.addPolygon(hullPoints, color);
      //customMap.addPolygon(p180, 'blue');
    });
};
main(0);
