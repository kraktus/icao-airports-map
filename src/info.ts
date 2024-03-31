import * as L from 'leaflet';
import { countBy, getMostCommon } from './utils';
import { debug } from './config';

const toBr = (...l: string[]) => {
  // place each element into <b> /<b><br /> tag
  return l.map(y => `${y}<br />`).join('');
};

const text = (...l: (string | undefined)[]) => {
  return debug
    ? toBr(
        `id ${l[0]}`,
        `nb arps ${l[1]}`,
        `prefix ${l[2]}`,
        `country code: ${l[3]}`,
      )
    : toBr(`nb arps ${l[0]}`, `prefix ${l[1]}`);
};

export class Info {
  private info: any; // L.control()
  filter: string;
  constructor(filter: string) {
    this.filter = filter;
    // @ts-ignore
    this.info = L.control();
    this.info.onAdd = function (map: L.Map) {
      this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
      return this._div;
    };
  }
  private div() {
    return this.info._div;
  }

  prefixLength(): number {
    return this.filter.length + 1;
  }

  getPrefixes(gps_codes: string[]): Map<string, number> {
    return countBy(gps_codes, (gps_code: string) =>
      gps_code.slice(0, this.prefixLength()),
    );
  }
  getPrefix(gps_codes: string[]): string {
    return getMostCommon(this.getPrefixes(gps_codes))!;
  }

  setFilter(filter: string) {
    this.filter = filter;
  }

  update(feature?: any) {
    //console.log('update input', filter, feature);
    const p = debug ? feature?.properties : feature?.geometry.properties;
    this.div().innerHTML =
      '<h4>Airports information</h4>' +
      (p ? this.textProp(feature, p) : 'Hover over a country') +
      '</br>' +
      this.inputInfo();
  }

  private inputInfo(): string {
    // text input inside div, with info icon explaining it can be a regex, + add a click button
    return `<div class="info-input">filter: <input type="text" id="info-input" value="${this.filter}"/><button id="info-button">Go</button></div>`;
  }

  private textProp(feature: any, p: any) {
    return debug
      ? text(
          feature.id,
          p.airports_gps_code.length,
          this.getPrefix(p.airports_gps_code),
          p.ISO_A2_EH,
        )
      : text(p.airports_gps_code.length, this.getPrefix(p.airports_gps_code));
  }

  addTo(map: L.Map) {
    this.info.addTo(map);
    this.update();
  }
}
