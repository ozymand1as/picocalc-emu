#!/bin/bash
set -e

source /Users/dmitrii_platonov/Documents/Personal_projects/pico_emu/emsdk/emsdk_env.sh

echo "Building Bramble to webassembly..."

cd ../bramble
mkdir -p build_wasm
cd build_wasm

emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DENABLE_FUSE=OFF

emmake make bramble_web -j$(sysctl -n hw.ncpu || echo 4)
echo "Build complete."

# copy to web directory
cp bramble.js ../../web/public/bramble.js
cp bramble.js ../../web/public/bramble.cjs
cp bramble.wasm ../../web/public/bramble.wasm || true
