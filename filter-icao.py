#!/usr/local/bin/python3
# coding: utf-8
# Licence: GNU AGPLv3

""""""

from __future__ import annotations

import argparse
import copy
import csv
import io
import json
import logging
import logging.handlers
import math
import os
import re
import sys

from argparse import RawTextHelpFormatter

from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Union

import numpy as np
import requests
import shapely.geometry
from requests.adapters import HTTPAdapter
from sklearn.cluster import OPTICS
from urllib3.util.retry import Retry

#############
# Constants #
#############

EARTH_RADIUS = 6371  # in kilometers

# LOG_PATH = f"{__file__}.log"
RETRY_STRAT = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)
ADAPTER = HTTPAdapter(max_retries=RETRY_STRAT)

TS_AIRPORTS = """
// this file is generated automatically with `filter-icao.py`
export const ALL = `{}`"""

########
# Logs #
########

# log = logging.getLogger(__file__)
# log.setLevel(logging.DEBUG)
# format_string = "%(asctime)s | %(levelname)-8s | %(message)s"

# # 125000000 bytes = 12.5Mb
# handler = logging.handlers.RotatingFileHandler(LOG_PATH, maxBytes=12500000, backupCount=3, encoding="utf8")
# handler.setFormatter(logging.Formatter(format_string))
# handler.setLevel(logging.DEBUG)
# log.addHandler(handler)

# handler_2 = logging.StreamHandler(sys.stdout)
# handler_2.setFormatter(logging.Formatter(format_string))
# handler_2.setLevel(logging.INFO)
# if __debug__:
#     handler_2.setLevel(logging.DEBUG)
# log.addHandler(handler_2)

###########
# Classes #
###########


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS * c
    # kilometers
    return distance


@dataclass
class Airport:
    name: str
    latitude_deg: float
    longitude_deg: float
    gps_code: str
    iso_country: str
    HEADERS = ["name", "latitude_deg", "longitude_deg", "gps_code", "iso_country"]

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> Airport:
        return cls(
            name=data["name"].replace("`", "'"),
            latitude_deg=float(data["latitude_deg"]),
            longitude_deg=float(data["longitude_deg"]),
            gps_code=data["gps_code"],
            iso_country=data["iso_country"],
        )

    def to_dict(self) -> Dict[str, Union[str, float]]:
        return {
            "name": self.name,
            "latitude_deg": self.latitude_deg,
            "longitude_deg": self.longitude_deg,
            "gps_code": self.gps_code,
            "iso_country": self.iso_country,
        }

    def distance_to(self, apt2: Airport) -> float:
        return haversine(
            self.latitude_deg,
            self.longitude_deg,
            apt2.latitude_deg,
            apt2.longitude_deg,
        )

    def to_mercator_xy(self) -> Tuple[float, float]:
        lat = math.radians(self.latitude_deg)
        lon = math.radians(self.longitude_deg)
        x = EARTH_RADIUS * lon
        y = EARTH_RADIUS * math.log(math.tan(math.pi / 4 + lat / 2))
        return (x, y)


class Req:

    def __init__(self) -> None:
        http = requests.Session()
        http.mount("https://", ADAPTER)
        http.mount("http://", ADAPTER)
        self.http = http


def closest(from_: Airport, arps: Iterable[Airport]) -> Tuple[float, Airport]:
    closest_distance = float("inf")
    closest_arp = None
    for arp in arps:
        if from_ == arp:
            continue
        distance = from_.distance_to(arp)
        closest_distance = min(closest_distance, distance)
        if distance == closest_distance:
            closest_arp = arp
    assert closest_arp is not None
    return (closest_distance, closest_arp)


# for each airport code ABCD,
# it will be included in A: <Airport data>
def split_by_fst_letter(airports: Iterable[Airport]) -> Dict[str, List[Airport]]:
    airport_dict = {}
    for airport in airports:
        first_letter = airport.gps_code[0]
        if first_letter not in airport_dict:
            airport_dict[first_letter] = [airport]
        else:
            airport_dict[first_letter].append(airport)
    return airport_dict


def point_in_polygon(
    airport: Airport, polygon: List[List[Tuple[float, float]]]
) -> bool:
    """check if a point using shapely"""
    x, y = airport.longitude_deg, airport.latitude_deg  # .to_mercator_xy()
    point = shapely.geometry.Point(x, y)
    polygon = shapely.geometry.Polygon(shell=polygon[0], holes=polygon[1:])
    return polygon.contains(point)


def _filter_icao(airport_str: str) -> Dict[str, Airport]:
    """only keep airports with an ICAO code"""
    airports = csv.DictReader(io.StringIO(airport_str))
    res = {}
    for airport in airports:
        # if ident is an ICAO code (regex)
        if re.match(r"^[A-Z]{4}$", airport["gps_code"]):
            if airport["iso_country"] == "":
                print(f"no iso_country for {airport['gps_code']}")
            else:
                res[airport["gps_code"]] = Airport.from_dict(airport)
    return res


def get_airports() -> Dict[str, Airport]:
    with open("airports.csv", "r") as f:
        airport_str = f.read()
    return _filter_icao(airport_str)


def write_csv(airports: Iterable[Airport]) -> str:
    """write the airports to a string"""
    f = io.StringIO()
    writer = csv.DictWriter(f, fieldnames=Airport.HEADERS)
    writer.writeheader()
    writer.writerows([airport.to_dict() for airport in airports])
    return f.getvalue().strip()


def write_ts(airports_csv: str) -> None:
    """write the airports to the  file"""
    with open("src/unparsed.ts", "w") as f:
        f.write(TS_AIRPORTS.format(airports_csv))


def write_geojson_airports(airports: list[Any], number: int) -> None:
    """write the airports to a geojson file"""
    json.dump(
        {"type": "FeatureCollection", "features": airports},
        open(f"country-borders-simplified-{number}.geo.json", "w"),
        indent=2,
    )


def find_outliers(airports: Dict[str, Airport]) -> List[str]:
    res = []
    for letter, airports_of_region in split_by_fst_letter(airports.values()).items():
        print(f"{letter}: filtering {len(airports_of_region)} airports")
        for airport in airports_of_region:
            # 1000km, arbitrary for now
            closest_distance, closest_arp = closest(airport, airports_of_region)
            if closest_distance > 1000:
                print(f"{letter}: removing outlier {airport.gps_code}:{airport.name}")
                res.append(airport.gps_code)
    return res


def del_outliers(airports: Dict[str, Airport], outliers: List[str]) -> None:
    for outlier in outliers:
        del airports[outlier]


# LPPS Porto Santo Airport LPPM Portimao Airport, 850km


def dl_airports() -> None:
    """download airports csv from ouraiports.com"""
    req = Req()
    # from https://ourairports.com/data/
    airport_str = req.http.get(
        "https://davidmegginson.github.io/ourairports-data/airports.csv"
    ).text
    with open("airports.csv", "w") as f:
        f.write(airport_str)


def filter_airports() -> None:
    airports = get_airports()
    outliers = find_outliers(airports)
    del_outliers(airports, outliers)
    write_ts(write_csv(airports.values()))


def airports_per_polygon():
    """count number of airports per polygon"""
    with open("country-borders-simplified-1.geo.json", "r") as f:
        geojson = json.load(f)
    updated_geojson = []
    airports = get_airports()
    nb_feature = len(geojson["features"])
    dep_time = datetime.now()
    for i, feature in enumerate(geojson["features"]):
        assert feature["geometry"]["type"] == "Polygon"
        polygon = feature["geometry"]["coordinates"]
        print(f"{i}/{nb_feature}")
        # no hole in polygon
        # assert len(polygon) == 1, "no holes"
        arp_in = []
        for airport in copy.deepcopy(list(airports.values())):
            try:
                pip = point_in_polygon(airport, polygon)
            except Exception as e:
                if airport.gps_code == "NZSP":
                    # known issue because the airport is located exactly at -90°. will be fixed soon
                    # in the airport db
                    continue
            if pip:  # type: ignore
                arp_in.append(airport.gps_code)
                # print(f"{i} contains {airport.gps_code}")
                del airports[airport.gps_code]
            # print("bfr", airports)
            # print("aft", airports)
        updated_geojson.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": polygon},
                "properties": {**feature["properties"], "airports_gps_code": arp_in},
            }
        )
    print("took ", datetime.now() - dep_time)
    print(f"{len(airports.keys())} remaining airports", airports.keys())
    write_geojson_airports(updated_geojson, 2)


def split_multipolygon():
    """split a multipolygon into multiple polygons"""
    with open("country-borders-simplified.geo.json", "r") as f:
        geojson = json.load(f)
    res = []
    for feature in geojson["features"]:
        if feature["geometry"]["type"] == "MultiPolygon":
            for polygon in feature["geometry"]["coordinates"]:
                # copy all MultiPolygon changing only type geometry and coordinates
                res.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": polygon},
                        "properties": feature["properties"],
                    }
                )
        else:
            res.append(feature)
    write_geojson_airports(res, 1)


def cluster() -> None:
    airports = get_airports()
    for letter, airports_of_region in split_by_fst_letter(airports.values()).items():
        if letter != "L":
            continue
        print(f"{letter}: {len(airports_of_region)} airports")
        np_arp = np.array([a.to_mercator_xy() for a in airports_of_region])
        labels = OPTICS(min_samples=2, max_eps=2000).fit_predict(np_arp)
        # get number of airports per cluster
        cluster_count = {}
        for label in labels:
            if label not in cluster_count:
                cluster_count[label] = 1
            else:
                cluster_count[label] += 1
        print(
            f"{letter}: {len(airports_of_region)} airports, {len(cluster_count)} clusters"
        )
        # display number of airports per cluster
        print("cluster repartition", cluster_count)
        # display outliers gps_code, and name

def cross_check_easa() -> None:
    """Verify that eash EASA airport is in the CSV"""
    airports = get_airports()
    # https://www.easa.europa.eu/en/datasets/aerodromes-falling-scope-regulation-eu-20181139
    with open("easa-airport-list.json", "r") as f:
        easa_airports = json.load(f)
    for easa_arp in easa_airports["data"]:
        icao = "ICAO airport code"
        if easa_arp[icao] not in airports:
            print(f"{easa_arp[icao]} not in airports")
    print("All easa airports in db")


def airports_in_poly_mercator_vs_lat() -> None:
    """Check if the airports in a polygon are the same when projecting or not with mercator"""
    with open("country-borders-simplified-2.geo.json", "r") as f:
        mercator_geojson = json.load(f)
    with open("country-borders-simplified-2-wo-mercator.geo.json", "r") as f:
        wo_mercator_geojson = json.load(f)
    airports = get_airports()
    # Polygons should be in the same order
    for (feature, without_feature) in zip(mercator_geojson["features"], wo_mercator_geojson["features"]):
        airports_mercator = set(feature["properties"]["airports_gps_code"])
        without_airports = set(without_feature["properties"]["airports_gps_code"])
        if airports_mercator != without_airports:
            print("-"*3)
            print(airports_mercator)
            print(without_airports)




def doc(dic: Dict[str, Callable[..., Any]]) -> str:
    """Produce documentation for every command based on doc of each function"""
    doc_string = ""
    for name_cmd, func in dic.items():
        doc_string += f"{name_cmd}: {func.__doc__}\n\n"
    return doc_string


def main() -> None:
    parser = argparse.ArgumentParser(formatter_class=RawTextHelpFormatter)
    commands = {
        "dl": dl_airports,
        "filter": filter_airports,
        "split_polygon": split_multipolygon,
        "airports_per_polygon": airports_per_polygon,
        "exp_cluster": cluster,
        "exp_cross_check_easa": cross_check_easa,
        "exp_mercator_vs_not": airports_in_poly_mercator_vs_lat,
    }
    parser.add_argument("command", choices=commands.keys(), help=doc(commands))
    args = parser.parse_args()
    commands[args.command]()


########
# Main #
########

if __name__ == "__main__":
    print("#" * 80)
    main()
