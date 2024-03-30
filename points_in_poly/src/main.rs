#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![warn(clippy::style)]
#![warn(clippy::complexity)]
#![warn(clippy::perf)]
#![warn(clippy::correctness)]

use anyhow::{Context, Result};

use geo::{self, Contains, LineString};
use geojson::{Feature, PolygonType, Value::Polygon};

use std::collections::HashMap;

#[derive(Debug, serde::Deserialize, Clone)]
struct Airport {
    //_name: String,
    latitude_deg: f64,
    longitude_deg: f64,
    gps_code: String,
    //_iso_country: String,
}

fn country_borders(n: usize) -> String {
    format!("../country-borders-simplified-{n}.geo.json")
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

fn write_geojson(updated_geojson: Vec<Feature>) -> Result<()> {
    let updated_geojson = geojson::FeatureCollection {
        features: updated_geojson,
        bbox: None,
        foreign_members: None,
    };
    let serialized = serde_json::to_string_pretty(&updated_geojson)?;
    std::fs::write(country_borders(2), serialized)?;
    Ok(())
}

fn vec_to_line(vec: &[Vec<f64>]) -> LineString<f64> {
    vec.iter()
        .map(|coord| (coord[0], coord[1]))
        .collect::<Vec<_>>()
        .into()
}

fn polygon_to_polygon(polygon: &PolygonType) -> geo::Polygon {
    let mut copy_vec = polygon.clone();
    let holes = copy_vec.split_off(1);
    let line = vec_to_line(&copy_vec[0]);

    geo::Polygon::new(line, holes.iter().map(|x| vec_to_line(x)).collect())
}

fn airports_in_polygon() -> Result<()> {
    let content = std::fs::read_to_string(country_borders(1)).context("geojson failed")?;
    let mut airports = get_airports()?;
    let geojson: geojson::FeatureCollection = content.parse()?;
    let mut updated_geojson = Vec::new();
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
            }
        }
        let mut updated_feature = feature.clone();
        updated_feature.set_property("airports_gps_code", arp_in.join(","));
        updated_geojson.push(updated_feature);
    }
    println!("took: {:?} to check", dep_time.elapsed());
    println!("airports not in any polygon: {:?}", airports.keys().len());
    Ok(())
}

fn main() -> Result<()> {
    airports_in_polygon()
}
