# ICAO airports map

Viewing airport data grouped according to their ICAO codes.

Airport data is from [ourAirports](http://ourairports.com/data/), geographic data is from [Natural Earth](http://www.naturalearthdata.com/).

## Running the project

Clone with the submodules.

- Check `dl-country-borders.sh`,
- Install and run `filter-icao.py dl` then `filter-icao.py filter`. Move the resulting file `unparsed.ts` to `src/data`.
- Run `cargo run --release` in `points_in_poly`. Move the resulting file `./country-borders-simplified-2.geo.json` to `src/data`, and rename it according to the previous `geo.json` file.
- See scripts in `package.json`.
