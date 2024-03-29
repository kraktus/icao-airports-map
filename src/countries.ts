import * as Countries from '../country-borders-simplified.geo.json';
import * as L from 'leaflet';
import { Airports, Iso2, Airport } from './airport';
import { countBy, getMostCommon } from './utils';

const prefixLength = 1;

export const addGeo = (map: L.Map, arp: Airports) => {
  const prefixesByCountry = arp.prefixesByCountry(prefixLength);
  //console.log('prefixesByCountry', prefixesByCountry);
  L.geoJson(Countries as any, { style: style(prefixesByCountry, arp) }).addTo(
    map,
  );
};

// interface GeoFeature {
//   type: string;
//   geometry: {
//     type: string;
//     coordinates: [number, number][][][];
//   };
//   properties: { ISO_A2_EH: string };
// }

const airportsInCountry = (
  arp: Airports,
  coordinates: [number, number][],
): Airport[] => {
  const coordinatesPts = coordinates.map(([lat, lon]) => ({ x: lon, y: lat }));
  const res = [];
  for (const airport of arp.all()) {
    const point = { x: airport.longitude_deg, y: airport.latitude_deg };
    if (pointIsInPoly(point, coordinatesPts)) {
      res.push(airport);
    }
  }
  return res;
};

const getMostCommonPrefix = (airports: Airport[]): string => {
  const prefixes = countBy(airports, (airport: Airport) => airport.gps_code);
  return getMostCommon(prefixes);
};

const style =
  (prefixesByCountry: Map<Iso2, Map<string, number>>, arp: Airports) =>
  (feature: any) => {
    //console.log('feature', feature);
    const countryCode = feature.properties.ISO_A2_EH;
    let fillColor = 'blue';
    if (countryCode !== undefined && countryCode !== '-99') {
      const prefixesOfCountry = prefixesByCountry.get(countryCode);
      console.log(
        'countryCode',
        countryCode,
        'prefixesOfCountry',
        prefixesOfCountry,
      );
      let mostCommonPrefix = undefined;
      if (prefixesOfCountry !== undefined) {
        mostCommonPrefix = getMostCommon(prefixesOfCountry);
        fillColor = arp.prefixColor(mostCommonPrefix, prefixLength);
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

interface Point {
  x: number;
  y: number;
}

// doubtful source, SO
// https://stackoverflow.com/a/17490923/20374403
function pointIsInPoly(p: Point, polygon: Point[]): boolean {
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
