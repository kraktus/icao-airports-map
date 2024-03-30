use anyhow::{Context, Result};
use csv;
use geo::{self, Contains, LineString};
use geojson::{PolygonType, Value::Polygon};
use regex;
use serde;
use std::collections::HashMap;

#[derive(Debug, serde::Deserialize, Clone)]
struct Airport {
    //_name: String,
    latitude_deg: f64,
    longitude_deg: f64,
    gps_code: String,
    //_iso_country: String,
}

impl From<Airport> for geo::Point<f64> {
    fn from(arp: Airport) -> Self {
        Self::new(arp.longitude_deg, arp.latitude_deg)
    }
}

impl Airport {
    fn to_point(&self) -> geo::Point {
        geo::Point::new(self.longitude_deg, self.latitude_deg)
    }

    fn is_in_polygon(&self, polygon: &PolygonType) -> bool {
        let pt = self.to_point();
        polygon_to_polygon(polygon).contains(&pt)
    }
}

fn get_airports() -> Result<HashMap<String, Airport>> {
    let file = std::fs::File::open("../airports.csv").context("airports.csv failed")?;
    let reader = std::io::BufReader::new(file);
    let mut csv_reader = csv::Reader::from_reader(reader);
    let mut airports = Vec::new();
    for result in csv_reader.deserialize() {
        airports.push(result?);
    }
    Ok(_filter_icao(airports))
}

fn _filter_icao(airports: Vec<Airport>) -> HashMap<String, Airport> {
    let regex = regex::Regex::new(r"^[A-Z]{4}$").unwrap();
    airports
        .into_iter()
        .filter(|arp| regex.is_match(&arp.gps_code))
        .map(|arp| (arp.gps_code.clone(), arp))
        .collect()
}

fn vec_to_line(vec: &Vec<Vec<f64>>) -> LineString<f64> {
    vec.iter()
        .map(|coord| (coord[0], coord[1]))
        .collect::<Vec<_>>()
        .into()
}

fn polygon_to_polygon(polygon: &PolygonType) -> geo::Polygon {
    let mut copy_vec = polygon.clone();
    let holes = copy_vec.split_off(1);
    let line = vec_to_line(&copy_vec[0]);

    geo::Polygon::new(line, holes.iter().map(vec_to_line).collect())
}

fn airports_in_polygon() -> Result<()> {
    let content = std::fs::read_to_string("../country-borders-simplified.geo.json").context("geojson failed")?;
    let mut airports = get_airports()?;
    let geojson: geojson::FeatureCollection = content.parse()?;
    let nb_feature = geojson.features.len();
    let dep_time = std::time::Instant::now();
    for (i, feature) in geojson.features.iter().enumerate() {
        let Some(Polygon(polygon)) = feature.geometry.as_ref().map(|x| &x.value) else {
            anyhow::bail!("Invalid geometry type")
        };
        println!("{i}/{nb_feature}");

        let mut arp_in: Vec<String> = Vec::new();
        // clone to avoid borrowing issue
        let arp_values: Vec<Airport> = airports.values().cloned().collect();
        for airport in arp_values {
            if airport.is_in_polygon(polygon) {
                arp_in.push(airport.gps_code.clone());
                airports.remove(&airport.gps_code);
            } else {
                if airport.gps_code == "NZSP" {
                    // known issue because the airport is located exactly at -90°. will be fixed soon
                    // in the airport db
                    continue;
                }
            }
        }

        // updated_geojson.push(Feature {
        //     geometry: Geometry {
        //         geo_type: "Polygon".to_string(),
        //         coordinates: polygon.clone()
        //     },
        //     properties: {
        //         let mut property_map = feature.properties.clone();
        //         property_map.insert("airports_gps_code".to_string(), arp_in.join(","));
        //         property_map
        //     }
        // });
    }
    println!("took: {:?} to check", dep_time.elapsed());
    println!("airports not in any polygon: {:?}", airports.keys().len());
    Ok(())
}

fn main() -> Result<()> {
    airports_in_polygon()
}
