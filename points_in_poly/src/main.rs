#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![warn(clippy::style)]
#![warn(clippy::complexity)]
#![warn(clippy::perf)]
#![warn(clippy::correctness)]

use anyhow::{bail, Context, Result};

use geo::{
    self, Closest, ClosestPoint, Contains, HaversineDistance, LineString,
};
use geojson::{feature::Id, feature::Id::Number, Feature, PolygonType, Value::Polygon};
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

impl Airport {
    fn to_point(&self) -> geo::Point<f64> {
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

fn closest_polygon<'a>(
    features: impl Iterator<Item = &'a Feature>,
    airport: &Airport,
) -> Option<Id> {
    let mut polys_dist: Vec<_> = features
        .filter_map(|feature| {
            let polygon = polygon_from_feature(feature)?;
            let feature_id = feature.id.clone()?;
            let poly = polygon_to_polygon(polygon);
            let arp_pt = airport.to_point();
            //println!("airport: {:?}, feature id: {:?}", airport.gps_code, feature_id);
            let Closest::SinglePoint(closest_point) = poly.closest_point(&arp_pt) else {
                panic!("no closest point")
            };
            let distance_m = arp_pt.haversine_distance(&closest_point) as usize;

            Some((distance_m, feature_id))
        })
        .collect();
    polys_dist.sort_unstable_by_key(|a| a.0);
    // heuristics, tweak as needed
    //println!("{},{}", airport.gps_code,polys_dist[0].0);
    if polys_dist[0].0 < 50000 {
        //&& polys_dist[1].0 > 2000 {
        Some(polys_dist[0].1.clone())
    } else {
        None
    }
}

fn polygon_from_feature(feature: &Feature) -> Option<&PolygonType> {
    feature
        .geometry
        .as_ref()
        .map(|x| &x.value)
        .and_then(|x| match x {
            Polygon(poly) => Some(poly),
            _ => None,
        })
}

fn lonely_airports_looking_for_polygon(
    mut updated_geojson: Vec<Feature>,
    airports: Vec<Airport>,
) -> Result<Vec<Feature>> {
    let mut added_airports = Vec::with_capacity(airports.len());
    for airport in airports.iter() {
        if let Some(close_poly_feature_id) = closest_polygon(updated_geojson.iter(), &airport) {
            let Number(id) = close_poly_feature_id else {
                bail!("id should be number")
            };
            let id_usize = id.as_u64().context("id feature")? as usize;
            let feature = updated_geojson.get_mut(id_usize).context("feature")?;
            assert_eq!(feature.id, Some(Number(id.into())));
            let mut already_in_arp: Vec<String> = feature
                .property("airports_gps_code")
                .cloned()
                .map(|x| serde_json::from_value(x).expect("error arp list"))
                .unwrap_or_default();

            already_in_arp.push(airport.gps_code.clone());
            added_airports.push(airport.gps_code.clone());
            feature.set_property("airports_gps_code", already_in_arp)
        }
    }
    let airports_not_added = airports
        .into_iter()
        .filter(|airport| !added_airports.contains(&airport.gps_code))
        .map(|airport| airport.gps_code)
        .collect::<Vec<_>>();
    println!("{} lonely airports added", added_airports.len());
    println!("{} lonely airports not added", airports_not_added.len());
    println!("lonely airports: {:?}", airports_not_added);
    Ok(updated_geojson)
}

fn airports_in_polygon() -> Result<()> {
    let content = std::fs::read_to_string(country_borders(1)).context("geojson failed")?;
    let mut airports = get_airports()?;
    let geojson: geojson::FeatureCollection = content.parse()?;
    let nb_feature = geojson.features.len();
    let mut updated_geojson = Vec::with_capacity(nb_feature);
    let dep_time = std::time::Instant::now();
    for (i, feature) in geojson.features.iter().enumerate() {
        let Some(polygon) = polygon_from_feature(feature) else {
            bail!("Invalid geometry type")
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
        updated_feature.set_property("airports_gps_code", arp_in);
        updated_feature.id = Some(Number(i.into()));
        updated_geojson.push(updated_feature);
    }
    println!("took: {:?} to check", dep_time.elapsed());
    println!("airports not in any polygon: {:?}", airports.keys().len());
    let include_lonely_airports =
        lonely_airports_looking_for_polygon(updated_geojson, airports.into_values().collect())?;
    write_geojson(include_lonely_airports)
}

fn main() -> Result<()> {
    airports_in_polygon()
}
