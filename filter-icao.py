#!/usr/local/bin/python3
# coding: utf-8
# Licence: GNU AGPLv3

""""""

from __future__ import annotations

import argparse
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


def filter_icao(airport_str: str) -> Dict[str, Airport]:
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
    req = Req()
    # from https://ourairports.com/data/
    airport_str = req.http.get(
        "https://davidmegginson.github.io/ourairports-data/airports.csv"
    ).text
    with open("airports.csv", "w") as f:
        f.write(airport_str)


def filter_airports() -> None:
    with open("airports.csv", "r") as f:
        airport_str = f.read()
    airports = filter_icao(airport_str)
    outliers = find_outliers(airports)
    del_outliers(airports, outliers)
    write_ts(write_csv(airports.values()))


def cluster() -> None:
    with open("airports.csv", "r") as f:
        airport_str = f.read()
    airports = filter_icao(airport_str)
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
        "cluster": cluster,
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
