#!/bin/sh
# Baja los datos de GeoNames (CC-BY 4.0) que usa lugares.mjs.
set -e
cd "$(dirname "$0")"
mkdir -p raw && cd raw
for f in AR UY ES cities1000; do
    curl -sSfLO "https://download.geonames.org/export/dump/$f.zip"
    unzip -oq "$f.zip"
done
curl -sSfLO https://download.geonames.org/export/dump/admin1CodesASCII.txt
