# PicoCalc Web Emulator

A browser-based emulator for the [PicoCalc](https://www.clockworkpi.com/picocalc) handheld computer, powered by (my fork of) the [**Bramble**](https://github.com/Night-Traders-Dev/Bramble) RP2040/RP2350 emulator compiled to WebAssembly via Emscripten.

## Features

- Emulates RP2040 (Cortex-M0+) dual-core CPU
- SPI LCD display output rendered on a `<canvas>` element (320×320)
- Virtual SD card support (load a `.img` file)
- I2C keyboard input via physical keyboard passthrough
- UART output capture and diagnostics panel
- Runtime verbosity toggle (Silent / Normal / Verbose)
- Hex memory dumper

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html) — required only to rebuild the WASM module

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Build the WASM module

Run this from the `web/` directory. It compiles `bramble/` with Emscripten and copies the output to `public/`.

```bash
bash build_wasm.sh
```

> **Note:** `emsdk_env.sh` is sourced from a sibling `emsdk/` directory. Adjust the path in `build_wasm.sh` if your emsdk lives elsewhere.

### 3. Start the development server

```bash
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

### 4. Run the emulator

1. The emulator auto-loads `public/firmware.uf2` on startup if present.
2. To load a different firmware, use the **Load UF2 Firmware** button.
3. Optionally load an SD card image with **Load SD Image (.img)**.

## Project Structure

```
web/
├── public/
│   ├── bramble.js      # Compiled WASM JS glue (generated)
│   ├── bramble.wasm    # Compiled WASM binary (generated)
│   └── firmware.uf2   # Default firmware loaded on startup
├── src/
│   ├── main.ts         # Emulator UI, render loop, input handling
│   └── style.css       # Styles
├── build_wasm.sh       # Emscripten build script
├── index.html
├── tsconfig.json
└── package.json
```

## Production Build

```bash
npm run build
```

Output is placed in `dist/`. Serve with any static file server.

## Related

- [`../bramble/`](../bramble/) — Bramble RP2040/RP2350 emulator (C source)
- [`../bramble/README.md`](../bramble/README.md) — Bramble emulator documentation
- [`../bramble/Bramble_Guide.md`](../bramble/Bramble_Guide.md) — Detailed emulator guide
