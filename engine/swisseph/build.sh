#!/bin/sh
# Compila Swiss Ephemeris a WebAssembly. Requiere Emscripten en el PATH
# (emsdk_env). Genera build/swe.js + build/swe.wasm, que se versionan para
# que `npm test` funcione sin tener Emscripten instalado.
set -e
cd "$(dirname "$0")"
mkdir -p build

emcc wrapper.c src/sweph.c src/swephlib.c src/swedate.c src/swehouse.c \
    src/swemmoon.c src/swemplan.c src/swejpl.c src/swecl.c src/swehel.c \
    -I src -O3 \
    -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=crearSwe \
    -s ENVIRONMENT=web,worker,node \
    -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS=FS,HEAPF64,UTF8ToString,stringToUTF8,ccall,cwrap \
    -o build/swe.js

ls -l build
