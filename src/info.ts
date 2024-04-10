import * as L from 'leaflet'; // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/leaflet/index.d.ts
import { countBy, getMostCommon, groupBy } from './utils';
import { Oaci } from './airport';

const toBr = (...l: string[]) => {
  // place each element into <b> /<b><br /> tag
  return l.map(y => `${y}<br />`).join('');
};

const text = (...l: (string | undefined)[]) => {
  return toBr(`${l[0]} airports`, `ICAO prefix:  <b>${l[1]}</b>`);
};

export class Info {
  private info: any; // L.control()
  filter: string;
  constructor(filter: string) {
    this.filter = filter;
    // @ts-ignore
    this.info = L.control();
    this.info.onAdd = function (_map: L.Map) {
      this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
      return this._div;
    };
  }
  private div(): HTMLElement {
    return this.info._div;
  }

  prefixLength(): number {
    return this.filter.length + 1;
  }

  countByPrefixes(gps_codes: Oaci[]): Map<string, number> {
    return countBy(gps_codes, this.getGpsCodePrefix.bind(this));
  }
  groupByPrefixes(gps_codes: Oaci[]): Map<string, Oaci[]> {
    return groupBy(gps_codes, this.getGpsCodePrefix.bind(this));
  }

  // assume non-empty array
  getPrefix(gps_codes: Oaci[]): string {
    if (gps_codes.length === 0) {
      throw new Error('gps_codes array is empty!');
    }
    return getMostCommon(this.countByPrefixes(gps_codes))!;
  }

  getGpsCodePrefix(gps_code: Oaci): string {
    return gps_code.slice(0, this.prefixLength());
  }

  setFilter(filter: string) {
    this.filter = filter;
  }

  update(data?: UpdateData) {
    this.div().innerHTML =
      '<h4>ICAO Airport codes</h4>' +
      (data ? this.textProp(data) : 'Hover over an area') +
      '</br>' +
      this.inputInfo();
  }

  private inputInfo(): string {
    // text input inside div, with info icon explaining it can be a regex, + add a click button
    return `<div class="info-input">filter: <input type="text" id="info-input" value="${this.filter}"/><button id="info-button">Go</button></div>`;
  }

  private textProp(data: UpdateData) {
    return text(data.nbAirports.toString(), data.prefix);
  }

  addTo(map: L.Map) {
    this.info.addTo(map);
    this.update();
  }
}

export interface UpdateData {
  prefix: string;
  nbAirports: number;
}
