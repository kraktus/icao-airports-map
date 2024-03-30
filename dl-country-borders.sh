
# wget returning code 500, for now install via browser
# https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_countries.zip
# unzip ne_10m_admin_0_countries.zip
# mv ne_10m_admin_0_countries natural-earth
cd natural-earth && \
# It's unclear which field should be taken to represent the country, as natural earth provide no doc
# https://github.com/nvkelso/natural-earth-vector/issues/153 -select
#ogr2ogr -f GeoJSON -select ISO_A2_EH -s_srs ne_10m_admin_0_countries.prj -t_srs EPSG:4326 country-borders.geo.json ne_10m_admin_0_countries.shp

# all fields
# ogr2ogr -f GeoJSON -s_srs ne_10m_admin_0_countries.prj -t_srs EPSG:4326 country-borders-all-fields.geo.json ne_10m_admin_0_countries.shp


# with jq, print values of SOV_A3, ADM0_A3, wherever they are
# jq '.features[].properties | .ISO_A2_EH' country-borders.geo.json
# TODO, maybe 10% is too low, think about 30/50% for later
pnpm mapshaper natural-earth/country-borders.geo.json -simplify keep-shapes 10% -o format=geojson country-borders-simplified.geo.json

#cp country-borders.geo.json ../country-borders-simplified.geo.json