import * as Countries from '../country-borders-simplified.geo.json';
import * as L from 'leaflet';
import { colors } from './colors';
import { Airports } from './airport';

export const addGeo = (map: L.Map, arp: Airports) => {
  const prefixLength = 1;
  const prefixes = arp.listPrefix(prefixLength);
  const prefixesByCountry = arp.prefixesByCountry(prefixLength);
  //console.log('prefixesByCountry', prefixesByCountry);
  const style = (feature: any) => {
    //console.log('feature', feature);
    const countryCode = feature.properties.ISO_A2_EH;
    let fillColor = 'blue';
    if (countryCode !== undefined && countryCode !== '-99') {
      const prefixesOfCountry = prefixesByCountry.get(countryCode);
      // console.log(
      //   'countryCode',
      //   countryCode,
      //   'prefixesOfCountry',
      //   prefixesOfCountry,
      // );
      let mostCommon = undefined;
      if (prefixesOfCountry !== undefined) {
        mostCommon = Array.from(prefixesOfCountry.entries()).reduce((a, b) =>
          a[1] > b[1] ? a : b,
        )[0];
        fillColor = colors[prefixes.indexOf(mostCommon) % colors.length];
      }
      // console.log(
      //   'most common prefix of country',
      //   feature.properties.ISO_A2_EH,
      //   mostCommon,
      //   fillColor,
      // );
    }
    return {
      fillColor: fillColor,
      weight: 2,
      opacity: 1,
      color: undefined,
      dashArray: '3',
      fillOpacity: 0.4,
    };
  };
  L.geoJson(Countries as any, { style: style }).addTo(map);
};

interface Point {
  x: number;
  y: number;
}

// doubtful source, SO
// https://stackoverflow.com/a/17490923/20374403
function pointIsInPoly(p: Point, polygon: Point[]) {
  let isInside = false;
  let minX = polygon[0].x,
    maxX = polygon[0].x;
  let minY = polygon[0].y,
    maxY = polygon[0].y;
  for (let n = 1; n < polygon.length; n++) {
    let q = polygon[n];
    minX = Math.min(q.x, minX);
    maxX = Math.max(q.x, maxX);
    minY = Math.min(q.y, minY);
    maxY = Math.max(q.y, maxY);
  }

  // fast path by computing polygon bounding box
  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return false;
  }

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (
      polygon[i].y > p.y != polygon[j].y > p.y &&
      p.x <
        ((polygon[j].x - polygon[i].x) * (p.y - polygon[i].y)) /
          (polygon[j].y - polygon[i].y) +
          polygon[i].x
    ) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export const testPIPs = () => {
  const polygon = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ];
  const points = [
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 1.5 },
    { x: 1.5, y: 0.5 },
    { x: 1.5, y: 1.5 },
  ];
  points.forEach(p => {
    console.log('point', p, 'is in polygon', pointIsInPoly(p, polygon));
  });
};
