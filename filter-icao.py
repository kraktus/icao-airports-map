#!/usr/local/bin/python3
# coding: utf-8
# Licence: GNU AGPLv3

""""""

from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import os
import requests
import sys
import csv
import re
import io
import math

from dataclasses import dataclass
from datetime import datetime
from collections import deque

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from pathlib import Path
from typing import Optional, List, Union, Tuple, Dict, Iterable

#############
# Constants #
#############


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
    R = 6371  # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    return distance

@dataclass
class Airport:
    name: str
    latitude_deg: float
    longitude_deg: float
    gps_code: str
    HEADERS = ["name", "latitude_deg", "longitude_deg", "gps_code"]

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> Airport:
        return cls(
            name=data["name"].replace("`", "'"),
            latitude_deg=float(data["latitude_deg"]),
            longitude_deg=float(data["longitude_deg"]),
            gps_code=data["gps_code"],
        )

    def to_dict(self) -> Dict[str, Union[str, float]]:
        return {
            "name": self.name,
            "latitude_deg": self.latitude_deg,
            "longitude_deg": self.longitude_deg,
            "gps_code": self.gps_code,
        }

    def distance_to(self, apt2: Airport) -> float:
        return haversine(
            self.latitude_deg,
            self.longitude_deg,
            apt2.latitude_deg,
            apt2.longitude_deg,
        )

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


def main() -> None:
    req = Req()
    # from https://ourairports.com/data/
    airport_str = req.http.get(
        "https://davidmegginson.github.io/ourairports-data/airports.csv"
    ).text
    airports = filter_icao(airport_str)
    for (letter, airports_of_region) in split_by_fst_letter(airports.values()).items():
        print(f"{letter}: filtering {len(airports_of_region)} airports")
        for airport in airports_of_region:
            # 1000km, arbitrary for now
            closest_distance, closest_arp = closest(airport, airports_of_region)
            if closest_distance > 1000:
                print(f"{letter}: removing outlier {airport.gps_code}:{airport.name}")
                del airports[airport.gps_code]
            if airport.gps_code == "LGRS":
                print(f"LGRS closest airport is {closest_arp.gps_code}:{closest_arp.name} at {closest_distance}km")
    write_ts(write_csv(airports.values()))


########
# Main #
########

if __name__ == "__main__":
    print("#" * 80)
    main()
