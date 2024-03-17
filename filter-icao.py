#!/usr/local/bin/python3
#coding: utf-8
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

from dataclasses import dataclass
from datetime import datetime
from collections import deque

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
from pathlib import Path
from typing import Optional, List, Union, Tuple

#############
# Constants #
#############


# LOG_PATH = f"{__file__}.log"
RETRY_STRAT = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)
ADAPTER = HTTPAdapter(max_retries=RETRY_STRAT)

FILTERED_HEADERS = ["ident", "name", "latitude_deg", "longitude_deg"]

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

class Req:

    def __init__(self) -> None:
        http = requests.Session()
        http.mount("https://", ADAPTER)
        http.mount("http://", ADAPTER)
        self.http = http


def filter_icao(airport_str: airport_str) -> List[Dict[str, str]]:
    """only keep airports with an ICAO code"""
    airports = csv.DictReader(io.StringIO(airport_str))
    res = []
    for airport in airports:
        # if ident is an ICAO code (regex)
        if re.match(r"^[A-Z]{4}$", airport["ident"]):
            res.append({x: airport[x].replace("`", "'") for x in FILTERED_HEADERS})
    return res

def write_csv(airports: List[Dict[str, str]]) -> str:
    """write the airports to a string"""
    f = io.StringIO()
    writer = csv.DictWriter(f, fieldnames=FILTERED_HEADERS)
    writer.writeheader()
    writer.writerows(airports)
    return f.getvalue().trim()

def write_ts(airports_csv: str) -> None:
    """write the airports to the  file"""
    with open("src/unparsed.ts", "w") as f:
        f.write(TS_AIRPORTS.format(airports_csv))

def main() -> None:
    req = Req()
    # from https://ourairports.com/data/
    airport_str = req.http.get("https://davidmegginson.github.io/ourairports-data/airports.csv").text
    airports = filter_icao(airport_str)
    write_ts(write_csv(airports))


########
# Main #
########

if __name__ == "__main__":
    print('#'*80)
    main()