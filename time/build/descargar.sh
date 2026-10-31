#!/bin/sh
# Baja el fuente de tzdata que usa zonas.mjs. La version queda fija aca.
set -e
VERSION=2025b
cd "$(dirname "$0")"
mkdir -p raw && cd raw
curl -sSfLO "https://data.iana.org/time-zones/releases/tzdata$VERSION.tar.gz"
tar xzf "tzdata$VERSION.tar.gz"
